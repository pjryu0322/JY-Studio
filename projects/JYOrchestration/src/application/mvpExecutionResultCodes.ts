/**
 * JYOrchestration — stable internal result codes for the MVP execution application layer.
 * Not wired to HTTP; use only inside `src/application` contracts and callers.
 */

export const MVP_EXECUTION_APP_CODE = {
  /** Operation succeeded and payload fields are present. */
  OK: "OK",
  /** `mvpStartRunIfReady` refused to start because readiness failed. */
  NOT_READY: "NOT_READY",
  /** Run id does not resolve to an in-memory run aggregate. */
  RUN_NOT_FOUND: "RUN_NOT_FOUND",
  /** `projectId` was empty or whitespace-only after trim. */
  INVALID_PROJECT_ID: "INVALID_PROJECT_ID",
  /** `runId` was empty or whitespace-only after trim. */
  INVALID_RUN_ID: "INVALID_RUN_ID",
} as const;

export type MvpExecutionAppCode = (typeof MVP_EXECUTION_APP_CODE)[keyof typeof MVP_EXECUTION_APP_CODE];

export type MvpExecutionAppFailureCode = Exclude<MvpExecutionAppCode, typeof MVP_EXECUTION_APP_CODE.OK>;
