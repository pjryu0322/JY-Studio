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
import { runEnvTestAfterGithubPushConfirmed } from "@/lib/executionLoop/envTestExecutionHelpers";
import type { LoopStepRecord, RunExecutionLoopResult } from "@/lib/executionLoop/runLoopTypes";
import { fetchGithubBranchHeadExists, fetchGithubCompareSnapshot } from "@/lib/service/githubCompareService";
import { findOpenPullRequestByHeadBranch } from "@/lib/service/githubOpenPullRequestByHeadService";

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
  /** ENV_TEST: GitHub compare / 열린 PR 확인으로 Cursor 터미널 대기 단축 */
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

/** ENV_TEST 전용: 첫 Cursor 폴링 전 짧은 대기(기본 400ms). GitHub 프로브는 별도로 더 일찍 시도한다. */
const ENV_TEST_POLL_FIRST_DELAY_MS = parseEnvPositiveIntMs("CURSOR_AGENT_ENV_TEST_POLL_FIRST_DELAY_MS", 400, {
  min: 0,
  max: 60_000,
});
/** ENV_TEST: 런치 직후 GitHub compare 시도 전 최소 지연 (기본 250ms). */
const ENV_TEST_POST_LAUNCH_GITHUB_PROBE_DELAY_MS = parseEnvPositiveIntMs(
  "CURSOR_ENV_TEST_POST_LAUNCH_GITHUB_PROBE_DELAY_MS",
  250,
  { min: 0, max: 30_000 }
);

/** ENV_TEST: 폴링 간격 단계(경과 ms 기준). */
const ENV_TEST_POLL_FAST_WINDOW_MS = parseEnvPositiveIntMs("CURSOR_ENV_TEST_POLL_FAST_WINDOW_MS", 15_000, {
  min: 5_000,
  max: 120_000,
});
const ENV_TEST_POLL_MID_WINDOW_MS = parseEnvPositiveIntMs("CURSOR_ENV_TEST_POLL_MID_WINDOW_MS", 40_000, {
  min: 15_000,
  max: 300_000,
});
const ENV_TEST_POLL_INTERVAL_FAST_MS = parseEnvPositiveIntMs("CURSOR_ENV_TEST_POLL_INTERVAL_FAST_MS", 1_000, {
  min: 500,
  max: 5_000,
});
const ENV_TEST_POLL_INTERVAL_MID_MS = parseEnvPositiveIntMs("CURSOR_ENV_TEST_POLL_INTERVAL_MID_MS", 2_000, {
  min: 1_000,
  max: 8_000,
});
const ENV_TEST_POLL_INTERVAL_SLOW_MS = parseEnvPositiveIntMs("CURSOR_ENV_TEST_POLL_INTERVAL_SLOW_MS", 3_000, {
  min: 1_000,
  max: 10_000,
});

function envTestCursorPollIntervalMs(elapsedSincePollLoopStartMs: number): number {
  const e = Math.max(0, elapsedSincePollLoopStartMs);
  if (e < ENV_TEST_POLL_FAST_WINDOW_MS) return ENV_TEST_POLL_INTERVAL_FAST_MS;
  if (e < ENV_TEST_POLL_MID_WINDOW_MS) return ENV_TEST_POLL_INTERVAL_MID_MS;
  return ENV_TEST_POLL_INTERVAL_SLOW_MS;
}

/** ENV_TEST: GitHub 전체 마무리(compare→PR) 시도 전 최소 완료 폴링 횟수. 기본 0(즉시 시도 가능). */
const ENV_TEST_EARLY_FULL_MIN_POLL_ROUNDS = parseEnvPositiveInt(
  "CURSOR_ENV_TEST_EARLY_FULL_MIN_POLL_ROUNDS",
  0,
  { min: 0, max: 500 }
);
/** ENV_TEST: 위와 OR — 런 시작 후 경과 ms. 기본 0(워밍업은 GitHub 프로브 쪽에서만 짧게 둠). */
const ENV_TEST_EARLY_FULL_MIN_MS = parseEnvPositiveIntMs("CURSOR_ENV_TEST_EARLY_FULL_MIN_MS", 0, {
  min: 0,
  max: 300_000,
});

