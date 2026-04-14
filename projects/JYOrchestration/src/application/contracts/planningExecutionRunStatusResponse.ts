/**
 * Planning-originated execution — run-status response contract (UI/route safe).
 *
 * Boundary:
 * - No executionService internals
 * - No handoff / preparation / bridge payloads
 * - Minimal, stable summary suitable for current UX
 */

export type PlanningExecutionRunStatus = Readonly<{
  runId: string;
  runStatus: "RUNNING" | "SUCCESS" | "FAILED";
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  currentTaskId: string | null;
  lastFailureMessage: string | null;
  totalStepCount: number;
}>;

export type PlanningExecutionRunStatusResponse =
  | Readonly<{
      ok: true;
      run: PlanningExecutionRunStatus;
    }>
  | Readonly<{
      ok: false;
      error:
        | "INVALID_RUN_ID"
        | "RUN_NOT_FOUND"
        | "UNEXPECTED_ERROR";
      message: string;
    }>;

