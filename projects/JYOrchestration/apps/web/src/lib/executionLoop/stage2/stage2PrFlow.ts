/**
 * Stage2: GitHub push/compare confirmed → COMMITTED → platform PR → PR_OPENED finalize.
 * Does not import Stage1 PR smoke or Stage1 retry helpers.
 */
import {
  isEnvTestFamilyTaskKind,
  isEnvTestStage1TaskKind,
  isEnvTestStage2TaskKind,
} from "@/lib/execution/envTestTaskKind";
import { appendTaskProgressLog } from "@/lib/observability/taskProgressLog";
import { logStage2CatalogEvent } from "@/lib/service/envTestStage2CatalogEvents";
import { prisma } from "@/lib/prisma";
import type { LoopStepRecord, RunExecutionLoopResult } from "@/lib/executionLoop/runLoopTypes";
import { EXECUTION_WORKFLOW } from "@/lib/executionLoop/workflowConstants";
import { requireEnvTestFamilyTaskKindForFinalize, runEnvTestPlatformPrPhase } from "@/lib/executionLoop/envTestCommonHelpers";
import { finalizeEnvTestPrOpenedFromGithubOnly } from "@/lib/executionLoop/envTestGithubFinalize";
import { patchTaskExecutionRunStage2Timing } from "@/lib/service/envTestStage2Telemetry";
import { logStage2PrCreationCheck } from "@/lib/executionLoop/envTestStage2Helpers";
import { appendStage2ProgressPhase, STAGE2_PROGRESS_PHASE } from "@/lib/executionLoop/stage2/stage2CanonicalProgressPhases";

export async function runEnvTestAfterGithubPushConfirmed(input: {
  projectId: string;
  taskId: string;
  taskKind: string | null;
  execRunId: string;
  actorUserId: string;
  branchName: string;
  repoUrl: string;
  baseBranch: string;
  githubAccessToken?: string | null;
  compareData: {
    headSha: string | null;
    changedFiles: string[];
    diffSummary: string;
    compareOkAtMs?: number | null;
  };
  steps: LoopStepRecord[];
  singleTaskId?: string;
  effectiveAutoAdvance: boolean;
  cursorRunId?: string | null;
  cursorSummary?: string | null;
  via: string;
  pushDetectedSource: string;
  executionRunCreatedAt?: Date | null;
  branchDetectElapsedMs?: number | null;
}): Promise<
  | { kind: "return"; result: RunExecutionLoopResult }
  | { kind: "continue_loop" }
  | { kind: "pr_failed"; message: string }
