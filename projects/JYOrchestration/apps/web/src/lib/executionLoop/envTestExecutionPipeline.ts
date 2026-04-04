/**
 * ENV_TEST Stage 1·2 공통 파이프라인(코어 위 확장).
 *
 * - Stage 2 전용: Executor(OpenAI) ACK → 그 다음 공통 코어(`envTestExecutionCore` + cursor adapter)로 진입.
 * - Stage 1: 이 모듈의 pre-cursor 게이트는 no-op.
 *
 * PR_OPENED 이후 Stage1(direct merge smoke) vs Stage2(reviewer→security→scm) 분기는
 * `finalizeEnvTestPrOpenedFromGithubOnly` → `runEnvTestPostPrOpenedMergeAndReadiness`에서 처리한다.
 */

import { isEnvTestStage2TaskKind } from "@/lib/execution/envTestTaskKind";
import { logStage2CatalogEvent } from "@/lib/service/envTestStage2CatalogEvents";
import { prisma } from "@/lib/prisma";
import { runEnvTestStage2ExecutorOpenAiAck } from "@/lib/service/envTestStage2AiRoleEvaluation";
import { mergeEnvTestStage2RunValidationOutput } from "@/lib/service/envTestStage2PlatformActors";
import { patchTaskExecutionRunStage2Timing } from "@/lib/service/envTestStage2Telemetry";
import {
  monitorExecutorDone,
  monitorExecutorStart,
  patchTaskExecutionRunStage2RuntimeMonitor,
} from "@/lib/service/envTestStage2RuntimeMonitor";
import { appendTaskProgressLog } from "@/lib/observability/taskProgressLog";
import { refreshWorkflowStates } from "@/lib/executionLoop/workflowState";
import { EXECUTION_WORKFLOW } from "@/lib/executionLoop/workflowConstants";
import type { LoopStepRecord, RunExecutionLoopResult } from "@/lib/executionLoop/runLoopTypes";

export type EnvTestPreCursorGateResult =
  | { ok: true }
  | { ok: false; result: RunExecutionLoopResult };

/**
 * Stage 2 확장: Cursor 호출 전 Executor(OpenAI) ACK.
 * Stage 1·비 ENV_TEST에서는 즉시 `{ ok: true }`.
 */
export async function runEnvTestStage2PreCursorExecutorGate(input: {
  projectId: string;
  taskId: string;
  actorUserId: string;
  execRunId: string;
  taskKind: string | null;
  steps: LoopStepRecord[];
}): Promise<EnvTestPreCursorGateResult> {
  if (!isEnvTestStage2TaskKind(input.taskKind)) {
    return { ok: true };
  }

  const { projectId, taskId, actorUserId, execRunId, steps } = input;

  logStage2CatalogEvent({
    phase: "stage2_started",
    projectId,
    taskId,
    userId: actorUserId,
    executionId: execRunId,
  });
  appendTaskProgressLog({
    kind: "execution",
    phase: "env_test_stage2_executor_started",
    projectId,
    taskId,
    userId: actorUserId,
    detail: { execRunId },
  });
  logStage2CatalogEvent({
    phase: "executor_started",
    projectId,
    taskId,
    userId: actorUserId,
    executionId: execRunId,
  });
  await patchTaskExecutionRunStage2RuntimeMonitor(execRunId, (m) => monitorExecutorStart(m, Date.now()));
  const ex = await runEnvTestStage2ExecutorOpenAiAck({
    projectId,
    taskId,
    execRunId,
    actorUserId,
  });
  await prisma.taskExecutionRun.update({
    where: { id: execRunId },
    data: {
      validationOutput: mergeEnvTestStage2RunValidationOutput(null, {
        executorAck: {
          result: ex.ok ? "PASS" : "FAIL",
          reason: ex.ok ? "Executor(OpenAI) ACK PASS" : "Executor(OpenAI) ACK FAIL",
        },
      }),
    },
  });
  await patchTaskExecutionRunStage2Timing(execRunId, {
    executionId: execRunId,
    pipelineStartedAtMs: Date.now(),
    executorTimeMs: ex.elapsedMs,
    events: ex.timing.events,
  });
  if (!ex.ok) {
    await patchTaskExecutionRunStage2RuntimeMonitor(execRunId, (m) => monitorExecutorDone(m, Date.now()));
    const rowVo = await prisma.taskExecutionRun.findUnique({
      where: { id: execRunId },
      select: { validationOutput: true },
    });
    const voFail = mergeEnvTestStage2RunValidationOutput(rowVo?.validationOutput, {
      stage2RunSummary: {
        finalOutcome: "FAILED",
        executorResult: "FAIL",
        mergeVerified: false,
      },
    });
    await prisma.taskExecutionRun.update({
      where: { id: execRunId },
      data: {
        status: "failed",
        evaluationDecision: "failed",
        evaluationReason: "env_test_stage2_executor_ack_failed",
        validationOutput: voFail,
      },
    });
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: "FAILED",
        executionWorkflowStatus: EXECUTION_WORKFLOW.FAILED,
        lastEvalResult: "env_test_stage2_executor_ack_failed",
        lastEvalSummary: "Stage 2: Executor(OpenAI) 준비 확인이 PASS가 아닙니다.",
      },
    });
    await refreshWorkflowStates(projectId);
    logStage2CatalogEvent({
      phase: "executor_failed",
      projectId,
      taskId,
      userId: actorUserId,
      executionId: execRunId,
      detail: { reason: "executor_ack_failed" },
    });
    logStage2CatalogEvent({
      phase: "stage2_failed",
      projectId,
      taskId,
      userId: actorUserId,
      executionId: execRunId,
      detail: { step: "executor" },
    });
    steps.push({
      phase: "cursor",
      taskId,
      ok: false,
      error: "env_test_stage2_executor_ack_failed",
    });
    return {
      ok: false,
      result: {
        ok: false,
        steps,
        message: "Stage 2 Executor(OpenAI) ACK가 통과하지 못했습니다.",
      },
    };
  }
  logStage2CatalogEvent({
    phase: "executor_finished",
    projectId,
    taskId,
    userId: actorUserId,
    executionId: execRunId,
    elapsedMs: ex.elapsedMs,
    stage: "ENV_TEST_STAGE2",
    detail: { roleKey: "executor", result: "PASS", reason: "Executor(OpenAI) ACK PASS" },
  });
  logStage2CatalogEvent({
    phase: "executor_running",
    projectId,
    taskId,
    userId: actorUserId,
    executionId: execRunId,
    detail: { note: "cursor_invoke_next", roleKey: "executor" },
  });
  await patchTaskExecutionRunStage2RuntimeMonitor(execRunId, (m) => monitorExecutorDone(m, Date.now()));
  return { ok: true };
}
