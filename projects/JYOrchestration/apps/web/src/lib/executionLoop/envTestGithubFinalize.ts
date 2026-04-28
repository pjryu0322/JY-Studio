/**
 * Post–PR_OPENED GitHub finalize: shared DB/task snapshot updates, then Stage1 merge vs Stage2 reviewer chain.
 * Stage1 merge semantics stay here; Stage2 post-PR orchestration delegates to stage2/stage2ReviewScmFlow.
 */
import { isEnvTestStage1TaskKind, isEnvTestStage2TaskKind } from "@/lib/execution/envTestTaskKind";
import { parseEnvTestMergeModeFromTaskDescription } from "@/lib/service/envTestTaskMeta";
import { appendTaskProgressLog } from "@/lib/observability/taskProgressLog";
import { prisma } from "@/lib/prisma";
import { executeEnvTestPrMergeSmokeTest } from "@/lib/service/environmentTestMergeService";
import { logStage2CatalogEvent } from "@/lib/service/envTestStage2CatalogEvents";
import { patchTaskExecutionRunStage2Timing } from "@/lib/service/envTestStage2Telemetry";
import { evaluateNextTaskReadiness } from "@/lib/executionLoop/nextTaskReadiness";
import type { LoopStepRecord, RunExecutionLoopResult } from "@/lib/executionLoop/runLoopTypes";
import { refreshWorkflowStates, updateTaskOrchestrationSnapshot } from "@/lib/executionLoop/workflowState";
import { EXECUTION_WORKFLOW } from "@/lib/executionLoop/workflowConstants";
import { requireEnvTestFamilyTaskKindForFinalize } from "@/lib/executionLoop/envTestCommonHelpers";
import { runEnvTestStage2ReviewScmAfterPrOpened } from "@/lib/executionLoop/stage2/stage2ReviewScmFlow";
import { appendStage2ProgressPhase, STAGE2_PROGRESS_PHASE } from "@/lib/executionLoop/stage2/stage2CanonicalProgressPhases";

export type EnvTestGithubFinalizeReturn =
  | { kind: "return"; result: RunExecutionLoopResult }
  | { kind: "continue_loop" };

/**
 * PR_OPENED DB 반영 이후 고정 분기: Stage 1은 direct merge smoke, Stage 2는 reviewer→security→scm.
 */
export async function runEnvTestPostPrOpenedMergeAndReadiness(input: {
  projectId: string;
  taskId: string;
  taskKind: string | null;
  execRunId: string;
  actorUserId: string;
  prNumber: number;
  prUrl?: string | null;
  steps: LoopStepRecord[];
  singleTaskId?: string;
  effectiveAutoAdvance: boolean;
}): Promise<EnvTestGithubFinalizeReturn> {
  requireEnvTestFamilyTaskKindForFinalize(input.taskKind, "runEnvTestPostPrOpenedMergeAndReadiness", {
    projectId: input.projectId,
    taskId: input.taskId,
    actorUserId: input.actorUserId,
  });

  if (isEnvTestStage2TaskKind(input.taskKind)) {
    logStage2CatalogEvent({
      phase: "pr_opened",
      projectId: input.projectId,
      taskId: input.taskId,
      userId: input.actorUserId,
      executionId: input.execRunId,
      detail: {
        prNumber: input.prNumber,
        prUrl: input.prUrl ?? undefined,
      },
    });
    appendStage2ProgressPhase(STAGE2_PROGRESS_PHASE.PR_OPENED, {
      projectId: input.projectId,
      taskId: input.taskId,
      actorUserId: input.actorUserId,
      executionId: input.execRunId,
      detail: { prNumber: input.prNumber, prUrl: input.prUrl ?? null },
    });
  }

  const readiness = await evaluateNextTaskReadiness({
    projectId: input.projectId,
    excludeTaskExecutionRunId: input.execRunId,
  });

  let mergeRes: Awaited<ReturnType<typeof executeEnvTestPrMergeSmokeTest>>;

  if (isEnvTestStage2TaskKind(input.taskKind)) {
    mergeRes = await runEnvTestStage2ReviewScmAfterPrOpened({
      projectId: input.projectId,
      taskId: input.taskId,
      execRunId: input.execRunId,
      actorUserId: input.actorUserId,
      prNumber: input.prNumber,
    });
  } else {
    const stage1RunBranch = await prisma.taskExecutionRun.findUnique({
      where: { id: input.execRunId },
      select: { branchName: true, createdAt: true },
    });
    const taskRow = await prisma.task.findUnique({
      where: { id: input.taskId },
      select: { description: true },
    });
    const mergeMode = parseEnvTestMergeModeFromTaskDescription(taskRow?.description ?? null);
    let mergeElapsedMs: number | null = null;
    if (mergeMode === "skip") {
      mergeRes = {
        ok: true,
        message: "연결 테스트 성공 (PR 생성 완료)",
        mergeCommitSha: null,
        branchDeleted: false,
      };
      appendTaskProgressLog({
        kind: "execution",
        phase: "env_test_connection_merge_skipped",
        projectId: input.projectId,
        taskId: input.taskId,
        userId: input.actorUserId,
        detail: {
          executionId: input.execRunId,
          prNumber: input.prNumber,
          mergeMode: "skip",
        },
      });
    } else {
      appendTaskProgressLog({
        kind: "execution",
        phase: "env_test_stage1_merge_started",
        projectId: input.projectId,
        taskId: input.taskId,
        userId: input.actorUserId,
        detail: {
          executionId: input.execRunId,
          taskKind: input.taskKind,
          branchName: stage1RunBranch?.branchName ?? null,
          prNumber: input.prNumber,
        },
      });
      const mergePhaseStartedAt = Date.now();
      mergeRes = await executeEnvTestPrMergeSmokeTest({
        projectId: input.projectId,
        actorUserId: input.actorUserId,
      });
      mergeElapsedMs = Date.now() - mergePhaseStartedAt;
      await patchTaskExecutionRunStage2Timing(input.execRunId, { mergeTimeMs: mergeElapsedMs });
    }
    if (mergeRes.ok === true) {
      const totalElapsedSinceRunMs =
        stage1RunBranch?.createdAt != null ? Date.now() - stage1RunBranch.createdAt.getTime() : null;
      appendTaskProgressLog({
        kind: "execution",
        phase: "env_test_stage1_finished",
        projectId: input.projectId,
        taskId: input.taskId,
        userId: input.actorUserId,
        detail: {
          executionId: input.execRunId,
          mergeElapsedMs,
          mergeCommitSha: mergeRes.mergeCommitSha ?? null,
          prNumber: input.prNumber,
          totalElapsedSinceRunMs,
          outcome: "success",
        },
      });
    }
  }

  if (input.singleTaskId || !input.effectiveAutoAdvance || !mergeRes.ok) {
    const mergeOk = mergeRes.ok === true;
    return {
      kind: "return",
      result: {
        ok: mergeOk,
        steps: input.steps,
        message: mergeOk
          ? (mergeRes.message ?? "환경 연결 테스트가 정상 완료되었습니다.")
          : (mergeRes.message ?? "환경 연결 테스트: 머지 단계에서 실패했습니다."),
        nextTaskReadiness: readiness,
      },
    };
  }
  return { kind: "continue_loop" };
}

