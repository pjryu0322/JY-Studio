/**
 * Cursor Cloud Agents API 직접 호출 (릴레이 없음).
 * POST {base}/v0/agents → 폴링 GET {base}/v0/agents/{id}
 * 인증: Basic (API 키:빈비밀번호)
 *
 * @see https://cursor.com/docs/cloud-agent/api/endpoints
 */

import { randomUUID } from "node:crypto";
import {
  isEnvTestFamilyTaskKind,
  isEnvTestStage1TaskKind,
  isEnvTestStage2TaskKind,
} from "@/lib/execution/envTestTaskKind";
import { logStage2CatalogEvent } from "@/lib/service/envTestStage2CatalogEvents";
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
import { getEnvTestStage1PrFirstRetryConfig, runStage1EnvTestPrSmokePath } from "@/lib/executionLoop/envTestStage1Helpers";
import { normalizeStage1EnvTestHeadBranch } from "@/lib/service/githubEnvTestPullRequestService";
import type { LoopStepRecord, RunExecutionLoopResult } from "@/lib/executionLoop/runLoopTypes";
import {
  buildGithubBranchHeadProbePlan,
  fetchGithubBranchHeadExists,
  fetchGithubCompareSnapshot,
} from "@/lib/service/githubCompareService";
import { findOpenPullRequestByHeadBranch } from "@/lib/service/githubOpenPullRequestByHeadService";
import {
  monitorApplyCursorAgentHeuristics,
  monitorCursorPrepareDone,
  monitorCursorPrepareStart,
  monitorCursorSignalPatch,
  monitorFirstGitBranchCheck,
  monitorGitBranchDetected,
  monitorGitBranchReflected,
  patchTaskExecutionRunStage2RuntimeMonitor,
  type Stage2RuntimeMonitorV1,
} from "@/lib/service/envTestStage2RuntimeMonitor";

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

type EnvTestPollScheduleTier = "stage1_github" | "env_test_default";

function envTestCursorPollIntervalMs(
  elapsedSincePollLoopStartMs: number,
  pollSchedule: EnvTestPollScheduleTier
): number {
  const e = Math.max(0, elapsedSincePollLoopStartMs);
  if (pollSchedule === "stage1_github") {
    if (e < ENV_TEST_STAGE1_POLL_FAST_WINDOW_MS) return ENV_TEST_STAGE1_POLL_INTERVAL_FAST_MS;
    if (e < ENV_TEST_STAGE1_POLL_MID_WINDOW_MS) return ENV_TEST_STAGE1_POLL_INTERVAL_MID_MS;
    return ENV_TEST_STAGE1_POLL_INTERVAL_SLOW_MS;
  }
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

// NOTE: Stage2 GitHub polling/compare/reflection logic has moved out of this adapter.
// Stage2 now uses `executionLoop/stage2/stage2GithubMonitor.ts` and `runStage2EnvTestPipeline.ts`.

/** ENV_TEST: branch/compare 404 5회차 이후 백오프 상한(기본 5초, 10초 금지). */
const ENV_TEST_COMPARE_404_BACKOFF_CAP_MS = parseEnvPositiveIntMs(
  "CURSOR_ENV_TEST_COMPARE_404_BACKOFF_CAP_MS",
  3_000,
  { min: 500, max: 3_000 }
);

function envTestCompare404BackoffDelayMs(zeroBasedAttemptIndex: number, aggressive: boolean): number {
  if (aggressive) {
    const steps = [500, 1_000, 1_500, 2_000];
    const i = Math.max(0, zeroBasedAttemptIndex);
    if (i < steps.length) return steps[i];
    return 3_000;
  }
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
  /** compare 게이트: Stage 2는 더 짧게(기본 0ms). */
  compareMinMsAfterLaunch: number;
  /** Stage 2: 폴링·404 백오프를 더 공격적으로. */
  aggressiveGithubTiming: boolean;
  stage2FirstBranchCheckCatalogEmitted?: boolean;
  stage2FirstBranchReflectedCatalogEmitted?: boolean;
  /** Stage 2: branch_detect_attempt 카운트 */
  stage2BranchDetectAttemptSeq?: number;
  /** Stage 2: compare ahead≤0 구간 진입 시각(재시도·소프트 타임아웃) */
  stage2CompareAheadZeroSinceMs?: number | null;
  stage2AheadZeroSoftLogged?: boolean;
  stage2BranchExistsHardLogged?: boolean;
  stage2BranchExistsWarnLogged?: boolean;
  stage2BranchExistsFailLogged?: boolean;
  stage2PushUnconfirmedFatal?: boolean;
  /** 마지막 성공한 GET /branches/{branch} 의 HEAD sha (Stage 2 Git 우선 종료용) */
  lastBranchHeadSha?: string | null;
  signalBranchHintLogged?: boolean;
  signalHeadShaHintLogged?: boolean;
  signalCommitHashHintLogged?: boolean;
  signalChangedFilesHintLogged?: boolean;
  signalPushCompletedHintLogged?: boolean;
  /** Stage1: `runStage1EnvTestPrSmokePath` 단일 시도(폴링 루프 재진입 시 중복 PR·머지 방지) */
  stage1PrSmokeAttemptDone?: boolean;
};

function envTestAllowGithubHeadProbe(
  state: EnvTestGithubProbeState,
  completedAgentPolls: number
): { ok: true } | { ok: false; reason: "warmup" | "backoff"; retryAfterMs?: number } {
  const elapsed = Date.now() - state.agentLaunchStartedAt;
  const minMs = state.compareMinMsAfterLaunch;
  const warmupDone =
    completedAgentPolls >= ENV_TEST_GITHUB_COMPARE_MIN_COMPLETED_POLLS || elapsed >= minMs;
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
    executionId?: string | null;
    trackedBranchName?: string | null;
  },
  httpStatus: number | undefined,
  variant: "branch" | "compare" = "compare"
): void {
  const idx = state.compare404AttemptIndex;
  let delayMs = envTestCompare404BackoffDelayMs(idx, state.aggressiveGithubTiming);
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
      backoffVariant: variant,
      checkedApi: variant === "branch" ? "GET /repos/.../branches/{ref}" : "GET /repos/.../compare/{base}...{head}",
      checkedRef: logCtx.headBranch,
      trackedBranchName: logCtx.trackedBranchName ?? logCtx.headBranch,
      executionId: logCtx.executionId ?? null,
      elapsedMsSinceLaunch: Date.now() - state.agentLaunchStartedAt,
    },
  });
}

