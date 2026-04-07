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
import {
  appendTaskProgressLog,
  isTaskProgressCursorPollEnabled,
  isTaskProgressCursorPollDumpEnabled,
  isTaskProgressLogEnabled,
} from "@/lib/observability/taskProgressLog";
import { cursorApiBasicAuthHeader, normalizeCursorApiBaseUrl } from "@/lib/executionSetup/cursorApiValidation";
import type { LoopStepRecord, RunExecutionLoopResult } from "@/lib/executionLoop/runLoopTypes";

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
/** ENV_TEST: Stage1/Stage2 오케스트레이션은 adapter 밖에서 수행 */
  taskKind?: string | null;
  githubAccessToken?: string | null;
  /**
   * ENV_TEST only: Cursor 폴링 중 ahead_by 확인 시 즉시 PR_OPENED까지 마무리하고 루프 결과를 반환한다.
   */
  envTestPollFinalizeContext?: {
    execRunId: string;
    actorUserId: string;
    taskId: string;
    repoUrl: string;
    baseBranch: string;
    githubAccessToken: string | null;
    steps: LoopStepRecord[];
    singleTaskId?: string;
    effectiveAutoAdvance: boolean;
    execRunCreatedAt: Date;
  } | null;
  /**
   * ENV_TEST(Stage 1·2) 공통: validationOutput.stage2RuntimeMonitor — Git 반영·병목 관측.
   * 키 이름은 호환용이며 Stage 1 동일 파이프라인에서도 사용한다.
   */
  stage2RuntimeMonitor?: {
    execRunId: string;
    projectId: string;
    taskId: string;
    actorUserId?: string;
  } | null;
};

export type ExecuteCursorRunOutcome =
  | { ok: true; result: CursorRunResult; logs: string[] }
  | {
      ok: true;
      envTestGithubEarlyFinished: true;
      envTestFinalizeOutcome:
        | { kind: "return"; result: RunExecutionLoopResult }
        | { kind: "continue_loop" };
      logs: string[];
    }
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

