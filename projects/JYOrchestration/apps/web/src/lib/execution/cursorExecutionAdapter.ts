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
import { cursorApiBasicAuthHeader, normalizeCursorApiBaseUrl } from "@/lib/executionSetup/cursorApiValidation";

/** Cursor 실행 결과(플랫폼은 로컬 git/diff 없음). */
export type CursorRunResult = {
  runId: string;
  summary: string;
  changedFiles: string[];
  branchName: string;
  commitHash?: string;
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

const POLL_INTERVAL_MS = 10_000;
const MAX_POLL_MS = 45 * 60 * 1000;
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
  return {
    runId,
    summary,
    changedFiles,
    branchName,
    commitHash,
    executionStatus: failed ? "failed" : "succeeded",
    error: err,
  };
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
      autoCreatePr: setup.autoPr === true || setup.autoPush === true,
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

    const started = Date.now();
    let last: AgentJson = launchJson ?? {};

    while (Date.now() - started < MAX_POLL_MS) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

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
        return { ok: true, result: r, logs };
      }
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
