/**
 * Stage1 (ENV_TEST) only: PR smoke retry, terminal PR failure, simple pipeline after Cursor.
 * Does not import Stage2 pipeline modules — merge/finalize shared entry is `envTestGithubFinalize`.
 */
import { ENV_TEST_TASK_KIND, isEnvTestStage1TaskKind } from "@/lib/execution/envTestTaskKind";
import type { CursorRunResult } from "@/lib/execution/cursorExecutionAdapter";
import { appendTaskProgressLog } from "@/lib/observability/taskProgressLog";
import { prisma } from "@/lib/prisma";
import { normalizeStage1EnvTestHeadBranch } from "@/lib/service/githubEnvTestPullRequestService";
import {
  ENV_TEST_BRANCH_NAME_UNKNOWN_MESSAGE,
  ENV_TEST_BRANCH_NAME_UNKNOWN_SUMMARY,
  ENV_TEST_COMMITTED_SUMMARY_PLATFORM_PR,
  ENV_TEST_CONNECT_PR_FAIL_PREFIX,
  formatEnvTestPrSmokeFailureUserMessage,
} from "@/lib/service/envTestUserFacingMessages";
import { parseStage2RuntimeMonitorFromValidationOutput } from "@/lib/service/envTestStage2RuntimeMonitor";
import { patchTaskExecutionRunStage2Timing } from "@/lib/service/envTestStage2Telemetry";
import type { LoopStepRecord, RunExecutionLoopResult } from "@/lib/executionLoop/runLoopTypes";
import { refreshWorkflowStates } from "@/lib/executionLoop/workflowState";
import { EXECUTION_WORKFLOW } from "@/lib/executionLoop/workflowConstants";
import {
  pickEnvTestHeadBranch,
  requireEnvTestFamilyTaskKindForFinalize,
  runEnvTestPlatformPrPhase,
} from "@/lib/executionLoop/envTestCommonHelpers";
import { finalizeEnvTestPrOpenedFromGithubOnly } from "@/lib/executionLoop/envTestGithubFinalize";
function parsePositiveIntMs(name: string, fallback: number, bounds: { min: number; max: number }): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(bounds.max, Math.max(bounds.min, n));
}

function parsePositiveInt(name: string, fallback: number, bounds: { min: number; max: number }): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(bounds.max, Math.max(bounds.min, n));
}


/** Stage1 스모크: PR 단일 프로브 재시도(1s×최대 8회, env 상한 8). */
const ENV_TEST_STAGE1_PR_FIRST_RETRY_INTERVAL_MS = parsePositiveIntMs(
  "CURSOR_ENV_TEST_STAGE1_PR_FIRST_RETRY_INTERVAL_MS",
  1000,
  { min: 100, max: 5000 }
);
const ENV_TEST_STAGE1_PR_FIRST_RETRY_MAX = parsePositiveInt(
  "CURSOR_ENV_TEST_STAGE1_PR_FIRST_RETRY_MAX",
  8,
  { min: 1, max: 8 }
);

export function getEnvTestStage1PrFirstRetryConfig(): { intervalMs: number; maxAttempts: number } {
  return {
    intervalMs: ENV_TEST_STAGE1_PR_FIRST_RETRY_INTERVAL_MS,
    maxAttempts: ENV_TEST_STAGE1_PR_FIRST_RETRY_MAX,
  };
}

export async function applyStage1EnvTestPrCreateTerminalFailure(input: {
  projectId: string;
  taskId: string;
  execRunId: string;
  actorUserId: string;
  message: string;
  httpStatus?: number | null;
  headBranch?: string | null;
  headBranchRaw?: string | null;
  headBranchNormalized?: string | null;
  headSentToGithub?: string | null;
  repoUrl?: string | null;
  baseBranch?: string | null;
  githubPrCode?: string | null;
}): Promise<void> {
  const http = input.httpStatus != null && Number.isFinite(input.httpStatus) ? input.httpStatus : null;
  const head = String(input.headBranch ?? "").trim() || null;
  const headRaw = String(input.headBranchRaw ?? "").trim() || null;
  const headNorm = String(input.headBranchNormalized ?? "").trim() || null;
  const headSent = String(input.headSentToGithub ?? "").trim() || null;
  const ghCode = String(input.githubPrCode ?? "").trim();
  const summaryPrefix =
    http != null ? `${ENV_TEST_CONNECT_PR_FAIL_PREFIX} [http=${http}]` : ENV_TEST_CONNECT_PR_FAIL_PREFIX;
  const ghPart = ghCode ? ` [gh=${ghCode}]` : "";
  const branchPart = head ? ` 브랜치=${head}` : "";
  const headMetaParts = [
    headSent && headSent !== head ? `sent=${headSent}` : null,
    headNorm && headNorm !== head ? `norm=${headNorm}` : null,
    headRaw && headRaw !== head ? `raw=${headRaw}` : null,
  ].filter(Boolean);
  const headMeta = headMetaParts.length ? ` [${headMetaParts.join(" ")}]` : "";
  const lastEvalSummary = `${summaryPrefix}${ghPart}${branchPart}${headMeta}: ${input.message}`.slice(0, 2000);

  await prisma.taskExecutionRun.update({
    where: { id: input.execRunId },
    data: {
      status: "failed",
      evaluationDecision: "failed",
      evaluationReason: `env_test_stage1_platform_pr_failed:${input.message}`.slice(0, 8000),
    },
  });
  await prisma.task.update({
    where: { id: input.taskId },
    data: {
      executionWorkflowStatus: EXECUTION_WORKFLOW.FAILED,
      lastEvalResult: "failed",
      lastEvalSummary,
      status: "FAILED",
    },
  });
  await refreshWorkflowStates(input.projectId);

}