function envTestAllowEarlyGithubFullFinalize(agentPollCount: number, pollStartedAt: number): boolean {
  return (
    agentPollCount >= ENV_TEST_EARLY_FULL_MIN_POLL_ROUNDS ||
    Date.now() - pollStartedAt >= ENV_TEST_EARLY_FULL_MIN_MS
  );
}

/** compare/브랜치 프로브 전: 완료된 Cursor 폴링 N회 이상 또는 런치 후 M ms 경과(OR). ENV_TEST 기본 0회 / 350ms. */
const ENV_TEST_GITHUB_COMPARE_MIN_COMPLETED_POLLS = parseEnvPositiveInt(
  "CURSOR_ENV_TEST_GITHUB_COMPARE_MIN_COMPLETED_POLLS",
  0,
  { min: 0, max: 100 }
);
const ENV_TEST_GITHUB_COMPARE_MIN_MS_AFTER_LAUNCH = parseEnvPositiveIntMs(
  "CURSOR_ENV_TEST_GITHUB_COMPARE_MIN_MS_AFTER_LAUNCH",
  350,
  { min: 0, max: 300_000 }
);

/** ENV_TEST: branch/compare 404 5회차 이후 백오프 상한(기본 5초, 10초 금지). */
const ENV_TEST_COMPARE_404_BACKOFF_CAP_MS = parseEnvPositiveIntMs(
  "CURSOR_ENV_TEST_COMPARE_404_BACKOFF_CAP_MS",
  5_000,
  { min: 1_000, max: 10_000 }
);

function envTestCompare404BackoffDelayMs(zeroBasedAttemptIndex: number): number {
  const steps = [1_000, 2_000, 3_000, 4_000];
  const i = Math.max(0, zeroBasedAttemptIndex);
  if (i < steps.length) return steps[i];
  return ENV_TEST_COMPARE_404_BACKOFF_CAP_MS;
}

/** ENV_TEST-only: GitHub compare 시도 간격·404 백오프·브랜치 최초 확인 시각. */
type EnvTestGithubProbeState = {
  agentLaunchStartedAt: number;
  nextGithubCompareAllowedAt: number;
  compare404AttemptIndex: number;
  branchConfirmedAtMs: number | null;
  warmupLogged?: boolean;
};

function envTestAllowGithubHeadProbe(
  state: EnvTestGithubProbeState,
  completedAgentPolls: number
): { ok: true } | { ok: false; reason: "warmup" | "backoff"; retryAfterMs?: number } {
  const elapsed = Date.now() - state.agentLaunchStartedAt;
  const warmupDone =
    completedAgentPolls >= ENV_TEST_GITHUB_COMPARE_MIN_COMPLETED_POLLS ||
    elapsed >= ENV_TEST_GITHUB_COMPARE_MIN_MS_AFTER_LAUNCH;
  if (!warmupDone) {
    return { ok: false, reason: "warmup" };
  }
  const now = Date.now();
  if (now < state.nextGithubCompareAllowedAt) {
    return {
      ok: false,
      reason: "backoff",
      retryAfterMs: Math.max(0, state.nextGithubCompareAllowedAt - now),
    };
  }
  return { ok: true };
}

function envTestApplyGithubProbe404Backoff(
  state: EnvTestGithubProbeState,
  logCtx: {
    projectId: string;
    taskId: string;
    userId?: string;
    headBranch: string;
    source: string;
  },
  httpStatus: number | undefined
): void {
  const idx = state.compare404AttemptIndex;
  const delayMs = envTestCompare404BackoffDelayMs(idx);
  state.compare404AttemptIndex = idx + 1;
  state.nextGithubCompareAllowedAt = Date.now() + delayMs;
  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_compare_backoff_applied",
    projectId: logCtx.projectId,
    taskId: logCtx.taskId,
    userId: logCtx.userId,
    detail: {
      headBranch: logCtx.headBranch,
      delayMs,
      attemptIndexAfter: state.compare404AttemptIndex,
      httpStatus: httpStatus ?? null,
      source: logCtx.source,
    },
  });
}

/**
 * ENV_TEST-only: 브랜치 존재 → compare → ahead_by>0 까지. 실패 시 null(백오프는 state 갱신).
 */
