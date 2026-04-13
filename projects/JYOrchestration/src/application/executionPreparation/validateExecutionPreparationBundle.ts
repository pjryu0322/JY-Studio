/**
 * Dry-run validation for {@link import("./executionPreparationContracts").ExecutionPreparationBundle}.
 * Internal-only; no execution engine calls.
 */

import type { ExecutionPreparationBundle, ExecutionPreparationValidationResult } from "./executionPreparationContracts";

function push(reasons: string[], msg: string): void {
  reasons.push(msg);
}

function isNonEmptyTrimmed(s: string): boolean {
  return String(s).trim().length > 0;
}

function isTaskOrderNonDecreasing(
  tasks: readonly { readonly id: string; readonly order: number }[]
): boolean {
  for (let i = 1; i < tasks.length; i += 1) {
    const a = tasks[i - 1]!;
    const b = tasks[i]!;
    if (a.order > b.order) return false;
    if (a.order === b.order && a.id.localeCompare(b.id) > 0) return false;
  }
  return true;
}

export function validateExecutionPreparationBundle(bundle: ExecutionPreparationBundle): ExecutionPreparationValidationResult {
  const reasons: string[] = [];

  if (bundle.source !== "PLANNING_HANDOFF") {
    push(reasons, "EXEC_PREP_INVALID_SOURCE");
  }

  if (!isNonEmptyTrimmed(bundle.projectId)) {
    push(reasons, "EXEC_PREP_MISSING_PROJECT_ID");
  }

  if (bundle.projectId !== bundle.context.projectId) {
    push(reasons, "EXEC_PREP_PROJECT_CONTEXT_MISMATCH");
  }

  if (bundle.context.taskCount !== bundle.tasks.length) {
    push(reasons, "EXEC_PREP_CONTEXT_TASK_COUNT_MISMATCH");
  }
  if (bundle.context.screenCount !== bundle.screens.length) {
    push(reasons, "EXEC_PREP_CONTEXT_SCREEN_COUNT_MISMATCH");
  }

  if (bundle.context.featureCount <= 0) {
    push(reasons, "EXEC_PREP_CONTEXT_FEATURE_COUNT_INVALID");
  }

  if (bundle.tasks.length === 0) {
    push(reasons, "EXEC_PREP_TASKS_EMPTY");
  }
  if (bundle.screens.length === 0) {
    push(reasons, "EXEC_PREP_SCREENS_EMPTY");
  }

  const screenIds = new Set<string>();
  for (const s of bundle.screens) {
    if (screenIds.has(s.id)) {
      push(reasons, `EXEC_PREP_DUPLICATE_SCREEN_ID:${s.id}`);
    }
    screenIds.add(s.id);
    if (!isNonEmptyTrimmed(s.projectId) || s.projectId !== bundle.projectId) {
      push(reasons, `EXEC_PREP_SCREEN_PROJECT_MISMATCH:${s.id}`);
    }
    if (!isNonEmptyTrimmed(s.name)) {
      push(reasons, `EXEC_PREP_SCREEN_EMPTY_NAME:${s.id}`);
    }
    if (!isNonEmptyTrimmed(s.routePath)) {
      push(reasons, `EXEC_PREP_SCREEN_EMPTY_ROUTE:${s.id}`);
    }
    if (!isNonEmptyTrimmed(s.screenRole)) {
      push(reasons, `EXEC_PREP_SCREEN_EMPTY_ROLE:${s.id}`);
    }
  }

  const seenTaskIds = new Set<string>();
  for (const t of bundle.tasks) {
    if (seenTaskIds.has(t.id)) {
      push(reasons, `EXEC_PREP_DUPLICATE_TASK_ID:${t.id}`);
    }
    seenTaskIds.add(t.id);

    if (!isNonEmptyTrimmed(t.projectId) || t.projectId !== bundle.projectId) {
      push(reasons, `EXEC_PREP_TASK_PROJECT_MISMATCH:${t.id}`);
    }
    if (!isNonEmptyTrimmed(t.name)) {
      push(reasons, `EXEC_PREP_TASK_EMPTY_NAME:${t.id}`);
    }
    if (!isNonEmptyTrimmed(t.screenId)) {
      push(reasons, `EXEC_PREP_TASK_EMPTY_SCREEN_ID:${t.id}`);
    } else if (!screenIds.has(t.screenId)) {
      push(reasons, `EXEC_PREP_TASK_UNKNOWN_SCREEN:${t.id}`);
    }
    if (t.taskPurpose !== "MOCKUP") {
      push(reasons, `EXEC_PREP_TASK_PURPOSE_INVALID:${t.id}`);
    }
  }

  if (seenTaskIds.size !== bundle.tasks.length) {
    push(reasons, "EXEC_PREP_DUPLICATE_TASK_IDS_AGGREGATE");
  }

  if (!isTaskOrderNonDecreasing(bundle.tasks)) {
    push(reasons, "EXEC_PREP_TASK_ORDER_NOT_STABLE");
  }

  return reasons.length === 0 ? { ok: true } : { ok: false, reasons };
}