/**
 * Stage1 전용 단일 경로: `runEnvTestAfterGithubPushConfirmed` 없이 **COMMITTED → PR → finalize(merge)**.
 * compare·브랜치 가시성 게이트 없음.
 */
export async function runStage1EnvTestPrSmokePath(input: {
  projectId: string;
  taskId: string;
  actorUserId: string;
  execRunId: string;
  branchName: string;
  repoUrl: string;
  baseBranch: string;
  githubAccessToken?: string | null;
  execRunCreatedAt?: Date | null;
  cursorRunId?: string | null;
  cursorSummary?: string | null;
  headSha: string | null;
  changedFiles: string[];
  diffSummary: string;
  steps: LoopStepRecord[];
  singleTaskId?: string;
  effectiveAutoAdvance: boolean;
  stage1PrCreateRetry?: { intervalMs: number; maxAttempts: number } | null;
}): Promise<
  | { kind: "return"; result: RunExecutionLoopResult }
  | { kind: "continue_loop" }
  | { kind: "pr_failed"; message: string }
> {
  requireEnvTestFamilyTaskKindForFinalize(ENV_TEST_TASK_KIND, "runStage1EnvTestPrSmokePath", {
    projectId: input.projectId,
    taskId: input.taskId,
    actorUserId: input.actorUserId,
  });

  const headForPr = String(input.branchName ?? "").trim();
  if (!headForPr) {
    appendTaskProgressLog({
      kind: "execution",
      phase: "stage1_pr_phase_skipped_blocked",
      projectId: input.projectId,
      taskId: input.taskId,
      userId: input.actorUserId,
      detail: {
        projectId: input.projectId,
        taskId: input.taskId,
        executionId: input.execRunId,
        branchName: null,
        reason: "empty_branch_at_runStage1EnvTestPrSmokePath_entry",
      },
    });
    throw new Error("[runStage1EnvTestPrSmokePath] ENV_TEST requires non-empty branchName.");
  }

  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_stage1_started",
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId,
    detail: {
      executionId: input.execRunId,
      branchName: headForPr,
      cursorRunId: input.cursorRunId ?? null,
    },
  });

  const existingRunVo = await prisma.taskExecutionRun.findUnique({
    where: { id: input.execRunId },
    select: { validationOutput: true },
  });
  const preserveValidationOutput = existingRunVo?.validationOutput ?? null;

  await prisma.taskExecutionRun.update({
    where: { id: input.execRunId },
    data: {
      ...(input.cursorRunId ? { cursorRunId: input.cursorRunId } : {}),
      ...(input.cursorSummary != null ? { cursorSummary: input.cursorSummary.slice(0, 24_000) } : {}),
      branchName: headForPr,
      commitSha: input.headSha ?? null,
      changedFiles: input.changedFiles as unknown as object,
      gitSummary: input.diffSummary.slice(0, 24_000),
      validationOutput: preserveValidationOutput,
      commitStatus: input.headSha ? "pushed_commit_detected" : "pushed_commit_unknown",
      pushStatus: "pushed_by_cursor",
      status: "running",
      evaluationReason: null,
    },
  });

  const committedSummary = ENV_TEST_COMMITTED_SUMMARY_PLATFORM_PR;

  await prisma.task.update({
    where: { id: input.taskId },
    data: {
      executionWorkflowStatus: EXECUTION_WORKFLOW.COMMITTED,
      lastEvalResult: "committed",
      lastEvalSummary: committedSummary.slice(0, 2000),
    },
  });

  appendTaskProgressLog({
    kind: "execution",
    phase: "stage1_pr_phase_entered",
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId,
    detail: {
      projectId: input.projectId,
      taskId: input.taskId,
      executionId: input.execRunId,
      branchName: headForPr,
    },
  });

  const prPhase = await runEnvTestPlatformPrPhase({
    projectId: input.projectId,
    taskId: input.taskId,
    actorUserId: input.actorUserId,
    taskKind: ENV_TEST_TASK_KIND,
    repoUrl: input.repoUrl,
    baseBranch: input.baseBranch,
    headBranch: headForPr,
    githubAccessToken: input.githubAccessToken ?? null,
    executionRunCreatedAt: input.execRunCreatedAt ?? null,
    compareOkAtMs: null,
    execRunId: input.execRunId,
    stage1PrCreateRetry: input.stage1PrCreateRetry ?? getEnvTestStage1PrFirstRetryConfig(),
    suppressPrServiceLogs: true,
  });

  if (!prPhase.ok) {
    appendTaskProgressLog({
      kind: "execution",
      phase: "stage1_pr_phase_returned_failure",
      projectId: input.projectId,
      taskId: input.taskId,
      userId: input.actorUserId,
      detail: {
        projectId: input.projectId,
        taskId: input.taskId,
        executionId: input.execRunId,
        branchName: headForPr,
        httpStatus: prPhase.httpStatus ?? null,
        githubPrCode: prPhase.githubPrCode ?? null,
      },
    });
    await applyStage1EnvTestPrCreateTerminalFailure({
      projectId: input.projectId,
      taskId: input.taskId,
      execRunId: input.execRunId,
      actorUserId: input.actorUserId,
      message: prPhase.message,
      httpStatus: prPhase.httpStatus ?? null,
      headBranch: headForPr,
      headBranchRaw: prPhase.headBranchRaw ?? null,
      headBranchNormalized: prPhase.headBranchNormalized ?? null,
      headSentToGithub: prPhase.headSentToGithub ?? null,
      repoUrl: input.repoUrl,
      baseBranch: input.baseBranch,
      githubPrCode: prPhase.githubPrCode ?? null,
    });
    return { kind: "pr_failed", message: prPhase.message };
  }

  appendTaskProgressLog({
    kind: "execution",
    phase: "stage1_pr_phase_returned_success",
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.actorUserId,
    detail: {
      projectId: input.projectId,
      taskId: input.taskId,
      executionId: input.execRunId,
      branchName: headForPr,
      prNumber: prPhase.prNumber,
      prUrl: prPhase.prUrl,
      reusedExisting: prPhase.reusedExisting,
    },
  });

  await patchTaskExecutionRunStage2Timing(input.execRunId, {
    executionId: input.execRunId,
    branchDetectTimeMs: 0,
    prCreationTimeMs: prPhase.prElapsedMs,
  });

  const fin = await finalizeEnvTestPrOpenedFromGithubOnly({
    projectId: input.projectId,
    taskId: input.taskId,
    taskKind: ENV_TEST_TASK_KIND,
    execRunId: input.execRunId,
    actorUserId: input.actorUserId,
    branchName: headForPr,
    prUrl: prPhase.prUrl,
    prNumber: prPhase.prNumber,
    steps: input.steps,
    singleTaskId: input.singleTaskId,
    effectiveAutoAdvance: input.effectiveAutoAdvance,
    cursorRunId: input.cursorRunId ?? undefined,
    runDataPatch: {
      commitSha: input.headSha ?? null,
      changedFiles: input.changedFiles as unknown as object,
      gitSummary: input.diffSummary.slice(0, 24_000),
      commitStatus: input.headSha ? "pushed_commit_detected" : "pushed_commit_unknown",
    },
    snapshotPatch: {
      commitSha: input.headSha ?? null,
      changedFileCount: input.changedFiles.length,
      commitStatus: input.headSha ? "pushed_commit_detected" : "pushed_commit_unknown",
    },
  });
  if (fin.kind === "return") return { kind: "return", result: fin.result };
  return { kind: "continue_loop" };
}