async function envTestProbeGithubAheadByCompare(input: {
  projectId: string;
  taskId: string;
  userId?: string;
  repoUrl: string;
  baseBranch: string;
  headBranch: string;
  githubAccessToken: string | null | undefined;
  probeState: EnvTestGithubProbeState;
  completedAgentPolls: number;
  agentPollCountForLog: number;
  logSource: string;
}): Promise<
  | null
  | {
      data: {
        headSha: string | null;
        changedFiles: string[];
        diffSummary: string;
        aheadBy: number;
        behindBy: number;
        compareStatus: string;
      };
      elapsedMsLaunchToBranchConfirmed: number;
      elapsedMsBranchConfirmedToCompareOk: number;
      compareOkAtMs: number;
    }
> {
  const gate = envTestAllowGithubHeadProbe(input.probeState, input.completedAgentPolls);
  if (!gate.ok) {
    if (gate.reason === "warmup") {
      if (!input.probeState.warmupLogged) {
        input.probeState.warmupLogged = true;
        appendTaskProgressLog({
          kind: "execution",
          phase: "env_test_warmup_before_branch_check",
          projectId: input.projectId,
          taskId: input.taskId,
          userId: input.userId,
          detail: {
            headBranch: input.headBranch,
            elapsedMsSinceLaunch: Date.now() - input.probeState.agentLaunchStartedAt,
            warmupTargetMs: ENV_TEST_GITHUB_COMPARE_MIN_MS_AFTER_LAUNCH,
            minCompletedAgentPolls: ENV_TEST_GITHUB_COMPARE_MIN_COMPLETED_POLLS,
            completedAgentPolls: input.completedAgentPolls,
            source: input.logSource,
          },
        });
      }
      return null;
    }

    appendTaskProgressLog({
      kind: "execution",
      phase: "env_test_compare_retry_skipped_due_to_backoff",
      projectId: input.projectId,
      taskId: input.taskId,
      userId: input.userId,
      detail: {
        reason: gate.reason,
        retryAfterMs: gate.retryAfterMs ?? null,
        completedAgentPolls: input.completedAgentPolls,
        agentPollCountForLog: input.agentPollCountForLog,
        elapsedMsSinceLaunch: Date.now() - input.probeState.agentLaunchStartedAt,
        source: input.logSource,
      },
    });
    return null;
  }

  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_early_github_check_started",
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.userId,
    detail: {
      headBranch: input.headBranch,
      completedAgentPolls: input.completedAgentPolls,
      elapsedMsSinceLaunch: Date.now() - input.probeState.agentLaunchStartedAt,
      source: input.logSource,
    },
  });

  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_branch_exists_check_started",
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.userId,
    detail: {
      headBranch: input.headBranch,
      elapsedMsSinceLaunch: Date.now() - input.probeState.agentLaunchStartedAt,
      source: input.logSource,
    },
  });

  const branchRes = await fetchGithubBranchHeadExists({
    repoUrl: input.repoUrl,
    branch: input.headBranch,
    githubAccessToken: input.githubAccessToken ?? null,
    projectId: input.projectId,
    allowUnauthenticated: true,
  });

  if (!branchRes.ok) {
    if (branchRes.httpStatus === 404) {
      envTestApplyGithubProbe404Backoff(
        input.probeState,
        {
          projectId: input.projectId,
          taskId: input.taskId,
          userId: input.userId,
          headBranch: input.headBranch,
          source: `${input.logSource}:branch_ref`,
        },
        404
      );
    }
    return null;
  }

  const branchConfirmedAt = Date.now();
  if (input.probeState.branchConfirmedAtMs == null) {
    input.probeState.branchConfirmedAtMs = branchConfirmedAt;
  }
  const elapsedMsLaunchToFirstBranchConfirmed =
    input.probeState.branchConfirmedAtMs - input.probeState.agentLaunchStartedAt;

  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_branch_exists_confirmed",
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.userId,
    detail: {
      headBranch: input.headBranch,
      elapsedMsSinceLaunchToFirstBranchConfirmed: elapsedMsLaunchToFirstBranchConfirmed,
      elapsedMsSinceLaunchThisCheck: branchConfirmedAt - input.probeState.agentLaunchStartedAt,
      source: input.logSource,
    },
  });

  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_compare_started",
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.userId,
    detail: {
      baseBranch: input.baseBranch,
      headBranch: input.headBranch,
      elapsedMsSinceLaunchToBranchConfirmed: elapsedMsLaunchToFirstBranchConfirmed,
      source: input.logSource,
    },
  });

  const compare = await fetchGithubCompareSnapshot({
    repoUrl: input.repoUrl,
    base: input.baseBranch,
    head: input.headBranch,
    maxFiles: 80,
    githubAccessToken: input.githubAccessToken ?? null,
    projectId: input.projectId,
    allowUnauthenticated: true,
  });

  if (!compare.ok) {
    if (compare.httpStatus === 404) {
      envTestApplyGithubProbe404Backoff(
        input.probeState,
        {
          projectId: input.projectId,
          taskId: input.taskId,
          userId: input.userId,
          headBranch: input.headBranch,
          source: `${input.logSource}:compare`,
        },
        404
      );
    }
    return null;
  }

  if (compare.data.aheadBy <= 0) {
    return null;
  }

  const compareOkAt = Date.now();
  const elapsedMsBranchConfirmedToCompareOk = compareOkAt - branchConfirmedAt;

  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_compare_ahead_by",
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.userId,
    detail: {
      aheadBy: compare.data.aheadBy,
      behindBy: compare.data.behindBy,
      headSha: compare.data.headSha ?? null,
      elapsedMsBranchConfirmedToCompareOk,
      elapsedMsLaunchToCompareOk: compareOkAt - input.probeState.agentLaunchStartedAt,
      source: input.logSource,
    },
  });

  input.probeState.compare404AttemptIndex = 0;
  input.probeState.nextGithubCompareAllowedAt = 0;

  return {
    data: {
      headSha: compare.data.headSha ?? null,
      changedFiles: compare.data.changedFiles,
      diffSummary: compare.data.diffSummary,
      aheadBy: compare.data.aheadBy,
      behindBy: compare.data.behindBy,
      compareStatus: compare.data.compareStatus,
    },
    elapsedMsLaunchToBranchConfirmed: elapsedMsLaunchToFirstBranchConfirmed,
    elapsedMsBranchConfirmedToCompareOk,
    compareOkAtMs: compareOkAt,
  };
}

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

