/**
 * Cursor Cloud Agents API 직접 호출 (릴레이 없음).
 * POST {base}/v0/agents → 폴링 GET {base}/v0/agents/{id}
 * 인증: Basic (API 키:빈비밀번호)
 *
 * @see https://cursor.com/docs/cloud-agent/api/endpoints
 */

import { randomUUID } from "node:crypto";
import { validateCursorAgentLaunchPayload } from "@/lib/execution/cursorAgentLaunchValidation";
import { enhanceCursorErrorIfBaseBranchRelated, repoDisplayForGitError } from "@/lib/execution/gitBranchCursorError";
import { verifyBaseBranchBeforeCursorExecution } from "@/lib/execution/verifyBaseBranchBeforeCursor";
import {
  appendTaskProgressLog,
  isTaskProgressCursorPollEnabled,
  isTaskProgressCursorPollDumpEnabled,
  isTaskProgressLogEnabled,
} from "@/lib/observability/taskProgressLog";
import { cursorApiBasicAuthHeader, normalizeCursorApiBaseUrl } from "@/lib/executionSetup/cursorApiValidation";

/** Cursor 실행 결과(플랫폼은 로컬 git/diff 없음). */
export type CursorRunResult = {
  runId: string;
  summary: string;
  changedFiles: string[];
  branchName: string;
  commitHash?: string;
  /** Cursor Agent target에 포함된 PR URL (API가 commit/files를 비워도 PR 생성은 확인 가능) */
  prUrl?: string;
  executionStatus?: "succeeded" | "failed" | string;
  error?: string;
};

export type ExecutionSetupRelaySlice = {
  cursorApiUrl: string;
  cursorApiToken: string | null;
  gitRepoUrl: string;
  baseBranch: string;
  branchStrategy: string;
  branchPrefix: string | null;
  autoCommit: boolean;
  autoPush: boolean;
  autoPr: boolean;
  requireTestsBeforePush: boolean;
};

export type RelayTaskSlice = {
  id: string;
  title: string;
  description: string | null;
  acceptanceCriteria: string[];
};

export type ExecuteCursorRelayParams = {
  projectId: string;
  workflowId?: string | null;
  executionSetup: ExecutionSetupRelaySlice;
  task: RelayTaskSlice;
  suggestedBranchName: string;
  prompt: string;
  allowedPaths?: string[];
};

export type ExecuteCursorRunOutcome =
  | { ok: true; result: CursorRunResult; logs: string[] }
  | { ok: false; error: string; logs: string[] };

function parseEnvPositiveIntMs(
  name: string,
  fallback: number,
  bounds: { min: number; max: number }
): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(bounds.max, Math.max(bounds.min, n));
}

/** 첫 상태 폴링 전 대기 (에이전트가 곧바로 끝나는 경우 꼬리 지연 완화). 기본 2.5초. */
const POLL_FIRST_DELAY_MS = parseEnvPositiveIntMs("CURSOR_AGENT_POLL_FIRST_DELAY_MS", 2_500, {
  min: 0,
  max: 120_000,
});
/** 이후 폴링 간격. 기본 10초. */
const POLL_INTERVAL_MS = parseEnvPositiveIntMs("CURSOR_AGENT_POLL_INTERVAL_MS", 10_000, {
  min: 1_000,
  max: 120_000,
});

/** Cloud Agent 폴링 최대 대기(실행 루프 stale 복구 기준에도 사용) */
export const CURSOR_AGENT_MAX_POLL_MS = parseEnvPositiveIntMs(
  "CURSOR_AGENT_MAX_POLL_MS",
  45 * 60 * 1000,
  { min: 60_000, max: 24 * 60 * 60 * 1000 }
);
const MAX_POLL_MS = CURSOR_AGENT_MAX_POLL_MS;
const REQUEST_TIMEOUT_MS = 120_000;
const POLL_REQUEST_TIMEOUT_MS = 60_000;

type AgentJson = {
  id?: string;
  status?: string;
  name?: string;
  summary?: string;
  error?: string;
  target?: { branchName?: string; prUrl?: string; url?: string };
  source?: { repository?: string; ref?: string };
  commitSha?: string;
  commitHash?: string;
  headSha?: string;
  changedFiles?: string[];
  filesChanged?: string[];
  result?: { commitSha?: string; commitHash?: string; changedFiles?: string[] };
  // Some APIs may use snake_case fields; keep as unknown for debug dump.
  [k: string]: unknown;
};

