import type { ImplementationExecutionBoardV1 } from "@/lib/prototype/implementationExecutionBoard";
import {
  pickFirstExecutableDeveloperTaskId,
  pickFirstExecutableDeveloperTaskIdAfterFailure,
  pickFirstExecutableDeveloperTaskIdExcluding,
} from "@/lib/prototype/implementationExecutionBoard";
import type { ImplementationAutoQualityGateV1 } from "@/lib/prototype/implementationAutoQualityGate";
import {
  collectDependentTaskIds,
  shouldStopAutoChainForFoundationFailure,
} from "@/lib/prototype/implementationTaskDependencyGraph";
import {
  isInFlightTaskCursorExecution,
  isTaskCursorStatusCheckStopped,
} from "@/lib/prototype/taskCursorClientPollLoop";
import {
  resolveTaskCursorFailurePolicyFromExecution,
} from "@/lib/prototype/taskCursorFailurePolicy";
import {
  isTaskCursorExecutionFailed,
  type TaskCursorExecutionV1,
} from "@/lib/prototype/taskCursorExecution";
import { isTransientTaskCursorLaunchError } from "@/lib/prototype/taskCursorLaunchRetry";

export type TaskCursorAutoChainDecision =
  | Readonly<{ readonly kind: "start"; readonly taskId: string }>
  | Readonly<{ readonly kind: "continue"; readonly fromTaskId: string; readonly toTaskId: string }>
  | Readonly<{
      readonly kind: "continue_after_failure";
      readonly failedTaskId: string;
      readonly toTaskId: string;
      readonly blockedTaskIds: readonly string[];
    }>
  | Readonly<{ readonly kind: "none" }>;

function isAutoGatePassedForExecution(
  execution: TaskCursorExecutionV1,
  autoGate: ImplementationAutoQualityGateV1 | null | undefined,
): boolean {
  if (!autoGate || autoGate.status !== "passed" || autoGate.taskId !== execution.taskId) {
    return false;
  }
  const gateCommit = String(autoGate.sourceCommitSha ?? "").trim();
  const executionCommit = String(execution.commitSha ?? "").trim();
  if (!gateCommit || !executionCommit) return true;
  return gateCommit === executionCommit;
}

function isTaskReadyForAutoChainContinue(
  execution: TaskCursorExecutionV1,
  autoGate: ImplementationAutoQualityGateV1 | null | undefined,
): boolean {
  if (!isAutoGatePassedForExecution(execution, autoGate)) return false;
  return (
    execution.status === "scm_pending" ||
    execution.status === "security_pending" ||
    execution.status === "review_pending"
  );
}

export function resolveNextTaskCursorAutoChainTarget(
  board: ImplementationExecutionBoardV1 | null | undefined,
  excludeTaskIds?: readonly string[],
  allowedTaskIds?: readonly string[] | null,
): string | null {
  if (!board) return null;
  if (excludeTaskIds?.length) {
    return pickFirstExecutableDeveloperTaskIdExcluding(board, excludeTaskIds, allowedTaskIds);
  }
  return pickFirstExecutableDeveloperTaskId(board, allowedTaskIds);
}

function resolveFailureAutoChainDecision(input: {
  readonly board: ImplementationExecutionBoardV1;
  readonly execution: TaskCursorExecutionV1;
  readonly allowedTaskIds?: readonly string[] | null;
}): TaskCursorAutoChainDecision {
  const { execution, board, allowedTaskIds } = input;
  const policy = resolveTaskCursorFailurePolicyFromExecution(execution);
  if (!policy) return { kind: "none" };

  if (policy.shouldStopAll) return { kind: "none" };

  if (
    execution.status === "cursor_failed" &&
    !isTaskCursorStatusCheckStopped(execution) &&
    isTransientTaskCursorLaunchError(execution.errorMessage)
  ) {
    return { kind: "start", taskId: execution.taskId };
  }

  const nextTaskId = pickFirstExecutableDeveloperTaskIdAfterFailure(
    board,
    execution.taskId,
    allowedTaskIds,
  );
  if (!nextTaskId) {
    if (policy.canContinueIndependentTasks && !policy.shouldStopAll) {
      return { kind: "start", taskId: execution.taskId };
    }
    return { kind: "none" };
  }
  if (
    shouldStopAutoChainForFoundationFailure({
      failedTaskId: execution.taskId,
      taskRows: board.taskRows,
      nextTaskId,
    })
  ) {
    return { kind: "none" };
  }

  const blockedTaskIds = collectDependentTaskIds({
    taskRows: board.taskRows,
    failedTaskIds: [execution.taskId],
  });

  return {
    kind: "continue_after_failure",
    failedTaskId: execution.taskId,
    toTaskId: nextTaskId,
    blockedTaskIds,
  };
}

