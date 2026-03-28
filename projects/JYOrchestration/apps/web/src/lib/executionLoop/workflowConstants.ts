/** Task.executionWorkflowStatus — 실행 루프 전용 (기존 Task.status 와 별도) */
export const EXECUTION_WORKFLOW = {
  PENDING: "pending",
  READY: "ready",
  RUNNING: "running",
  REVIEWING: "reviewing",
  /** 민감 Task 정책: 사람 승인 후에만 DAG 후속 진행 */
  AWAITING_HUMAN: "awaiting_human",
  DONE: "done",
  FAILED: "failed",
} as const;

export type ExecutionWorkflowStatus = (typeof EXECUTION_WORKFLOW)[keyof typeof EXECUTION_WORKFLOW];

/** OpenAI 평가 결과 */
export type EvalVerdict = "done" | "retry" | "failed";
