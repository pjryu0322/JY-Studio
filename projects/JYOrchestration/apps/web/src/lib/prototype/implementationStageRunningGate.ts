import { isActiveTaskCursorExecution } from "@/lib/prototype/taskCursorClientPollLoop";
import { isRuntimeInFlight } from "@/lib/prototype/implementationRuntimeState";
import { resolveImplementationRuntimeStateForRead } from "@/lib/runtime/implementationRuntime/implementationRuntimeUiSnapshot";
import type { ImplementationStageBoardGateContext } from "@/lib/prototype/implementationStageActionPipeline";
import type { ImplementationStageActionGateResult } from "@/lib/prototype/effectiveImplementationState";
import { parseTaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import { formatTaskCursorElapsedMinutes } from "@/lib/prototype/taskCursorClientPollLoop";
import {
  findActiveImplementationExecutionJob,
  type ImplementationExecutionJobV1,
} from "@/lib/prototype/implementationExecutionJob";
import { formatImplementationExecutionJobStatusKo } from "@/lib/prototype/implementationExecutionJobUi";
import {
  isActiveTaskCursorJobStatus,
  type TaskCursorJobSummary,
} from "@/lib/prototype/taskCursorExecutionJobTypes";

const ACTIVE_CURSOR_ACTION_IDS = new Set([
  "START_IMPLEMENTATION_QUICK_RUN",
  "REQUEST_TASK_CURSOR_EXECUTION",
  "REQUEST_CODE_AGENT_WIP",
]);

export function shouldCheckActiveImplementationExecutionGate(
  actionId: string,
): boolean {
  return ACTIVE_CURSOR_ACTION_IDS.has(actionId);
}

function formatElapsedSuffix(iso?: string | null): string {
  const elapsed = formatTaskCursorElapsedMinutes(iso);
  return elapsed != null ? ` (${elapsed}분 경과)` : "";
}

function blockForActiveExecutionJob(job: ImplementationExecutionJobV1): ImplementationStageActionGateResult {
  const elapsed = formatElapsedSuffix(job.updatedAt ?? job.startedAt);
  const statusLabel = formatImplementationExecutionJobStatusKo(job.status);
  return {
    ok: false,
    message: `현재 ${job.processTaskId} 작업이 ${statusLabel} 상태입니다${elapsed}. 완료될 때까지 기다려 주세요.`,
  };
}

function blockForActiveJob(job: TaskCursorJobSummary): ImplementationStageActionGateResult {
  const elapsed = formatElapsedSuffix(job.lastPollAt ?? null);
  return {
    ok: false,
    message: `현재 AI 개발자가 ${job.taskId} 작업을 실행 중입니다${elapsed}. 완료될 때까지 기다려 주세요.`,
  };
}

function blockForInFlightExecution(
  execution: NonNullable<ReturnType<typeof parseTaskCursorExecutionV1>>,
): ImplementationStageActionGateResult {
  const elapsed = formatElapsedSuffix(execution.updatedAt ?? execution.createdAt);
  if (execution.status === "cursor_running" || execution.status === "cursor_requested") {
    return {
      ok: false,
      message: `현재 Cloud Agent 작업 상태를 확인 중입니다${elapsed}. 완료 후 다음 작업을 실행할 수 있습니다.`,
    };
  }
  return {
    ok: false,
    message: `현재 AI 개발자가 ${execution.taskId} 작업을 실행 중입니다${elapsed}. 완료될 때까지 기다려 주세요.`,
  };
}

/** Prefer “실행 중” over env-not-ready when a cursor job or poll is already active. */
export function evaluateActiveImplementationExecutionGate(
  actionId: string,
  boardContext?: ImplementationStageBoardGateContext | null,
): ImplementationStageActionGateResult | null {
  if (!shouldCheckActiveImplementationExecutionGate(actionId)) return null;

  const executionJob = findActiveImplementationExecutionJob(
    boardContext?.implementationExecutionJobsV1,
    boardContext?.board.projectId,
  );
  if (executionJob) {
    return blockForActiveExecutionJob(executionJob);
  }

  const job = boardContext?.activeTaskCursorJob ?? null;
  if (job && isActiveTaskCursorJobStatus(job.status) && !job.completedAt) {
    return blockForActiveJob(job);
  }

  const projectId = boardContext?.board.projectId?.trim() ?? "";
  const runtime = projectId
    ? resolveImplementationRuntimeStateForRead({
        raw: (boardContext ?? {}) as Record<string, unknown>,
        projectId,
      })
    : null;
  if (isRuntimeInFlight(runtime?.runtimeState)) {
    const execution = parseTaskCursorExecutionV1(boardContext?.taskCursorExecutionV1);
    if (execution) {
      return blockForInFlightExecution(execution);
    }
    return {
      ok: false,
      message: `현재 CodeTask Runtime이 ${runtime?.runtimeState ?? "실행 중"} 상태입니다. 완료 후 다시 시도해 주세요.`,
    };
  }

  const execution = parseTaskCursorExecutionV1(boardContext?.taskCursorExecutionV1);
  if (execution && isActiveTaskCursorExecution(execution)) {
    return blockForInFlightExecution(execution);
  }

  return null;
}
