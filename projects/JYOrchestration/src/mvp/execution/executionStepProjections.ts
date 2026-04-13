/**
 * MVP — read-model helpers over execution step logs (in-memory only).
 */

import type { MvpExecutionStepRecord } from "./executionStepLog";
import { mvpGetExecutionStepsForRun } from "./executionStepLog";

/** Steps for a single task (excludes run-scoped rows where `taskId` is empty). */
export function mvpGetExecutionStepsForTask(runId: string, taskId: string): readonly MvpExecutionStepRecord[] {
  return mvpGetExecutionStepsForRun(runId).filter((s) => s.taskId === taskId);
}

/** Last step with `status === "FAILURE"` in append order (highest `sequence`). */
export function mvpGetLastFailureStepForRun(runId: string): MvpExecutionStepRecord | undefined {
  const steps = mvpGetExecutionStepsForRun(runId);
  for (let i = steps.length - 1; i >= 0; i -= 1) {
    const s = steps[i]!;
    if (s.status === "FAILURE") {
      return s;
    }
  }
  return undefined;
}

/** Count of automatic retry scheduling events (`TASK_RETRY_SCHEDULED`) in the run. */
export function mvpGetRetryCountFromSteps(runId: string): number {
  return mvpGetExecutionStepsForRun(runId).filter((s) => s.stepType === "TASK_RETRY_SCHEDULED").length;
}

/** Compact flow: `seq:TYPE → seq:TYPE` (stable order by `sequence`). */
export function mvpSummarizeExecutionStepFlow(runId: string): string {
  return mvpGetExecutionStepsForRun(runId)
    .map((s) => `${s.sequence}:${s.stepType}`)
    .join(" → ");
}