const ENV_TEST_TASK_KIND = "ENV_TEST";

/**
 * ENV_TEST-only poll shortcut: GitHub PR/compare로 터미널 전 조기 종료.
 * taskKind 방어: 일반 Task에서는 호출되지 않아야 하나, callee에서 한 번 더 막는다.
 */
async function tryEnvTestCursorPollEarlySuccess(input: {
  taskKindForScope: string | null | undefined;
  projectId: string;
  taskId: string;
  gitRepoUrl: string;
  baseBranch: string;
  headBranch: string;
  githubAccessToken: string | null | undefined;
  agentId: string;
  pollStartedAt: number;
  pollRoundLabel: number;
  agentJson: AgentJson;
  fallbackBranch: string;
  /** ENV_TEST GitHub 프로브(워밍업·404 백오프); compare 경로에만 사용 */
  envTestGithubProbeState: EnvTestGithubProbeState;
  /** compare 프로브 허용 판단용 완료 폴링 수(런치 직후 조기 호출이면 0) */
  completedAgentPollsForGithubProbe: number;
}): Promise<CursorRunResult | null> {
  if (String(input.taskKindForScope ?? "").trim() !== ENV_TEST_TASK_KIND) {
    return null;
  }
  const elapsedMs = Date.now() - input.pollStartedAt;
  const openPr = await findOpenPullRequestByHeadBranch({
    repoUrl: input.gitRepoUrl,
    headBranch: input.headBranch,
    githubAccessToken: input.githubAccessToken ?? null,
    projectId: input.projectId,
  });
  if (openPr) {
    if (isTaskProgressLogEnabled()) {
      appendTaskProgressLog({
        kind: "execution",
        phase: "env_test_poll_stopped_after_pr_opened",
        projectId: input.projectId,
        taskId: input.taskId,
        detail: {
          elapsedMs,
          pollRound: input.pollRoundLabel,
          prUrl: openPr.prUrl,
          prNumber: openPr.prNumber,
          agentId: input.agentId,
        },
      });
      appendTaskProgressLog({
        kind: "execution",
        phase: "env_test_early_exit_after_pr",
        projectId: input.projectId,
        taskId: input.taskId,
        detail: {
          elapsedMs,
          pollRound: input.pollRoundLabel,
          reason: "open_pr_on_github",
          agentId: input.agentId,
        },
      });
    }
    const r = mapAgentToResult(input.agentJson, input.fallbackBranch);
    return {
      ...r,
      runId: input.agentId,
      prUrl: openPr.prUrl,
      summary:
        r.summary && r.summary !== "(Cloud Agent 요약 없음)"
          ? r.summary
          : "GitHub에 열린 PR이 확인되어 Cursor 에이전트 폴링을 종료했습니다.",
      executionStatus: "succeeded",
      error: undefined,
    };
  }

  return null;
}