/** ENV_TEST 전용: GitHub API 기준 PR_OPENED·run 완료 정리. */
export async function finalizeEnvTestPrOpenedFromGithubOnly(input: {
  projectId: string;
  taskId: string;
  taskKind: string | null;
  execRunId: string;
  actorUserId: string;
  branchName: string;
  prUrl: string;
  prNumber: number;
  steps: LoopStepRecord[];
  singleTaskId?: string;
  effectiveAutoAdvance: boolean;
  cursorRunId?: string | null;
  via?: string;
  runDataPatch?: {
    commitSha?: string | null;
    changedFiles?: object;
    gitSummary?: string | null;
    commitStatus?: string | null;
  };
  snapshotPatch?: {
    commitSha?: string | null;
    changedFileCount?: number | null;
    commitStatus?: string | null;
  };
}): Promise<EnvTestGithubFinalizeReturn> {
  requireEnvTestFamilyTaskKindForFinalize(input.taskKind, "finalizeEnvTestPrOpenedFromGithubOnly", {
    projectId: input.projectId,
    taskId: input.taskId,
    actorUserId: input.actorUserId,
  });
  const lastEvalSummary =
    "플랫폼이 GitHub API로 연결 테스트 PR을 생성·갱신하고 PR_OPENED로 처리했습니다.";

  const runMeta = await prisma.taskExecutionRun.findUnique({
    where: { id: input.execRunId },
    select: { createdAt: true },
  });
  const completedAt = new Date();
  const elapsedMsSinceRunStart =
    runMeta?.createdAt != null ? completedAt.getTime() - runMeta.createdAt.getTime() : null;
  await prisma.taskExecutionRun.update({
    where: { id: input.execRunId },
    data: {
      status: "done",
      evaluationDecision: "done",
      prStatus: `open:${input.prNumber}:${input.prUrl}`,
      pushStatus: "pr_opened",
      completedAt,
      ...(input.cursorRunId ? { cursorRunId: input.cursorRunId } : {}),
      ...(input.runDataPatch ?? {}),
    },
  });

  await prisma.task.update({
    where: { id: input.taskId },
    data: {
      executionWorkflowStatus: EXECUTION_WORKFLOW.PR_OPENED,
      status: "DONE",
      lastEvalResult: "pr_opened",
      lastEvalSummary: lastEvalSummary.slice(0, 2000),
      loopRetryCount: 0,
    },
  });

  await updateTaskOrchestrationSnapshot(input.taskId, {
    branch: input.branchName,
    pushStatus: "pr_opened",
    ...(input.snapshotPatch ?? {}),
  });

  await refreshWorkflowStates(input.projectId);

  if (isEnvTestStage1TaskKind(input.taskKind)) {
    appendTaskProgressLog({
      kind: "execution",
      phase: "env_test_stage1_pr_opened",
      projectId: input.projectId,
      taskId: input.taskId,
      userId: input.actorUserId,
      detail: {
        executionId: input.execRunId,
        prNumber: input.prNumber,
        prUrl: input.prUrl,
        branchName: input.branchName,
        elapsedMsSinceRunStart,
      },
    });
  }

  return runEnvTestPostPrOpenedMergeAndReadiness({
    projectId: input.projectId,
    taskId: input.taskId,
    taskKind: input.taskKind,
    execRunId: input.execRunId,
    actorUserId: input.actorUserId,
    prNumber: input.prNumber,
    prUrl: input.prUrl,
    steps: input.steps,
    singleTaskId: input.singleTaskId,
    effectiveAutoAdvance: input.effectiveAutoAdvance,
  });
}
