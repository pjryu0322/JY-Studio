import { isEnvTestFamilyTaskKind, isEnvTestStage1TaskKind } from "@/lib/execution/envTestTaskKind";
import type {
  CursorAgentJson,
  CursorRunResult,
  ExecuteCursorRelayParams,
  ExecuteCursorRunOutcome,
} from "@/lib/execution/cursorExecutionAdapter";
import { launchCursorAgent, mapAgentToResult, pollCursorAgent } from "@/lib/execution/cursorExecutionAdapter";
import { enhanceCursorErrorIfBaseBranchRelated } from "@/lib/execution/gitBranchCursorError";
import { verifyBaseBranchBeforeCursorExecution } from "@/lib/execution/verifyBaseBranchBeforeCursor";
import {
  appendTaskProgressLog,
  isTaskProgressCursorPollEnabled,
  isTaskProgressLogEnabled,
} from "@/lib/observability/taskProgressLog";
import { normalizeStage1EnvTestHeadBranch } from "@/lib/service/githubEnvTestPullRequestService";
import { fetchGithubBranchHeadExists } from "@/lib/service/githubCompareService";
import { findOpenPullRequestByHeadBranch } from "@/lib/service/githubOpenPullRequestByHeadService";
import { getEnvTestStage1PrFirstRetryConfig, runStage1EnvTestPrSmokePath } from "@/lib/executionLoop/envTestStage1Helpers";
import { monitorCursorSignalPatch, patchTaskExecutionRunStage2RuntimeMonitor } from "@/lib/service/envTestStage2RuntimeMonitor";

type EnvTestGithubProbeState = {
  agentLaunchStartedAt: number;
  nextGithubCompareAllowedAt: number;
  compare404AttemptIndex: number;
  branchConfirmedAtMs: number | null;
  warmupLogged?: boolean;
  compareMinMsAfterLaunch: number;
  aggressiveGithubTiming: boolean;
  stage1PrSmokeAttemptDone?: boolean;
  lastBranchHeadSha?: string | null;
};

function parseEnvPositiveIntMs(name: string, fallback: number, bounds: { min: number; max: number }): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(bounds.max, Math.max(bounds.min, n));
}

function parseEnvPositiveInt(name: string, fallback: number, bounds: { min: number; max: number }): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(bounds.max, Math.max(bounds.min, n));
}

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
const ENV_TEST_COMPARE_404_BACKOFF_CAP_MS = parseEnvPositiveIntMs(
  "CURSOR_ENV_TEST_COMPARE_404_BACKOFF_CAP_MS",
  3_000,
  { min: 500, max: 3_000 }
);
const ENV_TEST_STAGE1_BRANCH_WAIT_MAX_MS = parseEnvPositiveIntMs(
  "CURSOR_ENV_TEST_STAGE1_BRANCH_WAIT_MAX_MS",
  90_000,
  { min: 30_000, max: 10 * 60 * 1000 }
);
const ENV_TEST_STAGE1_POLL_FIRST_DELAY_MS = parseEnvPositiveIntMs(
  "CURSOR_AGENT_ENV_TEST_STAGE1_POLL_FIRST_DELAY_MS",
  500,
  { min: 0, max: 30_000 }
);
const ENV_TEST_STAGE1_POST_LAUNCH_GITHUB_PROBE_DELAY_MS = parseEnvPositiveIntMs(
  "CURSOR_ENV_TEST_STAGE1_POST_LAUNCH_GITHUB_PROBE_DELAY_MS",
  0,
  { min: 0, max: 30_000 }
);
const ENV_TEST_STAGE1_POLL_FAST_WINDOW_MS = parseEnvPositiveIntMs("CURSOR_ENV_TEST_STAGE1_POLL_FAST_WINDOW_MS", 12_000, {
  min: 3_000,
  max: 120_000,
});
const ENV_TEST_STAGE1_POLL_MID_WINDOW_MS = parseEnvPositiveIntMs("CURSOR_ENV_TEST_STAGE1_POLL_MID_WINDOW_MS", 28_000, {
  min: 10_000,
  max: 300_000,
});
const ENV_TEST_STAGE1_POLL_INTERVAL_FAST_MS = parseEnvPositiveIntMs("CURSOR_ENV_TEST_STAGE1_POLL_INTERVAL_FAST_MS", 800, {
  min: 300,
  max: 5_000,
});
const ENV_TEST_STAGE1_POLL_INTERVAL_MID_MS = parseEnvPositiveIntMs("CURSOR_ENV_TEST_STAGE1_POLL_INTERVAL_MID_MS", 1_500, {
  min: 500,
  max: 8_000,
});
const ENV_TEST_STAGE1_POLL_INTERVAL_SLOW_MS = parseEnvPositiveIntMs("CURSOR_ENV_TEST_STAGE1_POLL_INTERVAL_SLOW_MS", 2_500, {
  min: 800,
  max: 10_000,
});

