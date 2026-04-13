/**
 * Dry-run validation for {@link import("./executionBridgeContracts").ExecutionBridgeInput}.
 */

import type { ExecutionBridgeInput, ExecutionBridgeValidationResult } from "./executionBridgeContracts";

function push(reasons: string[], msg: string): void {
  reasons.push(msg);
}

function isNonEmptyTrimmed(s: string): boolean {
  return String(s).trim().length > 0;
}

function isOrderNonDecreasing(tasks: readonly { readonly taskId: string; readonly order: number }[]): boolean {
  for (let i = 1; i < tasks.length; i += 1) {
    const a = tasks[i - 1]!;
    const b = tasks[i]!;
    if (a.order > b.order) return false;
    if (a.order === b.order && a.taskId.localeCompare(b.taskId) > 0) return false;
  }
  return true;
}

export function validateExecutionBridgeInput(input: ExecutionBridgeInput): ExecutionBridgeValidationResult {
  const reasons: string[] = [];

  if (input.source !== "EXECUTION_PREPARATION") {
    push(reasons, "BRIDGE_INVALID_SOURCE");
  }

  if (!isNonEmptyTrimmed(input.projectId)) {
    push(reasons, "BRIDGE_MISSING_PROJECT_ID");
  }

  if (input.tasks.length === 0) {
    push(reasons, "BRIDGE_TASKS_EMPTY");
  }

  const seen = new Set<string>();
  for (const t of input.tasks) {
    if (seen.has(t.taskId)) {
      push(reasons, `BRIDGE_DUPLICATE_TASK_ID:${t.taskId}`);
    }
    seen.add(t.taskId);

    if (!isNonEmptyTrimmed(t.projectId) || t.projectId !== input.projectId) {
      push(reasons, `BRIDGE_TASK_PROJECT_MISMATCH:${t.taskId}`);
    }
    if (!isNonEmptyTrimmed(t.name)) {
      push(reasons, `BRIDGE_TASK_EMPTY_NAME:${t.taskId}`);
    }
    if (!isNonEmptyTrimmed(t.screenId)) {
      push(reasons, `BRIDGE_TASK_EMPTY_SCREEN_ID:${t.taskId}`);
    }
    if (t.taskPurpose !== "MOCKUP") {
      push(reasons, `BRIDGE_TASK_PURPOSE_INVALID:${t.taskId}`);
    }
  }

  if (seen.size !== input.tasks.length) {
    push(reasons, "BRIDGE_DUPLICATE_TASK_IDS_AGGREGATE");
  }

  if (!isOrderNonDecreasing(input.tasks)) {
    push(reasons, "BRIDGE_TASK_ORDER_NOT_STABLE");
  }

  if (input.metadata != null) {
    if (input.metadata.taskCount !== input.tasks.length) {
      push(reasons, "BRIDGE_METADATA_TASK_COUNT_MISMATCH");
    }
    if (input.metadata.screenCount < 1) {
      push(reasons, "BRIDGE_METADATA_SCREEN_COUNT_INVALID");
    }
  }

  return reasons.length === 0 ? { ok: true } : { ok: false, reasons };
}
