/**
 * MVP — in-memory step log for execution observability (isolated; no persistence).
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
  stepType: MvpExecutionStepType;
  status: MvpExecutionStepStatus;
  message: string;
  timestamp: number;
};

const stepsByRun = new Map<string, MvpExecutionStepRecord[]>();

export function mvpAppendExecutionStep(
  record: Omit<MvpExecutionStepRecord, "timestamp"> & { timestamp?: number }
): void {
  const row: MvpExecutionStepRecord = {
    runId: record.runId,
    taskId: record.taskId,
    stepType: record.stepType,
    status: record.status,
    message: record.message,
    timestamp: record.timestamp ?? Date.now(),
  };
  const list = stepsByRun.get(record.runId) ?? [];
  list.push(row);
  stepsByRun.set(record.runId, list);
}

/** Returns a shallow copy of recorded steps for the run (oldest first). */
export function mvpGetExecutionStepsForRun(runId: string): readonly MvpExecutionStepRecord[] {
  return [...(stepsByRun.get(runId) ?? [])];
}

export function mvpClearExecutionStepsForRun(runId: string): void {
  stepsByRun.delete(runId);
}

export function mvpClearAllExecutionSteps(): void {
  stepsByRun.clear();
}