/**
 * Stage 1 (ENV_TEST) 스모크: **push → PR(단일 프로브) → merge**. compare·원격 HEAD·head 게이트 없음.
 */
export async function runStage1EnvTestSimplePipeline(input: {
  projectId: string;
  taskId: string;
  taskKind: string | null;
  actorUserId: string;
  execRunId: string;
  repoUrl: string;
  baseBranch: string;
  githubAccessToken?: string | null;
  execRunCreatedAt: Date;
  plannedBranchName: string;
  promptBranchName: string;
  cr: CursorRunResult;
  steps: LoopStepRecord[];
  singleTaskId?: string;
  effectiveAutoAdvance: boolean;
}): Promise<
  | { kind: "return"; result: RunExecutionLoopResult }
  | { kind: "continue_loop" }
> {
  requireEnvTestFamilyTaskKindForFinalize(input.taskKind, "runStage1EnvTestSimplePipeline", {
    projectId: input.projectId,
    taskId: input.taskId,
    actorUserId: input.actorUserId,
  });
  if (!isEnvTestStage1TaskKind(input.taskKind)) {
    throw new Error(
      "[runStage1EnvTestSimplePipeline] taskKind must be ENV_TEST; role-separation tests use reflection/bypass pipelines."
    );
  }

  const { projectId, taskId, actorUserId, execRunId, cr } = input;
  const runMonRow = await prisma.taskExecutionRun.findUnique({
    where: { id: execRunId },
    select: { validationOutput: true, branchName: true },
  });
  const runtimeMon = parseStage2RuntimeMonitorFromValidationOutput(runMonRow?.validationOutput ?? null);
  const signalBranchNameHint = String(runtimeMon?.cursorSignal?.branchNameHint ?? "").trim() || null;
  const trackedBranchName = String(runMonRow?.branchName ?? "").trim();

  const planned = String(input.plannedBranchName ?? "").trim();
  const cursorPick = pickEnvTestHeadBranch({
    cursorBranchName: cr.branchName,
    signalBranchNameHint,
    /** Cursor 메타에 브랜치가 없어도 오케스트레이션 계획 브랜치로 PR 시도(무음 스킵 방지). */
    fallbackBranchName: planned || null,
  });
  const rawHead = String(trackedBranchName || planned || cursorPick).trim();
  const primaryHead = normalizeStage1EnvTestHeadBranch(input.repoUrl, rawHead);

  if (!primaryHead) {
    await prisma.taskExecutionRun.update({
      where: { id: execRunId },
      data: {
        status: "failed",
        evaluationDecision: "failed",
        evaluationReason: "env_test_stage1_branch_unknown",
      },
    });
    await prisma.task.update({
      where: { id: taskId },
      data: {
        executionWorkflowStatus: EXECUTION_WORKFLOW.FAILED,
        lastEvalResult: "failed",
        lastEvalSummary: ENV_TEST_BRANCH_NAME_UNKNOWN_SUMMARY,
      },
    });
    await refreshWorkflowStates(projectId);
    return {
      kind: "return",
      result: {
        ok: false,
        steps: input.steps,
        message: ENV_TEST_BRANCH_NAME_UNKNOWN_MESSAGE,
      },
    };
  }

  appendTaskProgressLog({
    kind: "execution",
    phase: "stage1_branch_resolved",
    projectId,
    taskId,
    userId: actorUserId,
    detail: {
      projectId,
      taskId,
      executionId: execRunId,
      branchName: primaryHead,
      plannedBranchName: planned || null,
      trackedBranchName: trackedBranchName || null,
      cursorBranchName: String(cr.branchName ?? "").trim() || null,
    },
  });

  const diffSummary = cr.summary.slice(0, 24_000);
  const outPr = await runStage1EnvTestPrSmokePath({
    projectId,
    taskId,
    actorUserId,
    execRunId,
    branchName: primaryHead,
    repoUrl: input.repoUrl,
    baseBranch: input.baseBranch,
    githubAccessToken: input.githubAccessToken ?? null,
    execRunCreatedAt: input.execRunCreatedAt,
    cursorRunId: cr.runId,
    cursorSummary: cr.summary,
    headSha: cr.commitHash ?? null,
    changedFiles: cr.changedFiles,
    diffSummary,
    steps: input.steps,
    singleTaskId: input.singleTaskId,
    effectiveAutoAdvance: input.effectiveAutoAdvance,
    stage1PrCreateRetry: getEnvTestStage1PrFirstRetryConfig(),
  });

  switch (outPr.kind) {
    case "pr_failed":
      return {
        kind: "return",
        result: {
          ok: false,
          steps: input.steps,
          message: formatEnvTestPrSmokeFailureUserMessage(outPr.message),
        },
      };
    case "return":
      return { kind: "return", result: outPr.result };
    case "continue_loop":
      // PR 생성·finalize 이후 merge+auto-advance일 때만 continue_loop.
      return { kind: "continue_loop" };
    default: {
      appendTaskProgressLog({
        kind: "execution",
        phase: "stage1_pr_phase_skipped_blocked",
        projectId,
        taskId,
        userId: actorUserId,
        detail: {
          projectId,
          taskId,
          executionId: execRunId,
          branchName: primaryHead,
          reason: "unexpected_runStage1EnvTestPrSmokePath_outcome",
        },
      });
      throw new Error(
        "[runStage1EnvTestSimplePipeline] ENV_TEST must complete PR phase or explicit branch/PR failure; unexpected outcome from runStage1EnvTestPrSmokePath."
      );
    }
  }
}