> {
  requireEnvTestFamilyTaskKindForFinalize(input.taskKind, "runEnvTestAfterGithubPushConfirmed", {
    projectId: input.projectId,
    taskId: input.taskId,
    actorUserId: input.actorUserId,
  });
  if (isEnvTestStage1TaskKind(input.taskKind)) {
    throw new Error(
      "[runEnvTestAfterGithubPushConfirmed] ENV_TEST must use runStage1EnvTestPrSmokePath / runStage1EnvTestSimplePipeline only"
    );
  }

  const existingRunVo = await prisma.taskExecutionRun.findUnique({
    where: { id: input.execRunId },
    select: { validationOutput: true },
  });
  const preserveValidationOutput = isEnvTestFamilyTaskKind(input.taskKind)
    ? existingRunVo?.validationOutput
    : null;

  await prisma.taskExecutionRun.update({
    where: { id: input.execRunId },
    data: {
      ...(input.cursorRunId ? { cursorRunId: input.cursorRunId } : {}),
      ...(input.cursorSummary != null ? { cursorSummary: input.cursorSummary.slice(0, 24_000) } : {}),
      branchName: input.branchName,
      commitSha: input.compareData.headSha ?? null,
      changedFiles: input.compareData.changedFiles as unknown as object,
      gitSummary: input.compareData.diffSummary.slice(0, 24_000),
      validationOutput: preserveValidationOutput ?? null,
      commitStatus: input.compareData.headSha ? "pushed_commit_detected" : "pushed_commit_unknown",
      pushStatus: "pushed_by_github_compare",
      status: "running",
      evaluationReason: null,
    },
  });

  if (isEnvTestStage2TaskKind(input.taskKind)) {
    logStage2CatalogEvent({
      phase: "branch_reflected",
      projectId: input.projectId,
      taskId: input.taskId,
      userId: input.actorUserId,
      executionId: input.execRunId,
      detail: { via: input.via },
    });
    appendStage2ProgressPhase(STAGE2_PROGRESS_PHASE.BRANCH_REFLECTED, {
      projectId: input.projectId,
      taskId: input.taskId,
      actorUserId: input.actorUserId,
      executionId: input.execRunId,
      detail: { via: input.via, source: input.pushDetectedSource },
    });
  }

  const committedSummary =
    input.via === "cursor_error_recovery"
      ? "ENV_TEST: GitHub compare로 푸시 확인 후 플랫폼 PR 처리."
      : input.via === "reflection_bypass"
        ? "ENV_TEST: Cursor 메타 미확인, GitHub compare로 푸시 확인 후 플랫폼 PR."
        : input.via === "cursor_poll_early_github"
          ? "ENV_TEST: Cursor 폴링 중 GitHub compare로 푸시 확인 후 플랫폼 PR 처리."
          : input.via === "cursor_poll_stage2_branch_head"
            ? "환경 연결 테스트(역할 분리): GitHub 브랜치 HEAD 확인 후 플랫폼 PR 처리(Cursor 터미널 대기 없음)."
            : "ENV_TEST: GitHub에서 브랜치가 베이스보다 앞서 있음(ahead_by). 플랫폼이 PR을 처리합니다.";

  await prisma.task.update({
    where: { id: input.taskId },
    data: {
      executionWorkflowStatus: EXECUTION_WORKFLOW.COMMITTED,
      lastEvalResult: "committed",
      lastEvalSummary: committedSummary.slice(0, 2000),
    },
  });

  if (isEnvTestStage2TaskKind(input.taskKind)) {
    logStage2PrCreationCheck("stage2_pr_creation_started", {
      projectId: input.projectId,
      taskId: input.taskId,
      actorUserId: input.actorUserId,
      detail: { headBranch: input.branchName },
    });
  }
  const prPhase = await runEnvTestPlatformPrPhase({
    projectId: input.projectId,
    taskId: input.taskId,
    actorUserId: input.actorUserId,
    taskKind: input.taskKind,
    repoUrl: input.repoUrl,
    baseBranch: input.baseBranch,
    headBranch: input.branchName,
    githubAccessToken: input.githubAccessToken ?? null,
    executionRunCreatedAt: input.executionRunCreatedAt ?? null,
    compareOkAtMs: input.compareData.compareOkAtMs ?? null,
    execRunId: input.execRunId,
  });
  if (!prPhase.ok) {
    if (isEnvTestStage2TaskKind(input.taskKind)) {
      logStage2PrCreationCheck("stage2_pr_creation_failed", {
        projectId: input.projectId,
        taskId: input.taskId,
        actorUserId: input.actorUserId,
        detail: { message: prPhase.message.slice(0, 800) },
      });
    }
    return { kind: "pr_failed", message: prPhase.message };
  }
  if (isEnvTestStage2TaskKind(input.taskKind)) {
    logStage2PrCreationCheck("stage2_pr_creation_passed", {
      projectId: input.projectId,
      taskId: input.taskId,
      actorUserId: input.actorUserId,
      detail: { prNumber: prPhase.prNumber, prUrl: prPhase.prUrl },
    });
  }

  if (isEnvTestStage2TaskKind(input.taskKind)) {
    await patchTaskExecutionRunStage2Timing(input.execRunId, {
      executionId: input.execRunId,
      branchDetectTimeMs: input.branchDetectElapsedMs ?? undefined,
      prCreationTimeMs: prPhase.prElapsedMs,
    });
    appendTaskProgressLog({
      kind: "execution",
      phase: "env_test_stage2_pr_phase_timings",
      projectId: input.projectId,
      taskId: input.taskId,
      userId: input.actorUserId,
      detail: {
        executionId: input.execRunId,
        branchDetectElapsedMs: input.branchDetectElapsedMs ?? null,
        prCreationElapsedMs: prPhase.prElapsedMs,
      },
    });
  }

  const fin = await finalizeEnvTestPrOpenedFromGithubOnly({
    projectId: input.projectId,
    taskId: input.taskId,
    taskKind: input.taskKind,
    execRunId: input.execRunId,
    actorUserId: input.actorUserId,
    branchName: input.branchName,
    prUrl: prPhase.prUrl,
    prNumber: prPhase.prNumber,
    steps: input.steps,
    singleTaskId: input.singleTaskId,
    effectiveAutoAdvance: input.effectiveAutoAdvance,
    cursorRunId: input.cursorRunId ?? undefined,
    via: input.via,
    runDataPatch: {
      commitSha: input.compareData.headSha ?? null,
      changedFiles: input.compareData.changedFiles as unknown as object,
      gitSummary: input.compareData.diffSummary.slice(0, 24_000),
      commitStatus: input.compareData.headSha ? "pushed_commit_detected" : "pushed_commit_unknown",
    },
    snapshotPatch: {
      commitSha: input.compareData.headSha ?? null,
      changedFileCount: input.compareData.changedFiles.length,
      commitStatus: input.compareData.headSha ? "pushed_commit_detected" : "pushed_commit_unknown",
    },
  });
  if (fin.kind === "return") return { kind: "return", result: fin.result };
  return { kind: "continue_loop" };
}