function agentsBaseUrl(cursorApiUrl: string): string {
  return `${normalizeCursorApiBaseUrl(cursorApiUrl)}/v0/agents`;
}

function authHeaders(apiKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: cursorApiBasicAuthHeader(apiKey),
    "User-Agent": "JYOrchestration-cursor-agent/1",
  };
}

function pickCommitHash(agent: AgentJson): string | undefined {
  const fromResult = agent.result?.commitHash ?? agent.result?.commitSha;
  const raw =
    (typeof agent.commitHash === "string" && agent.commitHash.trim() ? agent.commitHash.trim() : "") ||
    (typeof agent.commitSha === "string" && agent.commitSha.trim() ? agent.commitSha.trim() : "") ||
    (typeof agent.headSha === "string" && agent.headSha.trim() ? agent.headSha.trim() : "") ||
    (typeof fromResult === "string" && fromResult.trim() ? fromResult.trim() : "");
  return raw || undefined;
}

function pickChangedFiles(agent: AgentJson): string[] {
  const a = agent.changedFiles ?? agent.filesChanged ?? agent.result?.changedFiles;
  if (!Array.isArray(a)) return [];
  return a.map((x) => String(x ?? "").trim()).filter(Boolean);
}

function mapAgentToResult(agent: AgentJson, fallbackBranch: string): CursorRunResult {
  const runId = typeof agent.id === "string" && agent.id.trim() ? agent.id.trim() : randomUUID();
  const branchName =
    typeof agent.target?.branchName === "string" && agent.target.branchName.trim()
      ? agent.target.branchName.trim()
      : fallbackBranch;
  const summary = (typeof agent.summary === "string" && agent.summary.trim()
    ? agent.summary
    : typeof agent.name === "string" && agent.name.trim()
      ? agent.name
      : "(Cloud Agent 요약 없음)"
  ).trim();
  const st = String(agent.status ?? "").toUpperCase();
  const failed =
    st === "FAILED" ||
    st === "ERROR" ||
    st === "CANCELLED" ||
    st === "STOPPED" ||
    st === "CANCELED";
  const err =
    typeof agent.error === "string" && agent.error.trim()
      ? agent.error.trim()
      : failed
        ? `상태: ${st || "실패"}`
        : undefined;
  const commitHash = pickCommitHash(agent);
  const changedFiles = pickChangedFiles(agent);
  const prUrlRaw =
    typeof agent.target?.prUrl === "string" && agent.target.prUrl.trim()
      ? agent.target.prUrl.trim()
      : typeof agent.target?.url === "string" && /pull\/\d+/i.test(agent.target.url)
        ? agent.target.url.trim()
        : undefined;
  return {
    runId,
    summary,
    changedFiles,
    branchName,
    commitHash,
    prUrl: prUrlRaw,
    executionStatus: failed ? "failed" : "succeeded",
    error: err,
  };
}

function agentHasPrEvidence(agent: AgentJson): boolean {
  const prUrlRaw =
    typeof agent.target?.prUrl === "string" && agent.target.prUrl.trim()
      ? agent.target.prUrl.trim()
      : typeof agent.target?.url === "string" && /pull\/\d+/i.test(agent.target.url)
        ? agent.target.url.trim()
        : "";
  return Boolean(prUrlRaw);
}

function safePreview(v: unknown, max = 240): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return null;
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function extractPrUrlCandidatesForDump(agent: AgentJson): Record<string, unknown> {
  // Do not log any auth headers/tokens. Only public-ish urls/ids.
  const t = (agent as { target?: any }).target ?? undefined;
  const targetKeys = t && typeof t === "object" ? Object.keys(t).slice(0, 30) : [];
  const candidates: Record<string, unknown> = {
    agentId: safePreview(agent.id),
    status: safePreview(agent.status),
    targetKeys,
    target_branchName: safePreview(t?.branchName ?? t?.branch_name),
    target_prUrl: safePreview(t?.prUrl ?? t?.pr_url),
    target_url: safePreview(t?.url),
    commitHash: safePreview((agent as any).commitHash ?? (agent as any).commit_hash ?? (agent as any).commitSha),
    headSha: safePreview((agent as any).headSha ?? (agent as any).head_sha),
    result_commitHash: safePreview((agent as any).result?.commitHash ?? (agent as any).result?.commit_hash),
    result_commitSha: safePreview((agent as any).result?.commitSha ?? (agent as any).result?.commit_sha),
    changedFiles_len: Array.isArray((agent as any).changedFiles) ? (agent as any).changedFiles.length : null,
    filesChanged_len: Array.isArray((agent as any).filesChanged) ? (agent as any).filesChanged.length : null,
    result_changedFiles_len: Array.isArray((agent as any).result?.changedFiles) ? (agent as any).result.changedFiles.length : null,
  };
  return candidates;
}