function envTestCursorPollIntervalMs(elapsedSincePollLoopStartMs: number): number {
  const e = Math.max(0, elapsedSincePollLoopStartMs);
  if (e < ENV_TEST_STAGE1_POLL_FAST_WINDOW_MS) return ENV_TEST_STAGE1_POLL_INTERVAL_FAST_MS;
  if (e < ENV_TEST_STAGE1_POLL_MID_WINDOW_MS) return ENV_TEST_STAGE1_POLL_INTERVAL_MID_MS;
  return ENV_TEST_STAGE1_POLL_INTERVAL_SLOW_MS;
}

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

function envTestAllowGithubHeadProbe(state: EnvTestGithubProbeState, completedAgentPolls: number): { ok: true } | { ok: false; reason: "warmup" | "backoff"; retryAfterMs?: number } {
  const now = Date.now();
  if (state.nextGithubCompareAllowedAt > now) {
    return { ok: false, reason: "backoff", retryAfterMs: Math.max(0, state.nextGithubCompareAllowedAt - now) };
  }
  const elapsed = now - state.agentLaunchStartedAt;
  const ok = completedAgentPolls >= ENV_TEST_GITHUB_COMPARE_MIN_COMPLETED_POLLS || elapsed >= state.compareMinMsAfterLaunch;
  return ok ? { ok: true } : { ok: false, reason: "warmup" };
}

function envTestApplyGithubProbe404Backoff(
  state: EnvTestGithubProbeState,
  logCtx: { projectId: string; taskId: string; userId?: string; headBranch: string; source: string; executionId?: string | null; trackedBranchName?: string | null },
  httpStatus: number | undefined,
  variant: "branch" | "compare" = "compare"
): void {
  const idx = state.compare404AttemptIndex;
  const delayMs = envTestCompare404BackoffDelayMs(idx, state.aggressiveGithubTiming);
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
      executionId: logCtx.executionId ?? null,
      trackedBranchName: logCtx.trackedBranchName ?? null,
    },
  });
}

async function tryStage1PrSmokeFinalizeDuringPoll(input: {
  params: ExecuteCursorRelayParams;
  agentId: string;
  pollStartedAt: number;
  agentPollCount: number;
  agentJson: CursorAgentJson;
  logs: string[];
  probeState: EnvTestGithubProbeState;
}): Promise<
  | { kind: "return"; result: import("@/lib/executionLoop/runLoopTypes").RunExecutionLoopResult }
  | { kind: "continue_loop" }
  | null