/**
 * ENV_TEST-only: 브랜치 존재 → compare → ahead_by>0 까지. 실패 시 null(백오프는 state 갱신).
 */
function logStage2CursorSubphaseTransitions(
  prev: Stage2RuntimeMonitorV1 | null,
  next: Stage2RuntimeMonitorV1,
  ctx: { projectId: string; taskId: string; actorUserId?: string }
): void {
  const keys = ["cursor_prepare", "cursor_generate", "cursor_commit", "cursor_push"] as const;
  for (const k of keys) {
    const a = prev?.phases[k]?.status ?? "PENDING";
    const b = next.phases[k]?.status ?? "PENDING";
    if (a !== "RUNNING" && b === "RUNNING") {
      appendTaskProgressLog({
        kind: "execution",
        phase: `${k}_started`,
        projectId: ctx.projectId,
        taskId: ctx.taskId,
        userId: ctx.actorUserId,
        detail: { stage2RuntimeMonitor: true },
      });
      if (k === "cursor_push") {
        appendTaskProgressLog({
          kind: "execution",
          phase: "cursor_signal_push_started",
          projectId: ctx.projectId,
          taskId: ctx.taskId,
          userId: ctx.actorUserId,
          detail: { source: "stage2_runtime_monitor" },
        });
      }
    }
    if (a === "RUNNING" && b === "DONE") {
      appendTaskProgressLog({
        kind: "execution",
        phase: `${k}_finished`,
        projectId: ctx.projectId,
        taskId: ctx.taskId,
        userId: ctx.actorUserId,
        detail: { stage2RuntimeMonitor: true },
      });
    }
  }
}