function parseEnvPositiveInt(
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

// NOTE: Stage1/Stage2 GitHub probing/finalize/telemetry helpers were removed from adapter.

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

/**
 * Low-level Cursor agent JSON payload.
 * Exported for Stage2 orchestrators that want pure launch/poll without adapter-owned orchestration.
 */
export type CursorAgentJson = AgentJson;

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

function pickHeadSha(agent: AgentJson): string | undefined {
  const raw =
    (typeof agent.headSha === "string" && agent.headSha.trim() ? agent.headSha.trim() : "") ||
    (typeof (agent as { head_sha?: unknown }).head_sha === "string" &&
    String((agent as { head_sha?: unknown }).head_sha).trim()
      ? String((agent as { head_sha?: unknown }).head_sha).trim()
      : "") ||
    pickCommitHash(agent) ||
    "";
  return raw || undefined;
}

function pickChangedFiles(agent: AgentJson): string[] {
  const a = agent.changedFiles ?? agent.filesChanged ?? agent.result?.changedFiles;
  if (!Array.isArray(a)) return [];
  return a.map((x) => String(x ?? "").trim()).filter(Boolean);
}

/** Map Cursor agent state to minimal execution result (pure parsing). */
export function mapAgentToResult(agent: AgentJson, fallbackBranch: string): CursorRunResult {
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

/**
 * Low-level executor API: launch a Cursor agent and return its id + initial JSON.
 * - No GitHub compare
 * - No PR creation
 * - No Stage1/Stage2 finalize
 * - No orchestration decisions
 *
 * IMPORTANT: `executeCursorRun()` remains the Stage1-compatible higher-level path.
 */
export async function launchCursorAgent(params: ExecuteCursorRelayParams): Promise<
  | { ok: true; agentId: string; launchJson: CursorAgentJson; launchUrl: string; logs: string[] }
  | { ok: false; error: string; logs: string[] }
> {
  const logs: string[] = [];
  const setup = params.executionSetup;
  const branchCtx = { gitRepoUrl: setup.gitRepoUrl, baseBranch: setup.baseBranch };
  const base = normalizeCursorApiBaseUrl(setup.cursorApiUrl);
  const apiKey = setup.cursorApiToken?.trim();
  if (!apiKey) {
    return { ok: false, error: "Cursor API 설정이 필요합니다. Execution setup에 Cursor API 키를 저장하세요.", logs };
  }

  const executionPromptText = [
    params.prompt,
    params.allowedPaths?.length ? `\n\n[허용 경로 glob]\n${params.allowedPaths.join("\n")}` : "",
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

  const launchUrl = agentsBaseUrl(base);
  const body = {
    prompt: { text: executionPromptText },
    model: "default" as const,
    source: { repository: setup.gitRepoUrl.trim(), ref: setup.baseBranch.trim() },
    target: {
      branchName: params.suggestedBranchName,
      // 정책: Cursor는 PR 생성/merge를 담당하지 않는다 (플랫폼/Stage2 SCM 경로가 수행).
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
      const raw = launchJson?.error ? String(launchJson.error) : `Cloud Agent 시작 실패 HTTP ${res.status}`;
      return { ok: false, error: enhanceCursorErrorIfBaseBranchRelated(raw, branchCtx), logs };
    }

    const agentId = launchJson?.id?.trim();
    if (!agentId || !launchJson) {
      return { ok: false, error: "Cloud Agent 응답에 id가 없습니다.", logs };
    }
    return { ok: true, agentId, launchJson, launchUrl, logs };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: enhanceCursorErrorIfBaseBranchRelated(`Cursor 에이전트 시작 실패: ${msg}`, branchCtx), logs };
  }
}

/**
 * Low-level executor API: poll a Cursor agent once.
 * Pure HTTP+parse; no GitHub/PR logic.
 */
export async function pollCursorAgent(input: {
  cursorApiUrl: string;
  cursorApiToken: string;
  agentId: string;
  fallbackBranchName: string;
}): Promise<
  | {
      ok: true;
      agentJson: CursorAgentJson;
      statusUpper: string;
      result: CursorRunResult;
      hints: { commitHash?: string; headSha?: string; changedFiles: string[]; prUrl?: string };
    }
  | { ok: false; error: string }
> {
  const base = normalizeCursorApiBaseUrl(input.cursorApiUrl);
  const url = `${agentsBaseUrl(base)}/${encodeURIComponent(input.agentId)}`;
  const pollAc = new AbortController();
  const pollTimer = setTimeout(() => pollAc.abort(), POLL_REQUEST_TIMEOUT_MS);
  let pollRes: Response;
  try {
    pollRes = await fetch(url, {
      method: "GET",
      headers: authHeaders(input.cursorApiToken),
      redirect: "follow",
      signal: pollAc.signal,
    });
  } finally {
    clearTimeout(pollTimer);
  }
  const pollText = await pollRes.text();
  let agentJson: AgentJson;
  try {
    agentJson = JSON.parse(pollText) as AgentJson;
  } catch {
    return { ok: false, error: "상태 응답 파싱 실패" };
  }
  const statusUpper = String(agentJson.status ?? "").toUpperCase();
  const commitHash = pickCommitHash(agentJson);
  const headSha = pickHeadSha(agentJson);
  const changedFiles = pickChangedFiles(agentJson);
  const r = mapAgentToResult(agentJson, input.fallbackBranchName);
  return {
    ok: true,
    agentJson,
    statusUpper,
    result: r,
    hints: { commitHash, headSha, changedFiles, prUrl: r.prUrl },
  };
}

// NOTE: ENV_TEST(Stage1/2) GitHub/PR/finalize logic has been extracted out of this adapter.

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
    }

    const started = Date.now();
    const maxPollMsEffective = MAX_POLL_MS;
    let last: AgentJson = launchJson ?? {};
    let completedAgentPolls = 0;

    console.info("[cursor-adapter] agent poll schedule", {
      agentId,
      firstDelayMs: POLL_FIRST_DELAY_MS,
      intervalMs: POLL_INTERVAL_MS,
      maxWaitMs: maxPollMsEffective,
    });

    if (isTaskProgressLogEnabled()) {
      appendTaskProgressLog({
        kind: "cursor",
        phase: "poll_started",
        projectId: params.projectId,
        taskId: params.task.id,
        detail: {
          agentId,
          maxWaitMs: maxPollMsEffective,
          firstDelayMs: POLL_FIRST_DELAY_MS,
          intervalMsNote: POLL_INTERVAL_MS,
        },
      });
    }

    while (Date.now() - started < maxPollMsEffective) {
      const prePollDelayMs = completedAgentPolls === 0 ? POLL_FIRST_DELAY_MS : POLL_INTERVAL_MS;
      await new Promise((r) => setTimeout(r, prePollDelayMs));

      const polled = await pollCursorAgent({
        cursorApiUrl: base,
        cursorApiToken: apiKey,
        agentId,
        fallbackBranchName: params.suggestedBranchName,
      });
      if (!polled.ok) {
        return {
          ok: false,
          error: enhanceCursorErrorIfBaseBranchRelated(`상태 조회 실패: ${polled.error}`, branchCtx),
          logs,
        };
      }

      last = polled.agentJson as AgentJson;
      const st = String(last.status ?? "").toUpperCase();
      completedAgentPolls += 1;
      const commitHashHint = polled.hints.commitHash ?? null;
      const headShaHint = polled.hints.headSha ?? null;
      const changedFilesNow = polled.hints.changedFiles ?? [];
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
            pollRound: completedAgentPolls,
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
      const timeoutPhase = maxPollMsEffective === 300_000 ? "agent_poll_timeout_5m" : "agent_poll_timeout";
      appendTaskProgressLog({
        kind: "cursor",
        phase: timeoutPhase,
        projectId: params.projectId,
        taskId: params.task.id,
        detail: {
          agentId,
          maxWaitMs: maxPollMsEffective,
        },
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
