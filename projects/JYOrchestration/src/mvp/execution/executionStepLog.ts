/**
 * MVP — in-memory step log for execution observability (isolated; no persistence).
 *
 * Steps are ordered by stable per-run `sequence` (1-based, monotonic with append order).
 * `timestamp` is diagnostic only; callers should prefer `sequence` for ordering.
 */

export type MvpExecutionStepType =
  | "PROMPT_GENERATED"
  | "CURSOR_SUBMITTED"
  | "CURSOR_FAILED"
  | "CURSOR_COMPLETED"
  | "GIT_VERIFIED"
  | "GIT_FAILED"
  | "REVIEW_PASSED"
  | "REVIEW_FAILED"
  | "TASK_RETRY_SCHEDULED"
  | "TASK_COMPLETED"
  | "RUN_FAILED"
  | "RUN_SUCCESS";

export type MvpExecutionStepStatus = "SUCCESS" | "FAILURE" | "INFO";

export type MvpExecutionStepRecord = {
  runId: string;
  /** Empty string when the step is run-scoped only. */
  taskId: string;
  /** Stable insertion order within the run (1, 2, 3, …). */
  sequence: number;
  stepType: MvpExecutionStepType;
  status: MvpExecutionStepStatus;
  message: string;
  timestamp: number;
};

const stepsByRun = new Map<string, MvpExecutionStepRecord[]>();

export function mvpAppendExecutionStep(
  record: Omit<MvpExecutionStepRecord, "timestamp" | "sequence"> & { timestamp?: number }
): void {
  const list = stepsByRun.get(record.runId) ?? [];
  const sequence = list.length + 1;
  const row: MvpExecutionStepRecord = {
    runId: record.runId,
    taskId: record.taskId,
    sequence,
    stepType: record.stepType,
    status: record.status,
    message: record.message,
    timestamp: record.timestamp ?? Date.now(),
  };
  list.push(row);
  stepsByRun.set(record.runId, list);
}

/** Returns a shallow copy of recorded steps for the run (append order = ascending `sequence`). */
export function mvpGetExecutionStepsForRun(runId: string): readonly MvpExecutionStepRecord[] {
  return [...(stepsByRun.get(runId) ?? [])];
}

export function mvpClearExecutionStepsForRun(runId: string): void {
  stepsByRun.delete(runId);
}

export function mvpClearAllExecutionSteps(): void {
  stepsByRun.clear();
}