async function emitStage2FirstBranchReflectedIfNeeded(ctx: {
  probeState: EnvTestGithubProbeState;
  stage2RuntimeMonitor: NonNullable<ExecuteCursorRelayParams["stage2RuntimeMonitor"]>;
  projectId: string;
  taskId: string;
  userId?: string;
  headBranch: string;
  logSource: string;
  headSha: string | null;
  at: "branch_exists" | "compare_ahead";
  elapsedMsSinceLaunch: number;
  aheadBy?: number;
}): Promise<void> {
  if (ctx.probeState.stage2FirstBranchReflectedCatalogEmitted) return;
  ctx.probeState.stage2FirstBranchReflectedCatalogEmitted = true;
  logStage2CatalogEvent({
    phase: "first_branch_reflected",
    projectId: ctx.projectId,
    taskId: ctx.taskId,
    userId: ctx.userId,
    detail: {
      at: ctx.at,
      aheadBy: ctx.aheadBy ?? null,
      headSha: ctx.headSha,
      elapsedMsLaunchToReflected: ctx.elapsedMsSinceLaunch,
      source: ctx.logSource,
    },
  });
  appendTaskProgressLog({
    kind: "execution",
    phase: "branch_reflected",
    projectId: ctx.projectId,
    taskId: ctx.taskId,
    userId: ctx.userId,
    detail: {
      at: ctx.at,
      aheadBy: ctx.aheadBy ?? null,
      headSha: ctx.headSha,
      source: ctx.logSource,
    },
  });
  appendTaskProgressLog({
    kind: "execution",
    phase: "git_branch_reflected",
    projectId: ctx.projectId,
    taskId: ctx.taskId,
    userId: ctx.userId,
    detail: {
      at: ctx.at,
      aheadBy: ctx.aheadBy ?? null,
      headSha: ctx.headSha,
      source: ctx.logSource,
    },
  });
  appendTaskProgressLog({
    kind: "execution",
    phase: "cursor_signal_push_completed_hint",
    projectId: ctx.projectId,
    taskId: ctx.taskId,
    userId: ctx.userId,
    detail: {
      reflectedAt: ctx.at,
      headShaHint: ctx.headSha,
      source: ctx.logSource,
    },
  });
  await patchTaskExecutionRunStage2RuntimeMonitor(ctx.stage2RuntimeMonitor.execRunId, (m) =>
    monitorCursorSignalPatch(
      monitorGitBranchReflected(m, Date.now()),
      { headShaHint: ctx.headSha ?? undefined, pushCompletedHintAtMs: Date.now() },
      Date.now()
    )
  );
}

// NOTE: Stage2 GitHub compare/branch reflection probing has been removed from this adapter.
// Stage2 now uses `executionLoop/stage2/stage2GithubMonitor.ts`.

/** Cloud Agent 폴링 최대 대기(실행 루프 stale 복구 기준에도 사용) */
export const CURSOR_AGENT_MAX_POLL_MS = parseEnvPositiveIntMs(
  "CURSOR_AGENT_MAX_POLL_MS",
  45 * 60 * 1000,
  { min: 60_000, max: 24 * 60 * 60 * 1000 }
);
const MAX_POLL_MS = CURSOR_AGENT_MAX_POLL_MS;
/** Stage1 스모크: GitHub 조기 종료·짧은 폴링 상한(기본 90s). 일반 Task 45분 폴링과 분리. */
const ENV_TEST_STAGE1_BRANCH_WAIT_MAX_MS = parseEnvPositiveIntMs(
  "CURSOR_ENV_TEST_STAGE1_BRANCH_WAIT_MAX_MS",
  90_000,
  { min: 30_000, max: 10 * 60 * 1000 }
);
/** Stage1: 첫 Cursor 폴링 전 지연(기본 500ms, 이후 구간과 동일 500~1000ms 티어). */
const ENV_TEST_STAGE1_POLL_FIRST_DELAY_MS = parseEnvPositiveIntMs(
  "CURSOR_AGENT_ENV_TEST_STAGE1_POLL_FIRST_DELAY_MS",
  500,
  { min: 0, max: 30_000 }
);
/** Stage1: 런치 직후 PR-first finalize 전 지연(기본 0). */
const ENV_TEST_STAGE1_POST_LAUNCH_GITHUB_PROBE_DELAY_MS = parseEnvPositiveIntMs(
  "CURSOR_ENV_TEST_STAGE1_POST_LAUNCH_GITHUB_PROBE_DELAY_MS",
  0,
  { min: 0, max: 30_000 }
);
/** Stage1 Cursor 폴링: 초기/중기/후기 윈도우(ms) — Stage2보다 짧은 간격. */
const ENV_TEST_STAGE1_POLL_FAST_WINDOW_MS = parseEnvPositiveIntMs(
  "CURSOR_ENV_TEST_STAGE1_POLL_FAST_WINDOW_MS",
  12_000,
  { min: 3_000, max: 120_000 }
);
const ENV_TEST_STAGE1_POLL_MID_WINDOW_MS = parseEnvPositiveIntMs(
  "CURSOR_ENV_TEST_STAGE1_POLL_MID_WINDOW_MS",
  35_000,
  { min: 10_000, max: 300_000 }
);
const ENV_TEST_STAGE1_POLL_INTERVAL_FAST_MS = parseEnvPositiveIntMs(
  "CURSOR_ENV_TEST_STAGE1_POLL_INTERVAL_FAST_MS",
  500,
  { min: 500, max: 1_000 }
);
const ENV_TEST_STAGE1_POLL_INTERVAL_MID_MS = parseEnvPositiveIntMs(
  "CURSOR_ENV_TEST_STAGE1_POLL_INTERVAL_MID_MS",
  750,
  { min: 500, max: 1_000 }
);
const ENV_TEST_STAGE1_POLL_INTERVAL_SLOW_MS = parseEnvPositiveIntMs(
  "CURSOR_ENV_TEST_STAGE1_POLL_INTERVAL_SLOW_MS",
  1_000,
  { min: 500, max: 1_000 }
);
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
    executionStatus: safePreview((agent as any).executionStatus ?? (agent as any).execution_status),
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
    changedFiles_sample: Array.isArray((agent as any).changedFiles)
      ? ((agent as any).changedFiles as unknown[]).slice(0, 3).map((x) => String(x))
      : null,
  };
  return candidates;
}