export function resolveTaskCursorAutoChainDecision(input: {
  readonly board: ImplementationExecutionBoardV1 | null | undefined;
  readonly taskCursorExecution?: TaskCursorExecutionV1 | null;
  readonly autoGate?: ImplementationAutoQualityGateV1 | null;
  readonly autoQualityGateInFlight?: boolean;
  readonly allowedTaskIds?: readonly string[] | null;
}): TaskCursorAutoChainDecision {
  if (input.autoQualityGateInFlight) return { kind: "none" };
  const execution = input.taskCursorExecution ?? null;
  if (execution && isInFlightTaskCursorExecution(execution)) return { kind: "none" };

  const board = input.board ?? null;
  const autoGate = input.autoGate ?? null;
  const allowedTaskIds = input.allowedTaskIds ?? null;
  const excludeTaskIds =
    execution && isTaskReadyForAutoChainContinue(execution, autoGate)
      ? [execution.taskId]
      : [];
  const nextTaskId = resolveNextTaskCursorAutoChainTarget(board, excludeTaskIds, allowedTaskIds);
  if (!nextTaskId && !execution) return { kind: "none" };

  if (
    autoGate?.status === "failed" &&
    execution &&
    autoGate.taskId === execution.taskId
  ) {
    return { kind: "none" };
  }

  if (
    execution &&
    (isTaskCursorExecutionFailed(execution) || execution.status === "github_verify_failed")
  ) {
    if (!board) return { kind: "none" };
    return resolveFailureAutoChainDecision({ board, execution, allowedTaskIds });
  }

  if (!nextTaskId) return { kind: "none" };

  if (!execution) {
    return { kind: "start", taskId: nextTaskId };
  }

  if (
    isTaskReadyForAutoChainContinue(execution, autoGate) &&
    nextTaskId !== execution.taskId
  ) {
    return {
      kind: "continue",
      fromTaskId: execution.taskId,
      toTaskId: nextTaskId,
    };
  }

  if (
    (execution.status === "pending" || execution.status === "prompt_ready") &&
    execution.taskId === nextTaskId
  ) {
    return { kind: "start", taskId: nextTaskId };
  }

  return { kind: "none" };
}

export function buildTaskCursorAutoChainTriggerKey(
  decision: Exclude<TaskCursorAutoChainDecision, Readonly<{ readonly kind: "none" }>>,
): string {
  if (decision.kind === "start") return `start:${decision.taskId}`;
  if (decision.kind === "continue_after_failure") {
    return `continue_after_failure:${decision.failedTaskId}->${decision.toTaskId}`;
  }
  return `continue:${decision.fromTaskId}->${decision.toTaskId}`;
}

export function formatTaskCursorAutoChainNotice(
  decision: Exclude<TaskCursorAutoChainDecision, Readonly<{ readonly kind: "none" }>>,
  board: ImplementationExecutionBoardV1 | null | undefined,
): string {
  const targetTaskId =
    decision.kind === "start"
      ? decision.taskId
      : decision.kind === "continue"
        ? decision.toTaskId
        : decision.toTaskId;
  const row = board?.taskRows.find((task) => task.taskId === targetTaskId);
  const title = row?.title ? ` · ${row.title}` : "";

  if (decision.kind === "start") {
    return `우선순위 기준 다음 작업 ${decision.taskId}${title}을(를) 자동으로 시작합니다.`;
  }
  if (decision.kind === "continue_after_failure") {
    const blockedCount = decision.blockedTaskIds.length;
    const blockedNote =
      blockedCount > 0 ? ` (의존 작업 ${blockedCount}개 차단)` : "";
    return [
      `${decision.failedTaskId} 작업은 재작업 필요로 분류했습니다.`,
      `독립적인 다음 작업 ${decision.toTaskId}${title}을(를) 계속 진행합니다${blockedNote}.`,
    ].join("\n");
  }
  return `작업 ${decision.fromTaskId} 통과 — 다음 작업 ${decision.toTaskId}${title}을(를) 자동으로 시작합니다.`;
}

export function planImmediateTaskCursorAutoChainAfterFailure(input: {
  readonly board: ImplementationExecutionBoardV1 | null | undefined;
  readonly execution: TaskCursorExecutionV1;
  readonly autoGate?: ImplementationAutoQualityGateV1 | null;
}): Readonly<{
  readonly decision: Exclude<TaskCursorAutoChainDecision, Readonly<{ readonly kind: "none" }>>;
  readonly preferredTaskId: string;
}> | null {
  const decision = resolveTaskCursorAutoChainDecision({
    board: input.board,
    taskCursorExecution: input.execution,
    autoGate: input.autoGate ?? null,
  });
  if (decision.kind === "none") return null;
  if (decision.kind === "start" && decision.taskId === input.execution.taskId) return null;
  const preferredTaskId =
    decision.kind === "start" ? decision.taskId : decision.toTaskId;
  return { decision, preferredTaskId };
}
