/**
 * MVP — shared execution state shapes (internal contracts; no I/O).
 */

export type MvpFailureCode =
  | "CURSOR_FAILED"
  | "GIT_BRANCH_MISSING"
  | "REVIEW_FAILED"
  | "TASK_NOT_FOUND"
  | "UNHANDLED";

export type ExecutionTaskState = {
  taskId: string;
  status: "PENDING" | "RUNNING" | "SUCCESS" | "FAILED";
  retryCount: number;
  lastFailureWasNonRetryable?: boolean;
  lastFailureCode?: MvpFailureCode;
  lastFailureMessage?: string;
  lastFailureRetryable?: boolean;
  totalExecuteAttempts?: number;
};

export type ExecutionRun = {
  id: string;
  projectId: string;
  status: "RUNNING" | "SUCCESS" | "FAILED";
  currentTaskIndex: number;
  tasks: ExecutionTaskState[];
};