function shouldTreatPrAsTerminalSuccess(): boolean {
  return process.env.CURSOR_AGENT_EARLY_SUCCESS_ON_PR === "1";
}

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
  if (!isEnvTestFamilyTaskKind(input.taskKindForScope)) {
    return null;
  }
  const elapsedMs = Date.now() - input.pollStartedAt;
  const headForPrLookup = isEnvTestStage1TaskKind(input.taskKindForScope)
    ? normalizeStage1EnvTestHeadBranch(input.gitRepoUrl, input.headBranch)
    : String(input.headBranch ?? "").trim() || null;
  if (isEnvTestStage1TaskKind(input.taskKindForScope) && !headForPrLookup) {
    return null;
  }
  const openPr = await findOpenPullRequestByHeadBranch({
    repoUrl: input.gitRepoUrl,
    headBranch: headForPrLookup ?? String(input.headBranch ?? "").trim(),
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

// NOTE: Stage2 early-finalize helpers removed from adapter.

/**
 * Stage1 전용: compare·Stage2 경로 없이 GitHub에 head 브랜치가 보이면 `runStage1EnvTestPrSmokePath`로 PR·finalize.
 */
async function tryStage1GithubBranchPrSmokeFinalizeDuringPoll(input: {
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
  if (!isEnvTestStage1TaskKind(input.params.taskKind)) {
    return null;
  }
  const { params, ctx, agentId, pollStartedAt, agentPollCount, agentJson, logs, envTestGithubProbeState } =
    input;
  if (envTestGithubProbeState.stage1PrSmokeAttemptDone) {
    return null;
  }
  const setup = params.executionSetup;
  const primaryHead = normalizeStage1EnvTestHeadBranch(setup.gitRepoUrl, params.suggestedBranchName);
  if (!primaryHead) {
    return null;
  }
  const gate = envTestAllowGithubHeadProbe(envTestGithubProbeState, input.agentPollCount);
  if (!gate.ok) {
    return null;
  }

  const branchProbe = await fetchGithubBranchHeadExists({
    repoUrl: setup.gitRepoUrl,
    branch: primaryHead,
    githubAccessToken: ctx.githubAccessToken ?? null,
    projectId: params.projectId,
  });

  if (!branchProbe.ok) {
    if (branchProbe.httpStatus === 404) {
      envTestApplyGithubProbe404Backoff(
        envTestGithubProbeState,
        {
          projectId: params.projectId,
          taskId: ctx.taskId,
          userId: ctx.actorUserId,
          headBranch: primaryHead,
          source: "cursor_poll_stage1_branch_head",
          executionId: ctx.execRunId ?? null,
          trackedBranchName: primaryHead,
        },
        404,
        "branch"
      );
    }
    return null;
  }

  const branchConfirmedAt = Date.now();
  if (envTestGithubProbeState.branchConfirmedAtMs == null) {
    envTestGithubProbeState.branchConfirmedAtMs = branchConfirmedAt;
    appendTaskProgressLog({
      kind: "execution",
      phase: "stage1_branch_resolved",
      projectId: params.projectId,
      taskId: ctx.taskId,
      userId: ctx.actorUserId,
      detail: {
        projectId: params.projectId,
        taskId: ctx.taskId,
        executionId: ctx.execRunId,
        branchName: primaryHead,
        source: "cursor_poll_github_branch_exists",
        elapsedMsSinceLaunch: branchConfirmedAt - envTestGithubProbeState.agentLaunchStartedAt,
      },
    });
  }
  envTestGithubProbeState.lastBranchHeadSha = branchProbe.headSha ?? null;

  envTestGithubProbeState.stage1PrSmokeAttemptDone = true;

  const mapped = mapAgentToResult(agentJson, params.suggestedBranchName.trim());
  const diffSummary = mapped.summary.slice(0, 24_000);
  const headSha = (mapped.commitHash ?? branchProbe.headSha ?? "").trim() || null;

  const out = await runStage1EnvTestPrSmokePath({
    projectId: params.projectId,
    taskId: ctx.taskId,
    actorUserId: ctx.actorUserId,
    execRunId: ctx.execRunId,
    branchName: primaryHead,
    repoUrl: ctx.repoUrl,
    baseBranch: ctx.baseBranch,
    githubAccessToken: ctx.githubAccessToken ?? null,
    execRunCreatedAt: ctx.execRunCreatedAt,
    cursorRunId: agentId,
    cursorSummary: mapped.summary,
    headSha,
    changedFiles: mapped.changedFiles,
    diffSummary,
    steps: ctx.steps,
    singleTaskId: ctx.singleTaskId,
    effectiveAutoAdvance: ctx.effectiveAutoAdvance,
    stage1PrCreateRetry: getEnvTestStage1PrFirstRetryConfig(),
  });

  const elapsedMs = Date.now() - pollStartedAt;
  if (out.kind === "pr_failed") {
    appendTaskProgressLog({
      kind: "execution",
      phase: "stage1_pr_smoke_failed_during_poll",
      projectId: params.projectId,
      taskId: ctx.taskId,
      userId: ctx.actorUserId,
      detail: { elapsedMs, agentPollCount, agentId, message: (out.message ?? "").slice(0, 500) },
    });
    return {
      kind: "return",
      result: {
        ok: false,
        steps: ctx.steps,
        message: "ENV_TEST(Stage1): 플랫폼이 GitHub PR을 생성·갱신하지 못했습니다.",
      },
    };
  }

  ctx.steps.push({
    phase: "cursor",
    taskId: ctx.taskId,
    ok: true,
    runId: agentId,
  });

  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_poll_stopped_after_stage1_pr_smoke",
    projectId: params.projectId,
    taskId: ctx.taskId,
    userId: ctx.actorUserId,
    detail: {
      elapsedMs,
      agentPollCount,
      agentId,
      headBranch: primaryHead,
    },
  });
  logs.push("[cursor-adapter] ENV_TEST Stage1: GitHub 브랜치 확인 후 PR 스모크 경로로 폴링 종료");

  if (out.kind === "return") return { kind: "return", result: out.result };
  return { kind: "continue_loop" };
}

// NOTE: Stage2 compare→PR early-finalize during adapter polling has been removed.
// Stage2 now runs via `executionLoop/stage2/runStage2EnvTestPipeline.ts` (GitHub source-of-truth).

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
  const isAdapterEnvTestKind = isEnvTestFamilyTaskKind(adapterTaskKindNorm);
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

  const stage2MonCtx =
    isEnvTestFamilyTaskKind(params.taskKind) && params.stage2RuntimeMonitor ? params.stage2RuntimeMonitor : null;
  let lastMonStage2: Stage2RuntimeMonitorV1 | null = null;
  const patchStage2 = async (fn: (m: Stage2RuntimeMonitorV1) => Stage2RuntimeMonitorV1) => {
    if (!stage2MonCtx) return null;
    const next = await patchTaskExecutionRunStage2RuntimeMonitor(stage2MonCtx.execRunId, fn);
    logStage2CursorSubphaseTransitions(lastMonStage2, next, stage2MonCtx);
    lastMonStage2 = next;
    return next;
  };

  try {
    if (stage2MonCtx) {
      await patchStage2((m) => monitorCursorPrepareStart(m, Date.now()));
    }
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

    if (stage2MonCtx) {
      await patchStage2((m) => monitorCursorPrepareDone(m, Date.now()));
      const nowSig = Date.now();
      await patchStage2((m) =>
        monitorCursorSignalPatch(
          m,
          {
            agentLaunchedAtMs: nowSig,
            branchNameHint: params.suggestedBranchName,
          },
          nowSig
        )
      );
    }

    if (isTaskProgressLogEnabled()) {
      appendTaskProgressLog({
        kind: "cursor",
        phase: "agent_launched",
        projectId: params.projectId,
        taskId: params.task.id,
        detail: { agentId, branch: params.suggestedBranchName },
      });
      if (isEnvTestFamilyTaskKind(params.taskKind)) {
        appendTaskProgressLog({
          kind: "cursor",
          phase: "cursor_agent_launched",
          projectId: params.projectId,
          taskId: params.task.id,
          detail: { agentId, branch: params.suggestedBranchName },
        });
        appendTaskProgressLog({
          kind: "execution",
          phase: "cursor_signal_agent_launched",
          projectId: params.projectId,
          taskId: params.task.id,
          userId: params.envTestPollFinalizeContext?.actorUserId ?? undefined,
          detail: { agentId, branchNameHint: params.suggestedBranchName },
        });
        appendTaskProgressLog({
          kind: "execution",
          phase: "cursor_signal_branch_hint",
          projectId: params.projectId,
          taskId: params.task.id,
          userId: params.envTestPollFinalizeContext?.actorUserId ?? undefined,
          detail: { branchNameHint: params.suggestedBranchName, source: "agent_launch" },
        });
      }
    }

    const started = Date.now();
    let lastStage2HeuristicWall = 0;
    let stage2HeuristicPollSeq = 0;
    let last: AgentJson = launchJson ?? {};
    let completedAgentPolls = 0;
    const isEnvTestKind = isEnvTestFamilyTaskKind(params.taskKind);
    const envTestStage1GithubFastLoop = isEnvTestStage1TaskKind(params.taskKind);
    /** Stage1 only: 브랜치 존재 → `runStage1EnvTestPrSmokePath`. (Stage2는 별도 파이프라인에서 GitHub 모니터링으로 처리) */
    const envTestGithubMidPollFinalize = envTestStage1GithubFastLoop;
    const maxPollMsEffective = envTestStage1GithubFastLoop ? ENV_TEST_STAGE1_BRANCH_WAIT_MAX_MS : MAX_POLL_MS;
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
          compareMinMsAfterLaunch: envTestStage1GithubFastLoop ? 0 : ENV_TEST_GITHUB_COMPARE_MIN_MS_AFTER_LAUNCH,
          aggressiveGithubTiming: envTestStage1GithubFastLoop,
        }
      : null;
    const envTestPollScheduleTier: EnvTestPollScheduleTier = envTestStage1GithubFastLoop
      ? "stage1_github"
      : "env_test_default";
    const firstDelayMs = isEnvTestKind
      ? envTestStage1GithubFastLoop
        ? ENV_TEST_STAGE1_POLL_FIRST_DELAY_MS
        : ENV_TEST_POLL_FIRST_DELAY_MS
      : POLL_FIRST_DELAY_MS;
    const postLaunchGithubProbeDelayMs = envTestStage1GithubFastLoop
      ? ENV_TEST_STAGE1_POST_LAUNCH_GITHUB_PROBE_DELAY_MS
      : ENV_TEST_POST_LAUNCH_GITHUB_PROBE_DELAY_MS;
    const normalIntervalMs = POLL_INTERVAL_MS;
    console.info("[cursor-adapter] agent poll schedule", {
      agentId,
      firstDelayMs,
      intervalMs: isEnvTestKind
        ? envTestStage1GithubFastLoop
          ? "ENV_TEST_tiered_fast_github"
          : "tiered_1s_15s_then_2s_40s_then_3s"
        : normalIntervalMs,
      maxWaitMs: maxPollMsEffective,
      envTestGithubEarlyExit: isEnvTestKind,
      envTestGithubCompareMinMs: isEnvTestKind
        ? envTestGithubProbeState?.compareMinMsAfterLaunch ?? ENV_TEST_GITHUB_COMPARE_MIN_MS_AFTER_LAUNCH
        : null,
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
        await new Promise((r) => setTimeout(r, postLaunchGithubProbeDelayMs));
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
              delayMs: postLaunchGithubProbeDelayMs,
            },
          });
        }
        const finLaunch = isEnvTestStage1TaskKind(params.taskKind)
          ? await tryStage1GithubBranchPrSmokeFinalizeDuringPoll({
              params,
              ctx: envTestPollFinalizeContextEffective,
              agentId,
              pollStartedAt: started,
              agentPollCount: 0,
              agentJson: launchJson ?? {},
              logs,
              envTestGithubProbeState,
            })
          : null;
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

    while (Date.now() - started < maxPollMsEffective) {
      if (
        isEnvTestKind &&
        envTestPollFinalizeContextEffective &&
        envTestGithubProbeState &&
        envTestAllowEarlyGithubFullFinalize(completedAgentPolls, started)
      ) {
        const fin = isEnvTestStage1TaskKind(params.taskKind)
          ? await tryStage1GithubBranchPrSmokeFinalizeDuringPoll({
              params,
              ctx: envTestPollFinalizeContextEffective,
              agentId,
              pollStartedAt: started,
              agentPollCount: completedAgentPolls,
              agentJson: last,
              logs,
              envTestGithubProbeState,
            })
          : null;
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
            ? envTestCursorPollIntervalMs(elapsedSinceStart, envTestPollScheduleTier)
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
      const commitHashHint = pickCommitHash(last);
      const headShaHint = pickHeadSha(last);
      const changedFilesNow = pickChangedFiles(last);
      if (stage2MonCtx) {
        const nowH = Date.now();
        stage2HeuristicPollSeq++;
        if (stage2HeuristicPollSeq % 2 === 0 || nowH - lastStage2HeuristicWall > 1_000) {
          lastStage2HeuristicWall = nowH;
          await patchStage2((m) =>
            monitorCursorSignalPatch(
              monitorApplyCursorAgentHeuristics(
                m,
                {
                  agentStatusUpper: st,
                  hasCommitHash: Boolean(commitHashHint),
                  hasChangedFiles: changedFilesNow.length > 0,
                  isTerminalSuccess: isTerminalSuccess(st),
                },
                nowH
              ),
              {
                branchNameHint: params.suggestedBranchName,
                commitHashHint: commitHashHint ?? undefined,
                headShaHint: headShaHint ?? undefined,
                changedFilesCountHint: changedFilesNow.length,
                ...(commitHashHint || changedFilesNow.length > 0 ? { pushStartedAtMs: nowH } : {}),
                ...(headShaHint ? { pushCompletedHintAtMs: nowH } : {}),
              },
              nowH
            )
          );
        }
      }
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
            targetBranch: params.suggestedBranchName,
            executionStatusMapped: isTerminalFailure(st)
              ? "failed"
              : isTerminalSuccess(st)
                ? "succeeded"
                : "running",
          },
        });
      }
      if (isEnvTestKind && envTestGithubProbeState && commitHashHint && !envTestGithubProbeState.signalCommitHashHintLogged) {
        envTestGithubProbeState.signalCommitHashHintLogged = true;
        appendTaskProgressLog({
          kind: "execution",
          phase: "cursor_signal_commit_hash_hint",
          projectId: params.projectId,
          taskId: params.task.id,
          userId: params.envTestPollFinalizeContext?.actorUserId ?? undefined,
          detail: { commitHashHint: commitHashHint.slice(0, 16), pollRound: completedAgentPolls },
        });
      }
      if (
        isEnvTestKind &&
        envTestGithubProbeState &&
        changedFilesNow.length > 0 &&
        !envTestGithubProbeState.signalChangedFilesHintLogged
      ) {
        envTestGithubProbeState.signalChangedFilesHintLogged = true;
        appendTaskProgressLog({
          kind: "execution",
          phase: "cursor_signal_changed_files_hint",
          projectId: params.projectId,
          taskId: params.task.id,
          userId: params.envTestPollFinalizeContext?.actorUserId ?? undefined,
          detail: { changedFilesCountHint: changedFilesNow.length, pollRound: completedAgentPolls },
        });
      }
      if (
        isEnvTestKind &&
        envTestGithubProbeState &&
        headShaHint &&
        !envTestGithubProbeState.signalPushCompletedHintLogged
      ) {
        envTestGithubProbeState.signalPushCompletedHintLogged = true;
        if (!envTestGithubProbeState.signalHeadShaHintLogged) {
          envTestGithubProbeState.signalHeadShaHintLogged = true;
          appendTaskProgressLog({
            kind: "execution",
            phase: "cursor_signal_head_sha_hint",
            projectId: params.projectId,
            taskId: params.task.id,
            userId: params.envTestPollFinalizeContext?.actorUserId ?? undefined,
            detail: { headShaHint: headShaHint.slice(0, 16), pollRound: completedAgentPolls, source: "agent_poll" },
          });
        }
        appendTaskProgressLog({
          kind: "execution",
          phase: "cursor_signal_push_completed_hint",
          projectId: params.projectId,
          taskId: params.task.id,
          userId: params.envTestPollFinalizeContext?.actorUserId ?? undefined,
          detail: { headShaHint: headShaHint.slice(0, 16), pollRound: completedAgentPolls, source: "agent_poll" },
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

        /** Stage1: 브랜치 존재 시 PR 스모크. Stage2: compare/HEAD 조기 종료. */
        if (
          envTestGithubMidPollFinalize &&
          envTestPollFinalizeContextEffective &&
          envTestGithubProbeState &&
          (st === "RUNNING" || st === "CREATING" || st === "QUEUED" || st === "PENDING" || st === "THINKING")
        ) {
          const finMid = isEnvTestStage1TaskKind(params.taskKind)
            ? await tryStage1GithubBranchPrSmokeFinalizeDuringPoll({
                params,
                ctx: envTestPollFinalizeContextEffective,
                agentId,
                pollStartedAt: started,
                agentPollCount: completedAgentPolls,
                agentJson: last,
                logs,
                envTestGithubProbeState,
              })
            : null;
          if (finMid) {
            return {
              ok: true,
              envTestGithubEarlyFinished: true,
              envTestFinalizeOutcome: finMid,
              logs,
            };
          }
        }
      }

      // 일부 케이스에서 Cursor가 PR/commit을 이미 만들었는데 status가 RUNNING으로 오래 유지될 수 있다.
      // 이 모드에서는 PR(또는 commit hash) 증거가 있으면 조기 성공으로 처리한다(옵트인).
      if (
        !envTestStage1GithubFastLoop &&
        !isTerminalSuccess(st) &&
        shouldTreatPrAsTerminalSuccess()
      ) {
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
          if (stage2MonCtx) {
            const nowH = Date.now();
            await patchStage2((m) =>
              monitorApplyCursorAgentHeuristics(
                m,
                {
                  agentStatusUpper: st,
                  hasCommitHash: Boolean(pickCommitHash(last)),
                  hasChangedFiles: pickChangedFiles(last).length > 0,
                  isTerminalSuccess: true,
                },
                nowH
              )
            );
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
        if (stage2MonCtx) {
          const nowH = Date.now();
          await patchStage2((m) =>
            monitorApplyCursorAgentHeuristics(
              m,
              {
                agentStatusUpper: st,
                hasCommitHash: Boolean(pickCommitHash(last)),
                hasChangedFiles: pickChangedFiles(last).length > 0,
                isTerminalSuccess: true,
              },
              nowH
            )
          );
        }
        return { ok: true, result: r, logs };
      }
    }

    if (
      envTestGithubMidPollFinalize &&
      envTestPollFinalizeContextEffective &&
      envTestGithubProbeState
    ) {
      const finLast = isEnvTestStage1TaskKind(params.taskKind)
        ? await tryStage1GithubBranchPrSmokeFinalizeDuringPoll({
            params,
            ctx: envTestPollFinalizeContextEffective,
            agentId,
            pollStartedAt: started,
            agentPollCount: completedAgentPolls,
            agentJson: last,
            logs,
            envTestGithubProbeState,
          })
        : null;
      if (finLast) {
        return {
          ok: true,
          envTestGithubEarlyFinished: true,
          envTestFinalizeOutcome: finLast,
          logs,
        };
      }
    }

    if (isTaskProgressLogEnabled()) {
      const timeoutPhase = envTestStage1GithubFastLoop
        ? "env_test_stage1_poll_timeout_github_fast_loop"
          : maxPollMsEffective === 300_000
            ? "agent_poll_timeout_5m"
            : "agent_poll_timeout";
      appendTaskProgressLog({
        kind: "cursor",
        phase: timeoutPhase,
        projectId: params.projectId,
        taskId: params.task.id,
        detail: {
          agentId,
          maxWaitMs: maxPollMsEffective,
          stage1GithubFastLoop: envTestStage1GithubFastLoop,
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
