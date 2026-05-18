/** Task.executionWorkflowStatus — 실행 루프 전용 (기존 Task.status 와 별도) */
export const EXECUTION_WORKFLOW = {
  PENDING: "pending",
  READY: "ready",
  /** Cursor 호출~에이전트 실행 중 */
  RUNNING: "running",
  /** Cursor가 commit/push까지 완료했으며 Git 반영(원격) 증거를 수집한 상태 */
  COMMITTED: "committed",
  /** PR이 생성/업데이트되어 열린 상태 (merge 대기 아님) */
  PR_OPENED: "pr_opened",
  /** AI Reviewer 승인 대기(merge 전 자동 진행 금지) */
  REVIEW_PENDING: "review_pending",
  REVIEW_REJECTED: "review_rejected",
  REVIEW_APPROVED: "review_approved",
  /** ENV_TEST Stage 2: Security 검증 대기 */
  SECURITY_PENDING: "security_pending",
  /** ENV_TEST Stage 2: Security 통과 */
  SECURITY_PASSED: "security_passed",
  /** ENV_TEST Stage 2: Security 실패 */
  SECURITY_FAILED: "security_failed",
  /** ENV_TEST Stage 2: SCM(형상관리) merge 게이트 대기 */
  SCM_PENDING: "scm_pending",
  /** PR 생성/merge 대기(merge 전 자동 진행 금지) */
  MERGE_PENDING: "merge_pending",
  /** ENV_TEST Stage 2: merge 차단 */
  MERGE_BLOCKED: "merge_blocked",
  /** ENV_TEST Stage 2: merge verify 실패 */
  VERIFY_FAILED: "verify_failed",
  MERGED: "merged",
  /**
   * 에이전트는 종료되었으나 commitHash·변경 파일 등으로 코드 반영이 확인되지 않음.
   * DAG 후속 Task·자동 진행 금지. 단일 Task 재실행으로만 재시도 권장.
   */
  PENDING_APPLY: "pending_apply",
  /** @deprecated (레거시) */
  REVIEWING: "reviewing",
  /** 민감 Task 정책: 사람 승인 후에만 DAG 후속 진행 */
  AWAITING_HUMAN: "awaiting_human",
  /** @deprecated MERGED 사용 권장 */
  DONE: "done",
  FAILED: "failed",
} as const;

export type ExecutionWorkflowStatus = (typeof EXECUTION_WORKFLOW)[keyof typeof EXECUTION_WORKFLOW];

/** OpenAI 평가 결과 */
export type EvalVerdict = "done" | "retry" | "failed";