function shouldTreatPrAsTerminalSuccess(): boolean {
  return process.env.CURSOR_AGENT_EARLY_SUCCESS_ON_PR === "1";
}

function isTerminalSuccess(status: string): boolean {
  const s = status.toUpperCase();
  return s === "FINISHED" || s === "COMPLETED" || s === "DONE";
}

function isTerminalFailure(status: string): boolean {
  const s = status.toUpperCase();
  return (
    s === "FAILED" ||
    s === "ERROR" ||
    s === "CANCELLED" ||
    s === "CANCELED" ||
    s === "STOPPED"
  );
}

export async function executeCursorRun(params: ExecuteCursorRelayParams): Promise<ExecuteCursorRunOutcome> {
  const logs: string[] = [];
  const setup = params.executionSetup;
  const t = params.task;

  if (process.env.EXECUTION_LOOP_STUB_CURSOR === "1") {
    console.warn("[cursor-adapter] EXECUTION_LOOP_STUB_CURSOR=1 — 실제 Cursor API를 호출하지 않습니다.", {
      repo: repoDisplayForGitError(setup.gitRepoUrl),
      branch: setup.baseBranch.trim(),
      taskId: params.task.id,
    });
    const result: CursorRunResult = {
      runId: `stub-${randomUUID()}`,
      summary: "[STUB] Cursor 실행 생략 — EXECUTION_LOOP_STUB_CURSOR=1",
      changedFiles: [],
      branchName: params.suggestedBranchName,
      prUrl: undefined,
      executionStatus: "succeeded",
    };
    logs.push(result.summary);
    return { ok: true, result, logs };
  }

  const base = normalizeCursorApiBaseUrl(setup.cursorApiUrl);
  const apiKey = setup.cursorApiToken?.trim();
  if (!apiKey) {
    console.error("[cursor-adapter] missing cursorApiToken — Execution setup에 API 키를 저장해야 합니다.");
    return {
      ok: false,
      error: "Cursor API 설정이 필요합니다. Execution setup에 Cursor API 키를 저장하세요.",
      logs,
    };
  }

  const executionPromptText = [
    params.prompt,
    params.allowedPaths?.length
      ? `\n\n[허용 경로 glob]\n${params.allowedPaths.join("\n")}`
      : "",
    `\n\n[정책] autoCommit=${setup.autoCommit}, requireTestsBeforePush=${setup.requireTestsBeforePush}`,
  ]
    .filter(Boolean)
    .join("");

  const payloadPre = validateCursorAgentLaunchPayload({
    gitRepoUrl: setup.gitRepoUrl,
    baseBranch: setup.baseBranch,
    targetBranchName: params.suggestedBranchName,
    promptText: executionPromptText,
  });
  if (!payloadPre.ok) {
    logs.push("[cursor-adapter] Cloud Agent 페이로드 사전 검증 실패(Git 검증 전)");
    return { ok: false, error: payloadPre.message, logs };
  }

  const branchCtx = { gitRepoUrl: setup.gitRepoUrl, baseBranch: setup.baseBranch };
  const preBranch = await verifyBaseBranchBeforeCursorExecution({
    gitRepoUrl: setup.gitRepoUrl,
    baseBranch: setup.baseBranch,
  });
  if (!preBranch.ok) {
    logs.push("[cursor-adapter] base branch 사전 검증 실패");
    return { ok: false, error: preBranch.message, logs };
  }

  console.info("[cursor-adapter] Cloud Agent 요청 준비", {
    repo: repoDisplayForGitError(setup.gitRepoUrl),
    branch: setup.baseBranch.trim(),
    taskId: params.task.id,
  });

  const launchUrl = agentsBaseUrl(base);
  const body = {
    prompt: {
      text: executionPromptText,
    },
    model: "default" as const,
    source: {
      repository: setup.gitRepoUrl.trim(),
      ref: setup.baseBranch.trim(),
    },
    target: {
      branchName: params.suggestedBranchName,
      // 정책: Cursor는 PR 생성/merge를 담당하지 않는다 (SCM Manager가 수행).
      autoCreatePr: false,
      openAsCursorGithubApp: false,
      skipReviewerRequest: false,
    },
  };

  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), REQUEST_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(launchUrl, {
        method: "POST",
        headers: authHeaders(apiKey),
        body: JSON.stringify(body),
        redirect: "follow",
        signal: ac.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    const launchText = await res.text();
    logs.push(`POST ${launchUrl} → HTTP ${res.status}`);
    let launchJson: AgentJson | null = null;
    try {
      launchJson = JSON.parse(launchText) as AgentJson;
    } catch {
      logs.push(launchText.slice(0, 2000));
    }

    if (!res.ok) {
      const raw = launchJson?.error
        ? String(launchJson.error)
        : `Cloud Agent 시작 실패 HTTP ${res.status}`;
      return {
        ok: false,
        error: enhanceCursorErrorIfBaseBranchRelated(raw, branchCtx),
        logs,
      };
    }

    const agentId = launchJson?.id?.trim();
    if (!agentId) {
      return { ok: false, error: "Cloud Agent 응답에 id가 없습니다.", logs };
    }

    if (isTaskProgressLogEnabled()) {
      appendTaskProgressLog({
        kind: "cursor",
        phase: "agent_launched",
        projectId: params.projectId,
        taskId: params.task.id,
        detail: { agentId, branch: params.suggestedBranchName },
      });
      appendTaskProgressLog({
        kind: "cursor",
        phase: "cursor_agent_launched",
        projectId: params.projectId,
        taskId: params.task.id,
        detail: { agentId, branch: params.suggestedBranchName },
      });
    }

    const started = Date.now();
    let last: AgentJson = launchJson ?? {};
    let pollRound = 0;
    console.info("[cursor-adapter] agent poll schedule", {
      agentId,
      firstDelayMs: POLL_FIRST_DELAY_MS,
      intervalMs: POLL_INTERVAL_MS,
      maxWaitMs: MAX_POLL_MS,
    });

    if (isTaskProgressLogEnabled()) {
      appendTaskProgressLog({
        kind: "cursor",
        phase: "poll_started",
        projectId: params.projectId,
        taskId: params.task.id,
        detail: { agentId, maxWaitMs: MAX_POLL_MS, firstDelayMs: POLL_FIRST_DELAY_MS, intervalMs: POLL_INTERVAL_MS },
      });
    }

    while (Date.now() - started < MAX_POLL_MS) {
      const prePollDelayMs = pollRound === 0 ? POLL_FIRST_DELAY_MS : POLL_INTERVAL_MS;
      await new Promise((r) => setTimeout(r, prePollDelayMs));
      pollRound += 1;

      const pollAc = new AbortController();
      const pollTimer = setTimeout(() => pollAc.abort(), POLL_REQUEST_TIMEOUT_MS);
      let pollRes: Response;
      try {
        pollRes = await fetch(`${launchUrl}/${encodeURIComponent(agentId)}`, {
          method: "GET",
          headers: authHeaders(apiKey),
          redirect: "follow",
          signal: pollAc.signal,
        });
      } catch (e) {
        clearTimeout(pollTimer);
        const msg = e instanceof Error ? e.message : String(e);
        logs.push(`poll error: ${msg}`);
        return {
          ok: false,
          error: enhanceCursorErrorIfBaseBranchRelated(`상태 조회 실패: ${msg}`, branchCtx),
          logs,
        };
      } finally {
        clearTimeout(pollTimer);
      }

      const pollText = await pollRes.text();
      try {
        last = JSON.parse(pollText) as AgentJson;
      } catch {
        logs.push(`poll non-JSON: ${pollText.slice(0, 500)}`);
        return { ok: false, error: enhanceCursorErrorIfBaseBranchRelated("상태 응답 파싱 실패", branchCtx), logs };
      }

      const st = String(last.status ?? "").toUpperCase();
      logs.push(`agent ${agentId} status=${st}`);
      if (isTaskProgressCursorPollEnabled()) {
        appendTaskProgressLog({
          kind: "cursor",
          phase: "agent_poll",
          projectId: params.projectId,
          taskId: params.task.id,
          detail: {
            agentId,
            status: st,
            pollRound,
          },
        });
      }
      if (isTaskProgressCursorPollDumpEnabled()) {
        appendTaskProgressLog({
          kind: "cursor",
          phase: "agent_poll_dump",
          projectId: params.projectId,
          taskId: params.task.id,
          detail: {
            pollRound,
            // Only small, safe subset for debugging PR/commit mapping.
            ...extractPrUrlCandidatesForDump(last),
          },
        });
      }

      if (isTerminalFailure(st)) {
        const r = mapAgentToResult(last, params.suggestedBranchName);
        const raw = r.error || r.summary || "Cloud Agent 실패";
        return {
          ok: false,
          error: enhanceCursorErrorIfBaseBranchRelated(raw, branchCtx),
          logs,
        };
      }

      // 일부 케이스에서 Cursor가 PR/commit을 이미 만들었는데 status가 RUNNING으로 오래 유지될 수 있다.
      // 이 모드에서는 PR(또는 commit hash) 증거가 있으면 조기 성공으로 처리한다(옵트인).
      if (!isTerminalSuccess(st) && shouldTreatPrAsTerminalSuccess()) {
        const hasPr = agentHasPrEvidence(last);
        const hasCommit = Boolean(pickCommitHash(last));
        if (hasPr || hasCommit) {
          const r = mapAgentToResult(last, params.suggestedBranchName);
          if (isTaskProgressLogEnabled()) {
            appendTaskProgressLog({
              kind: "cursor",
              phase: "commit_detected",
              projectId: params.projectId,
              taskId: params.task.id,
              detail: { commitHash: r.commitHash ?? null },
            });
            appendTaskProgressLog({
              kind: "cursor",
              phase: "push_detected",
              projectId: params.projectId,
              taskId: params.task.id,
              detail: { changedFileCount: r.changedFiles?.length ?? 0 },
            });
            appendTaskProgressLog({
              kind: "cursor",
              phase: "pr_detected",
              projectId: params.projectId,
              taskId: params.task.id,
              detail: { prUrl: r.prUrl ?? null },
            });
            appendTaskProgressLog({
              kind: "cursor",
              phase: "agent_early_success",
              projectId: params.projectId,
              taskId: params.task.id,
              detail: { agentId, status: st, pollRound, hasPr, hasCommit, prUrl: r.prUrl ?? null },
            });
          }
          return { ok: true, result: r, logs };
        }
      }

      if (isTerminalSuccess(st)) {
        const r = mapAgentToResult(last, params.suggestedBranchName);
        if (r.executionStatus === "failed" || r.error) {
          const raw = r.error || r.summary || "Cloud Agent 실패";
          return { ok: false, error: enhanceCursorErrorIfBaseBranchRelated(raw, branchCtx), logs };
        }
        if (isTaskProgressLogEnabled()) {
          appendTaskProgressLog({
            kind: "cursor",
            phase: "commit_detected",
            projectId: params.projectId,
            taskId: params.task.id,
            detail: { commitHash: r.commitHash ?? null },
          });
          appendTaskProgressLog({
            kind: "cursor",
            phase: "push_detected",
            projectId: params.projectId,
            taskId: params.task.id,
            detail: { changedFileCount: r.changedFiles?.length ?? 0 },
          });
          appendTaskProgressLog({
            kind: "cursor",
            phase: "pr_detected",
            projectId: params.projectId,
            taskId: params.task.id,
            detail: { prUrl: r.prUrl ?? null },
          });
        }
        return { ok: true, result: r, logs };
      }
    }

    if (isTaskProgressLogEnabled()) {
      appendTaskProgressLog({
        kind: "cursor",
        phase: "agent_poll_timeout",
        projectId: params.projectId,
        taskId: params.task.id,
        detail: { agentId, maxWaitMs: MAX_POLL_MS },
      });
    }
    return {
      ok: false,
      error: enhanceCursorErrorIfBaseBranchRelated(
        "Cloud Agent 응답 시간 초과(폴링 한도). 대시보드에서 상태를 확인하세요.",
        branchCtx
      ),
      logs,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logs.push(`fetch error: ${msg}`);
    return { ok: false, error: enhanceCursorErrorIfBaseBranchRelated(msg, branchCtx), logs };
  }
}
