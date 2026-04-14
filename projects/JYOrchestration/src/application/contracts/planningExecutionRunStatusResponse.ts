/**
 * Planning-originated execution — **UI-friendly** run-status response contract.
 *
 * Boundary:
 * - No raw executionService internals / stores
 * - No handoff / preparation / bridge payloads
 * - Presentation-oriented fields only (progress, last message, user actions)
 */

export type PlanningExecutionRunStatusUi = Readonly<{
  runId: string;
  /** UI-friendly status bucket (separates SUCCESS from “completed”). */
  status: "RUNNING" | "COMPLETED" | "FAILED";
  currentStep: string | null;
  totalSteps: number;
  /** \(0..100\), rounded to an integer. */
  progressPercent: number;
  lastMessage: string | null;
  canRetry: boolean;
  canInspect: boolean;
}>;

export type PlanningExecutionRunStatusResponse =
  | Readonly<{
      ok: true;
      run: PlanningExecutionRunStatusUi;
    }>
  | Readonly<{
      ok: false;
      error: "INVALID_RUN_ID" | "RUN_NOT_FOUND" | "UNEXPECTED_ERROR";
      message: string;
    }>;

