/**
 * Relay: 유일한 정상 실행 경로 — HTTP로 Cursor(Background Agent)에 위임.
 * 클론/브랜치/커밋/푸시는 Cursor·GitHub 측 책임.
 *
 * POST {cursorApiUrl}/task-execute
 */

import { randomUUID } from "node:crypto";

/** Cursor 실행기가 돌려주는 결과(플랫폼은 로컬 git/diff 없음). */
export type CursorRunResult = {
  runId: string;
  summary: string;
  changedFiles: string[];
  branchName: string;
  commitHash?: string;
  /** 실행기가 명시한 논리 상태(선택) */
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
  requireTestsBeforePush: boolean;
};

export type RelayTaskSlice = {
  id: string;
  title: string;
  description: string | null;
  acceptanceCriteria: string[];
};

/** 단일 진입점: task + execution setup + 프롬프트. */
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

function joinExecuteUrl(baseUrl: string): string {
  const b = baseUrl.trim().replace(/\/+$/, "");
  if (!b) return "";
  return `${b}/task-execute`;
}

function parseRunResult(parsed: Record<string, unknown> | null, fallbackBranch: string): CursorRunResult | null {
  if (!parsed) return null;
  const ok = parsed.ok !== false && parsed.success !== false;
  if (!ok) return null;
  const runId = typeof parsed.runId === "string" && parsed.runId.trim() ? parsed.runId.trim() : randomUUID();
  const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";
  const cf = Array.isArray(parsed.changedFiles)
    ? (parsed.changedFiles as unknown[]).map((x) => String(x)).filter(Boolean)
    : [];
  const branchName =
    typeof parsed.branchName === "string" && parsed.branchName.trim()
      ? parsed.branchName.trim()
      : fallbackBranch;
  const commitHash =
    typeof parsed.commitHash === "string"
      ? parsed.commitHash.trim()
      : typeof parsed.commitSha === "string"
        ? parsed.commitSha.trim()
        : undefined;
  const executionStatus =
    typeof parsed.executionStatus === "string" ? parsed.executionStatus.trim() : undefined;
  const error = typeof parsed.error === "string" ? parsed.error.trim() : undefined;
  return {
    runId,
    summary: summary || "(no summary from executor)",
    changedFiles: cf,
    branchName,
    commitHash: commitHash || undefined,
    executionStatus,
    error,
  };
}

export async function executeCursorRun(params: ExecuteCursorRelayParams): Promise<ExecuteCursorRunOutcome> {
  const logs: string[] = [];
  const setup = params.executionSetup;
  const t = params.task;

  if (process.env.EXECUTION_LOOP_STUB_CURSOR === "1") {
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

  const url = joinExecuteUrl(setup.cursorApiUrl);
  if (!url) {
    return { ok: false, error: "empty cursorApiUrl", logs };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "JYOrchestration-relay/1",
  };
  const tok = setup.cursorApiToken?.trim();
  if (tok) headers.Authorization = `Bearer ${tok}`;

  const body = JSON.stringify({
    mode: "relay",
    projectId: params.projectId,
    workflowId: params.workflowId ?? undefined,
    taskId: t.id,
    title: t.title,
    description: t.description ?? "",
    acceptanceCriteria: t.acceptanceCriteria,
    gitRepoUrl: setup.gitRepoUrl.trim(),
    baseBranch: setup.baseBranch.trim(),
    branchStrategy: setup.branchStrategy,
    branchPrefix: setup.branchPrefix,
    suggestedBranchName: params.suggestedBranchName,
    prompt: params.prompt,
    policy: {
      autoCommit: setup.autoCommit,
      autoPush: setup.autoPush,
      requireTestsBeforePush: setup.requireTestsBeforePush,
    },
    allowedPaths: params.allowedPaths,
  });

  try {
    const res = await fetch(url, { method: "POST", headers, body, redirect: "follow" });
    const text = await res.text();
    logs.push(`HTTP ${res.status} ${url}`);
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      logs.push(text.slice(0, 2000));
    }
    if (!res.ok) {
      return {
        ok: false,
        error: parsed?.error ? String(parsed.error) : `HTTP ${res.status}`,
        logs,
      };
    }
    const result = parseRunResult(parsed, params.suggestedBranchName);
    if (!result) {
      return {
        ok: false,
        error: String(parsed?.error ?? "executor reported failure"),
        logs,
      };
    }
    if (result.executionStatus === "failed" || (result.error && result.error.length > 0)) {
      return {
        ok: false,
        error: result.error || "executor reported executionStatus failed",
        logs,
      };
    }
    const lg = Array.isArray(parsed?.logs) ? (parsed.logs as unknown[]).map((x) => String(x)) : [];
    logs.push(...lg);
    return { ok: true, result, logs };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logs.push(`fetch error: ${msg}`);
    return { ok: false, error: msg, logs };
  }
}