/**
 * ENV_TEST Path B: Cursor가 CREATING/RUNNING이어도 GitHub compare(ahead_by)로 푸시가 보이면
 * PR 생성·조회 후 PR_OPENED까지 즉시 마무리한다 (cursor_terminal 불필요).
 */
async function tryEnvTestGithubFullFinalizeDuringPoll(input: {
  params: ExecuteCursorRelayParams;
  ctx: NonNullable<ExecuteCursorRelayParams["envTestPollFinalizeContext"]>;
  agentId: string;
  pollStartedAt: number;
  agentPollCount: number;
  agentJson: AgentJson;
  logs: string[];
  envTestGithubProbeState: EnvTestGithubProbeState;
}): Promise<
  | { kind: "return"; result: RunExecutionLoopResult }
  | { kind: "continue_loop" }
  | null
> {
  if (String(input.params.taskKind ?? "").trim() !== ENV_TEST_TASK_KIND) {
    return null;
  }
  const { params, ctx, agentId, pollStartedAt, agentPollCount, agentJson, logs, envTestGithubProbeState } =
    input;
  const setup = params.executionSetup;
  const branchName = params.suggestedBranchName.trim();
  const elapsedMs = Date.now() - pollStartedAt;
  const agentStatus = String(agentJson.status ?? "").trim();

  const probed = await envTestProbeGithubAheadByCompare({
    projectId: params.projectId,
    taskId: ctx.taskId,
    userId: ctx.actorUserId,
    repoUrl: setup.gitRepoUrl,
    baseBranch: setup.baseBranch,
    headBranch: branchName,
    githubAccessToken: ctx.githubAccessToken ?? null,
    probeState: envTestGithubProbeState,
    completedAgentPolls: agentPollCount,
    agentPollCountForLog: agentPollCount,
    logSource: "cursor_poll_early_github_finalize",
  });

  if (!probed) {
    return null;
  }

  const compareData = probed.data;

  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_early_compare_ahead_by",
    projectId: params.projectId,
    taskId: ctx.taskId,
    userId: ctx.actorUserId,
    detail: {
      context: "cursor_poll_early_github",
      baseBranch: setup.baseBranch,
      branchName,
      compareStatus: compareData.compareStatus,
      aheadBy: compareData.aheadBy,
      behindBy: compareData.behindBy,
      headSha: compareData.headSha ?? null,
      agentPollCount,
      elapsedMs,
      agentId,
      agentStatus,
      elapsedMsLaunchToBranchConfirmed: probed.elapsedMsLaunchToBranchConfirmed,
      elapsedMsBranchConfirmedToCompareOk: probed.elapsedMsBranchConfirmedToCompareOk,
    },
  });

  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_early_push_reflected",
    projectId: params.projectId,
    taskId: ctx.taskId,
    userId: ctx.actorUserId,
    detail: {
      branchName,
      aheadBy: compareData.aheadBy,
      headSha: compareData.headSha ?? null,
      agentPollCount,
      elapsedMs,
    },
  });

  const preExisting = await findOpenPullRequestByHeadBranch({
    repoUrl: ctx.repoUrl,
    headBranch: branchName,
    githubAccessToken: ctx.githubAccessToken ?? null,
    projectId: params.projectId,
  });

  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_early_pr_lookup_started",
    projectId: params.projectId,
    taskId: ctx.taskId,
    userId: ctx.actorUserId,
    detail: {
      headBranch: branchName,
      hadExistingOpenPr: Boolean(preExisting),
      elapsedMs,
    },
  });

  if (preExisting) {
    appendTaskProgressLog({
      kind: "execution",
      phase: "env_test_early_pr_found_existing",
      projectId: params.projectId,
      taskId: ctx.taskId,
      userId: ctx.actorUserId,
      detail: {
        prUrl: preExisting.prUrl,
        prNumber: preExisting.prNumber,
        headBranch: branchName,
        elapsedMs,
      },
    });
  }

  const mapped = mapAgentToResult(agentJson, branchName);

  const out = await runEnvTestAfterGithubPushConfirmed({
    projectId: params.projectId,
    taskId: ctx.taskId,
    taskKind: params.taskKind ?? null,
    execRunId: ctx.execRunId,
    actorUserId: ctx.actorUserId,
    branchName,
    repoUrl: ctx.repoUrl,
    baseBranch: ctx.baseBranch,
    githubAccessToken: ctx.githubAccessToken ?? null,
    compareData: {
      headSha: compareData.headSha ?? null,
      changedFiles: compareData.changedFiles,
      diffSummary: compareData.diffSummary,
      compareOkAtMs: probed.compareOkAtMs,
    },
    steps: ctx.steps,
    singleTaskId: ctx.singleTaskId,
    effectiveAutoAdvance: ctx.effectiveAutoAdvance,
    cursorRunId: agentId,
    cursorSummary: mapped.summary.slice(0, 24_000),
    via: "cursor_poll_early_github",
    pushDetectedSource: "cursor_poll_early_github_compare",
    executionRunCreatedAt: ctx.execRunCreatedAt,
  });

  if (out.kind === "pr_failed") {
    return null;
  }

  ctx.steps.push({
    phase: "cursor",
    taskId: ctx.taskId,
    ok: true,
    runId: agentId,
  });

  if (!preExisting) {
    appendTaskProgressLog({
      kind: "execution",
      phase: "env_test_early_pr_created",
      projectId: params.projectId,
      taskId: ctx.taskId,
      userId: ctx.actorUserId,
      detail: { headBranch: branchName, note: "platform_create_or_update_after_compare", elapsedMs },
    });
  }

  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_early_pr_opened_terminal_success",
    projectId: params.projectId,
    taskId: ctx.taskId,
    userId: ctx.actorUserId,
    detail: {
      elapsedMs,
      agentPollCount,
      agentId,
      beforeCursorTerminal: true,
    },
  });
  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_poll_stopped_after_early_pr",
    projectId: params.projectId,
    taskId: ctx.taskId,
    userId: ctx.actorUserId,
    detail: { elapsedMs, agentPollCount, agentId, reason: "github_compare_during_poll" },
  });
  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_early_exit_before_cursor_terminal",
    projectId: params.projectId,
    taskId: ctx.taskId,
    userId: ctx.actorUserId,
    detail: {
      elapsedMsSinceAgentLaunch: elapsedMs,
      elapsedMsLaunchToBranchConfirmed: probed.elapsedMsLaunchToBranchConfirmed,
      elapsedMsBranchConfirmedToCompareOk: probed.elapsedMsBranchConfirmedToCompareOk,
      agentPollCount,
      agentStatus,
      compareOkAtMs: probed.compareOkAtMs,
    },
  });

  logs.push("[cursor-adapter] ENV_TEST: GitHub compare during poll — PR_OPENED (Path B, no Cursor terminal wait)");

  if (out.kind === "return") return { kind: "return", result: out.result };
  return { kind: "continue_loop" };
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
  const adapterTaskKindNorm = String(params.taskKind ?? "").trim();
  const isAdapterEnvTestKind = adapterTaskKindNorm === ENV_TEST_TASK_KIND;
  // Callee 방어: finalize 컨텍스트는 ENV_TEST taskKind일 때만 유효.
  if (params.envTestPollFinalizeContext && !isAdapterEnvTestKind) {
    appendTaskProgressLog({
      kind: "execution",
      phase: "execution_scope_guard_blocked",
      projectId: params.projectId,
      taskId: params.task.id,
      detail: {
        where: "executeCursorRun",
        reason: "envTestPollFinalizeContext_with_non_ENV_TEST_taskKind",
        taskKind: params.taskKind ?? null,
      },
    });
  }

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
    githubAccessToken: params.githubAccessToken ?? null,
    projectId: params.projectId,
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
    let completedAgentPolls = 0;
    const isEnvTestKind = String(params.taskKind ?? "").trim() === ENV_TEST_TASK_KIND;
    /** 비 ENV_TEST 호출에서 잘못 넘어온 컨텍스트는 무시 (스코프 누수 방지). */
    const envTestPollFinalizeContextEffective =
      isEnvTestKind && params.envTestPollFinalizeContext ? params.envTestPollFinalizeContext : null;
    /** ENV_TEST-only: compare·브랜치 프로브 워밍업 및 404 백오프 상태(일반 Task는 null). */
    const envTestGithubProbeState: EnvTestGithubProbeState | null = isEnvTestKind
      ? {
          agentLaunchStartedAt: started,
          nextGithubCompareAllowedAt: 0,
          compare404AttemptIndex: 0,
          branchConfirmedAtMs: null,
        }
      : null;
    const firstDelayMs = isEnvTestKind ? ENV_TEST_POLL_FIRST_DELAY_MS : POLL_FIRST_DELAY_MS;
    const normalIntervalMs = POLL_INTERVAL_MS;
    console.info("[cursor-adapter] agent poll schedule", {
      agentId,
      firstDelayMs,
      intervalMs: isEnvTestKind ? "tiered_1s_15s_then_2s_40s_then_3s" : normalIntervalMs,
      maxWaitMs: MAX_POLL_MS,
      envTestGithubEarlyExit: isEnvTestKind,
      envTestGithubCompareMinMs: isEnvTestKind ? ENV_TEST_GITHUB_COMPARE_MIN_MS_AFTER_LAUNCH : null,
    });

    if (isTaskProgressLogEnabled()) {
      appendTaskProgressLog({
        kind: "cursor",
        phase: "poll_started",
        projectId: params.projectId,
        taskId: params.task.id,
        detail: {
          agentId,
          maxWaitMs: MAX_POLL_MS,
          firstDelayMs,
          intervalMsNote: isEnvTestKind ? "ENV_TEST_tiered_poll" : normalIntervalMs,
          envTestGithubEarlyExit: isEnvTestKind,
        },
      });
    }

    // Normal Task: 이 분기 없음. ENV_TEST + 폴링 중 finalize 컨텍스트만 스코프 통과 로그.
    if (isEnvTestKind && envTestPollFinalizeContextEffective) {
      appendTaskProgressLog({
        kind: "execution",
        phase: "env_test_scope_guard_passed",
        projectId: params.projectId,
        taskId: params.task.id,
        detail: { where: "executeCursorRun", note: "poll_with_env_test_finalize_context" },
      });
    }

    if (isEnvTestKind && envTestGithubProbeState) {
      const earlyImmediate = await tryEnvTestCursorPollEarlySuccess({
        taskKindForScope: params.taskKind,
        projectId: params.projectId,
        taskId: params.task.id,
        gitRepoUrl: setup.gitRepoUrl,
        baseBranch: setup.baseBranch,
        headBranch: params.suggestedBranchName,
        githubAccessToken: params.githubAccessToken ?? null,
        agentId,
        pollStartedAt: started,
        pollRoundLabel: 0,
        agentJson: launchJson ?? {},
        fallbackBranch: params.suggestedBranchName,
        envTestGithubProbeState,
        completedAgentPollsForGithubProbe: 0,
      });
      if (earlyImmediate) {
        logs.push("[cursor-adapter] ENV_TEST: GitHub 증거 확인 — 에이전트 폴링 생략·조기 종료");
        return { ok: true, result: earlyImmediate, logs };
      }

      // 런치 직후 짧은 지연 뒤 compare/PR finalize 시도(Cursor 첫 폴링 전).
      if (isEnvTestKind && envTestPollFinalizeContextEffective && envTestGithubProbeState) {
        await new Promise((r) => setTimeout(r, ENV_TEST_POST_LAUNCH_GITHUB_PROBE_DELAY_MS));
        const elapsedLaunch = Date.now() - started;
        if (isTaskProgressLogEnabled()) {
          appendTaskProgressLog({
            kind: "execution",
            phase: "env_test_post_launch_github_probe_start",
            projectId: params.projectId,
            taskId: params.task.id,
            userId: params.envTestPollFinalizeContext?.actorUserId ?? undefined,
            detail: {
              agentId,
              elapsedMsSinceAgentLaunch: elapsedLaunch,
              delayMs: ENV_TEST_POST_LAUNCH_GITHUB_PROBE_DELAY_MS,
            },
          });
        }
        const finLaunch = await tryEnvTestGithubFullFinalizeDuringPoll({
          params,
          ctx: envTestPollFinalizeContextEffective,
          agentId,
          pollStartedAt: started,
          agentPollCount: 0,
          agentJson: launchJson ?? {},
          logs,
          envTestGithubProbeState,
        });
        if (finLaunch) {
          return {
            ok: true,
            envTestGithubEarlyFinished: true,
            envTestFinalizeOutcome: finLaunch,
            logs,
          };
        }
      }
    }

    while (Date.now() - started < MAX_POLL_MS) {
      if (
        isEnvTestKind &&
        envTestPollFinalizeContextEffective &&
        envTestGithubProbeState &&
        envTestAllowEarlyGithubFullFinalize(completedAgentPolls, started)
      ) {
        const fin = await tryEnvTestGithubFullFinalizeDuringPoll({
          params,
          ctx: envTestPollFinalizeContextEffective,
          agentId,
          pollStartedAt: started,
          agentPollCount: completedAgentPolls,
          agentJson: last,
          logs,
          envTestGithubProbeState,
        });
        if (fin) {
          return {
            ok: true,
            envTestGithubEarlyFinished: true,
            envTestFinalizeOutcome: fin,
            logs,
          };
        }
      }

      const elapsedSinceStart = Date.now() - started;
      const prePollDelayMs =
        completedAgentPolls === 0
          ? firstDelayMs
          : isEnvTestKind
            ? envTestCursorPollIntervalMs(elapsedSinceStart)
            : normalIntervalMs;
      if (isEnvTestKind && isTaskProgressLogEnabled()) {
        appendTaskProgressLog({
          kind: "cursor",
          phase: "env_test_cursor_poll_delay",
          projectId: params.projectId,
          taskId: params.task.id,
          detail: {
            agentId,
            prePollDelayMs,
            elapsedMsSincePollLoopStart: elapsedSinceStart,
            completedAgentPollsBeforeThisWait: completedAgentPolls,
          },
        });
      }
      await new Promise((r) => setTimeout(r, prePollDelayMs));

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
      completedAgentPolls += 1;
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
      if (isTaskProgressCursorPollDumpEnabled()) {
        appendTaskProgressLog({
          kind: "cursor",
          phase: "agent_poll_dump",
          projectId: params.projectId,
          taskId: params.task.id,
          detail: {
            pollRound: completedAgentPolls,
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

      if (isEnvTestKind && envTestGithubProbeState) {
        const earlyGithub = await tryEnvTestCursorPollEarlySuccess({
          taskKindForScope: params.taskKind,
          projectId: params.projectId,
          taskId: params.task.id,
          gitRepoUrl: setup.gitRepoUrl,
          baseBranch: setup.baseBranch,
          headBranch: params.suggestedBranchName,
          githubAccessToken: params.githubAccessToken ?? null,
          agentId,
          pollStartedAt: started,
          pollRoundLabel: completedAgentPolls,
          agentJson: last,
          fallbackBranch: params.suggestedBranchName,
          envTestGithubProbeState,
          completedAgentPollsForGithubProbe: completedAgentPolls,
        });
        if (earlyGithub) {
          logs.push(
            `[cursor-adapter] ENV_TEST: GitHub 증거 확인 — 에이전트 폴링 조기 종료 (round ${completedAgentPolls})`
          );
          return { ok: true, result: earlyGithub, logs };
        }
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
              detail: {
                agentId,
                status: st,
                pollRound: completedAgentPolls,
                hasPr,
                hasCommit,
                prUrl: r.prUrl ?? null,
              },
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
        phase: MAX_POLL_MS === 300_000 ? "agent_poll_timeout_5m" : "agent_poll_timeout",
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