> {
  if (!isEnvTestStage1TaskKind(input.params.taskKind)) return null;
  const ctx = input.params.envTestPollFinalizeContext ?? null;
  if (!ctx) return null;
  if (input.probeState.stage1PrSmokeAttemptDone) return null;

  const setup = input.params.executionSetup;
  const primaryHead = normalizeStage1EnvTestHeadBranch(setup.gitRepoUrl, input.params.suggestedBranchName);
  if (!primaryHead) return null;

  const gate = envTestAllowGithubHeadProbe(input.probeState, input.agentPollCount);
  if (!gate.ok) return null;

  const branchProbe = await fetchGithubBranchHeadExists({
    repoUrl: setup.gitRepoUrl,
    branch: primaryHead,
    githubAccessToken: ctx.githubAccessToken ?? null,
    projectId: input.params.projectId,
  });
  if (!branchProbe.ok) {
    if (branchProbe.httpStatus === 404) {
      envTestApplyGithubProbe404Backoff(
        input.probeState,
        {
          projectId: input.params.projectId,
          taskId: ctx.taskId,
          userId: ctx.actorUserId,
          headBranch: primaryHead,
          source: "stage1_cursor_poll_branch_head",
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
  if (input.probeState.branchConfirmedAtMs == null) {
    input.probeState.branchConfirmedAtMs = branchConfirmedAt;
    appendTaskProgressLog({
      kind: "execution",
      phase: "stage1_branch_resolved",
      projectId: input.params.projectId,
      taskId: ctx.taskId,
      userId: ctx.actorUserId,
      detail: {
        executionId: ctx.execRunId,
        branchName: primaryHead,
        source: "cursor_poll_github_branch_exists",
        elapsedMsSinceLaunch: branchConfirmedAt - input.probeState.agentLaunchStartedAt,
      },
    });
  }
  input.probeState.lastBranchHeadSha = branchProbe.headSha ?? null;
  input.probeState.stage1PrSmokeAttemptDone = true;

  const mapped = mapAgentToResult(input.agentJson as any, input.params.suggestedBranchName.trim());
  const diffSummary = mapped.summary.slice(0, 24_000);
  const headSha = (mapped.commitHash ?? branchProbe.headSha ?? "").trim() || null;

  const out = await runStage1EnvTestPrSmokePath({
    projectId: input.params.projectId,
    taskId: ctx.taskId,
    actorUserId: ctx.actorUserId,
    execRunId: ctx.execRunId,
    branchName: primaryHead,
    repoUrl: ctx.repoUrl,
    baseBranch: ctx.baseBranch,
    githubAccessToken: ctx.githubAccessToken ?? null,
    execRunCreatedAt: ctx.execRunCreatedAt,
    cursorRunId: input.agentId,
    cursorSummary: mapped.summary,
    headSha,
    changedFiles: mapped.changedFiles,
    diffSummary,
    steps: ctx.steps,
    singleTaskId: ctx.singleTaskId,
    effectiveAutoAdvance: ctx.effectiveAutoAdvance,
    stage1PrCreateRetry: getEnvTestStage1PrFirstRetryConfig(),
  });

  const elapsedMs = Date.now() - input.pollStartedAt;
  if (out.kind === "pr_failed") {
    appendTaskProgressLog({
      kind: "execution",
      phase: "stage1_pr_smoke_failed_during_poll",
      projectId: input.params.projectId,
      taskId: ctx.taskId,
      userId: ctx.actorUserId,
      detail: { elapsedMs, agentPollCount: input.agentPollCount, agentId: input.agentId, message: (out.message ?? "").slice(0, 500) },
    });
    return {
      kind: "return",
      result: { ok: false, steps: ctx.steps, message: "ENV_TEST(Stage1): 플랫폼이 GitHub PR을 생성·갱신하지 못했습니다." },
    };
  }

  ctx.steps.push({ phase: "cursor", taskId: ctx.taskId, ok: true, runId: input.agentId });
  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_poll_stopped_after_stage1_pr_smoke",
    projectId: input.params.projectId,
    taskId: ctx.taskId,
    userId: ctx.actorUserId,
    detail: { elapsedMs, agentPollCount: input.agentPollCount, agentId: input.agentId, headBranch: primaryHead },
  });
  input.logs.push("[stage1-finalize] ENV_TEST Stage1: GitHub 브랜치 확인 후 PR 스모크 경로로 폴링 종료");

  if (out.kind === "return") return { kind: "return", result: out.result };
  return { kind: "continue_loop" };
}

async function tryStage1PrOpenedEarlyExit(input: {
  params: ExecuteCursorRelayParams;
  agentId: string;
  pollStartedAt: number;
  pollRoundLabel: number;
  agentJson: CursorAgentJson;
  fallbackBranch: string;
}): Promise<CursorRunResult | null> {
  if (!isEnvTestFamilyTaskKind(input.params.taskKind)) return null;
  const elapsedMs = Date.now() - input.pollStartedAt;
  const setup = input.params.executionSetup;
  const headForPrLookup = normalizeStage1EnvTestHeadBranch(setup.gitRepoUrl, input.params.suggestedBranchName);
  if (!headForPrLookup) return null;

  const openPr = await findOpenPullRequestByHeadBranch({
    repoUrl: setup.gitRepoUrl,
    headBranch: headForPrLookup,
    githubAccessToken: input.params.githubAccessToken ?? null,
    projectId: input.params.projectId,
  });
  if (!openPr) return null;

  if (isTaskProgressLogEnabled()) {
    appendTaskProgressLog({
      kind: "execution",
      phase: "env_test_poll_stopped_after_pr_opened",
      projectId: input.params.projectId,
      taskId: input.params.task.id,
      detail: { elapsedMs, pollRound: input.pollRoundLabel, prUrl: openPr.prUrl, prNumber: openPr.prNumber, agentId: input.agentId },
    });
    appendTaskProgressLog({
      kind: "execution",
      phase: "env_test_early_exit_after_pr",
      projectId: input.params.projectId,
      taskId: input.params.task.id,
      detail: { elapsedMs, pollRound: input.pollRoundLabel, reason: "open_pr_on_github", agentId: input.agentId },
    });
  }
  const r = mapAgentToResult(input.agentJson as any, input.fallbackBranch);
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

export async function executeStage1CursorRunWithGithubFinalize(
  params: ExecuteCursorRelayParams
): Promise<ExecuteCursorRunOutcome> {
  const logs: string[] = [];
  const setup = params.executionSetup;
  const branchCtx = { gitRepoUrl: setup.gitRepoUrl, baseBranch: setup.baseBranch };
  if (!isEnvTestStage1TaskKind(params.taskKind)) {
    return { ok: false, error: "Stage1 helper called with non-Stage1 taskKind.", logs };
  }

  const preBranch = await verifyBaseBranchBeforeCursorExecution({
    gitRepoUrl: setup.gitRepoUrl,
    baseBranch: setup.baseBranch,
    githubAccessToken: params.githubAccessToken ?? null,
    projectId: params.projectId,
  });
  if (!preBranch.ok) {
    return { ok: false, error: enhanceCursorErrorIfBaseBranchRelated(preBranch.message, branchCtx), logs };
  }

  const launch = await launchCursorAgent(params);
  logs.push(...launch.logs);
  if (!launch.ok) {
    return { ok: false, error: enhanceCursorErrorIfBaseBranchRelated(launch.error, branchCtx), logs };
  }

  const startedAt = Date.now();
  const probeState: EnvTestGithubProbeState = {
    agentLaunchStartedAt: startedAt,
    nextGithubCompareAllowedAt: 0,
    compare404AttemptIndex: 0,
    branchConfirmedAtMs: null,
    compareMinMsAfterLaunch: 0,
    aggressiveGithubTiming: true,
  };

  if (params.stage2RuntimeMonitor?.execRunId) {
    const nowSig = Date.now();
    await patchTaskExecutionRunStage2RuntimeMonitor(params.stage2RuntimeMonitor.execRunId, (m) =>
      monitorCursorSignalPatch(m, { agentLaunchedAtMs: nowSig, branchNameHint: params.suggestedBranchName }, nowSig)
    );
  }

  const immediatePr = await tryStage1PrOpenedEarlyExit({
    params,
    agentId: launch.agentId,
    pollStartedAt: startedAt,
    pollRoundLabel: 0,
    agentJson: launch.launchJson,
    fallbackBranch: params.suggestedBranchName,
  });
  if (immediatePr) {
    logs.push("[stage1-finalize] PR opened detected immediately; stop polling");
    return { ok: true, result: immediatePr, logs };
  }

  await new Promise((r) => setTimeout(r, ENV_TEST_STAGE1_POST_LAUNCH_GITHUB_PROBE_DELAY_MS));
  const finLaunch = await tryStage1PrSmokeFinalizeDuringPoll({
    params,
    agentId: launch.agentId,
    pollStartedAt: startedAt,
    agentPollCount: 0,
    agentJson: launch.launchJson,
    logs,
    probeState,
  });
  if (finLaunch) {
    return { ok: true, envTestGithubEarlyFinished: true, envTestFinalizeOutcome: finLaunch, logs };
  }

  let completedPolls = 0;
  while (Date.now() - startedAt < ENV_TEST_STAGE1_BRANCH_WAIT_MAX_MS) {
    const preDelay = completedPolls === 0 ? ENV_TEST_STAGE1_POLL_FIRST_DELAY_MS : envTestCursorPollIntervalMs(Date.now() - startedAt);
    await new Promise((r) => setTimeout(r, preDelay));
    completedPolls += 1;

    if (isTaskProgressCursorPollEnabled()) {
      appendTaskProgressLog({
        kind: "cursor",
        phase: "agent_poll",
        projectId: params.projectId,
        taskId: params.task.id,
        detail: { agentId: launch.agentId, pollRound: completedPolls },
      });
    }

    const polled = await pollCursorAgent({
      cursorApiUrl: params.executionSetup.cursorApiUrl,
      cursorApiToken: params.executionSetup.cursorApiToken ?? "",
      agentId: launch.agentId,
      fallbackBranchName: params.suggestedBranchName,
    });
    if (!polled.ok) {
      return { ok: false, error: enhanceCursorErrorIfBaseBranchRelated(polled.error, branchCtx), logs };
    }

    const earlyPr = await tryStage1PrOpenedEarlyExit({
      params,
      agentId: launch.agentId,
      pollStartedAt: startedAt,
      pollRoundLabel: completedPolls,
      agentJson: polled.agentJson,
      fallbackBranch: params.suggestedBranchName,
    });
    if (earlyPr) {
      logs.push("[stage1-finalize] PR opened detected; stop polling");
      return { ok: true, result: earlyPr, logs };
    }

    const finMid = await tryStage1PrSmokeFinalizeDuringPoll({
      params,
      agentId: launch.agentId,
      pollStartedAt: startedAt,
      agentPollCount: completedPolls,
      agentJson: polled.agentJson,
      logs,
      probeState,
    });
    if (finMid) {
      return { ok: true, envTestGithubEarlyFinished: true, envTestFinalizeOutcome: finMid, logs };
    }

    const statusUpper = String((polled.agentJson as any).status ?? "").toUpperCase();
    if (statusUpper === "FAILED" || statusUpper === "ERROR" || statusUpper === "CANCELLED" || statusUpper === "CANCELED" || statusUpper === "STOPPED") {
      const r = mapAgentToResult(polled.agentJson as any, params.suggestedBranchName);
      return { ok: false, error: enhanceCursorErrorIfBaseBranchRelated(r.error || r.summary || "Cloud Agent 실패", branchCtx), logs };
    }
    if (statusUpper === "FINISHED" || statusUpper === "COMPLETED" || statusUpper === "DONE") {
      const r = mapAgentToResult(polled.agentJson as any, params.suggestedBranchName);
      return { ok: true, result: r, logs };
    }
  }

  return {
    ok: false,
    error: enhanceCursorErrorIfBaseBranchRelated(
      "ENV_TEST(Stage1): GitHub 브랜치/PR 반영이 제한 시간 내에 확인되지 않았습니다.",
      branchCtx
    ),
    logs,
  };
}

