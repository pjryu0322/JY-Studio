/** Task.executionWorkflowStatus — 실행 루프 전용 (기존 Task.status 와 별도) */
export const EXECUTION_WORKFLOW = {
  PENDING: "pending",
  READY: "ready",
  /** Cursor 호출~에이전트 실행 중 */
  RUNNING: "running",
  /**
   * 에이전트는 종료되었으나 commitHash·변경 파일 등으로 코드 반영이 확인되지 않음.
   * DAG 후속 Task·자동 진행 금지. 단일 Task 재실행으로만 재시도 권장.
   */
  PENDING_APPLY: "pending_apply",
  REVIEWING: "reviewing",
  /** 민감 Task 정책: 사람 승인 후에만 DAG 후속 진행 */
  AWAITING_HUMAN: "awaiting_human",
  DONE: "done",
  FAILED: "failed",
} as const;

export type ExecutionWorkflowStatus = (typeof EXECUTION_WORKFLOW)[keyof typeof EXECUTION_WORKFLOW];

/** OpenAI 평가 결과 */
export type EvalVerdict = "done" | "retry" | "failed";
