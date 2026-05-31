import type { ImplementationExecutionBoardV1 } from "@/lib/prototype/implementationExecutionBoard";
import { pickFirstExecutableDeveloperTaskIdExcluding } from "@/lib/prototype/implementationExecutionBoard";
import type { ImplementationAutoQualityGateV1 } from "@/lib/prototype/implementationAutoQualityGate";
import { isInFlightTaskCursorExecution } from "@/lib/prototype/taskCursorClientPollLoop";
import {
  isTaskCursorExecutionFailed,
  type TaskCursorExecutionV1,
} from "@/lib/prototype/taskCursorExecution";
import { isTransientTaskCursorLaunchError } from "@/lib/prototype/taskCursorLaunchRetry";

export type TaskCursorAutoChainDecision =
  | Readonly<{ readonly kind: "start"; readonly taskId: string }>
  | Readonly<{ readonly kind: "continue"; readonly fromTaskId: string; readonly toTaskId: string }>
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
): string | null {
  if (!board) return null;
  if (excludeTaskIds?.length) {
    return pickFirstExecutableDeveloperTaskIdExcluding(board, excludeTaskIds);
  }
  return pickFirstExecutableDeveloperTaskIdExcluding(board);
}

export function resolveTaskCursorAutoChainDecision(input: {
  readonly board: ImplementationExecutionBoardV1 | null | undefined;
  readonly taskCursorExecution?: TaskCursorExecutionV1 | null;
  readonly autoGate?: ImplementationAutoQualityGateV1 | null;
  readonly autoQualityGateInFlight?: boolean;
}): TaskCursorAutoChainDecision {
  if (input.autoQualityGateInFlight) return { kind: "none" };
  const execution = input.taskCursorExecution ?? null;
  if (execution && isInFlightTaskCursorExecution(execution)) return { kind: "none" };

  const autoGate = input.autoGate ?? null;
  const excludeTaskIds =
    execution && isTaskReadyForAutoChainContinue(execution, autoGate)
      ? [execution.taskId]
      : [];
  const nextTaskId = resolveNextTaskCursorAutoChainTarget(input.board, excludeTaskIds);
  if (!nextTaskId) return { kind: "none" };

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
    if (
      isTaskCursorExecutionFailed(execution) &&
      isTransientTaskCursorLaunchError(execution.errorMessage)
    ) {
      return { kind: "start", taskId: execution.taskId };
    }
    return { kind: "none" };
  }

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
  return `continue:${decision.fromTaskId}->${decision.toTaskId}`;
}

export function formatTaskCursorAutoChainNotice(
  decision: Exclude<TaskCursorAutoChainDecision, Readonly<{ readonly kind: "none" }>>,
  board: ImplementationExecutionBoardV1 | null | undefined,
): string {
  const row = board?.taskRows.find((task) =>
    decision.kind === "start" ? task.taskId === decision.taskId : task.taskId === decision.toTaskId,
  );
  const title = row?.title ? ` · ${row.title}` : "";
  if (decision.kind === "start") {
    return `우선순위 기준 다음 작업 ${decision.taskId}${title}을(를) 자동으로 시작합니다.`;
  }
  return `작업 ${decision.fromTaskId} 통과 — 다음 작업 ${decision.toTaskId}${title}을(를) 자동으로 시작합니다.`;
}
