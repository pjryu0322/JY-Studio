/**
 * ENV_TEST(Stage 1·Stage 2 공통) 논리 단계 — DB `executionWorkflowStatus`·Task.status 와 병행하는 표현 계층.
 * Stage 2는 PR_OPENED 이후에만 Reviewer/Security/SCM 게이트를 추가한다.
 *
 * 매핑 요약:
 * - REQUESTED → Task 준비·루프 진입 전
 * - EXECUTOR_RUNNING → Stage 2 전용 Executor(OpenAI) ACK 구간 (Stage 1은 생략)
 * - CURSOR_RUNNING → Cursor Cloud Agent 폴링(종료를 기다리지 않음; Git이 진행 기준)
 * - GIT_BRANCH_REFLECTED → 원격 브랜치·compare·HEAD 확인 (`runEnvTestReflectionConfirmedPipeline` / `runEnvTestAfterGithubPushConfirmed`)
 * - PR_OPENED → EXECUTION_WORKFLOW.PR_OPENED (`finalizeEnvTestPrOpenedFromGithubOnly` 단일 경로)
 * - Stage 1 종료: MERGED / MERGE_VERIFIED / COMPLETED (기존 워크플로)
 * - Stage 2 추가: REVIEW_* / SECURITY_* / SCM_* / MERGE_BLOCKED / MERGE_VERIFIED 등
 */

export const ENV_TEST_RUN_PHASE = {
  REQUESTED: "REQUESTED",
  EXECUTOR_RUNNING: "EXECUTOR_RUNNING",
  CURSOR_RUNNING: "CURSOR_RUNNING",
  GIT_BRANCH_REFLECTED: "GIT_BRANCH_REFLECTED",
  PR_OPENED: "PR_OPENED",
  /** Stage 1 (기존 성공 경로) */
  STAGE1_MERGED: "MERGED",
  STAGE1_MERGE_VERIFIED: "MERGE_VERIFIED",
  STAGE1_COMPLETED: "COMPLETED",
  /** Stage 2 후행 게이트 */
  REVIEW_PENDING: "REVIEW_PENDING",
  REVIEW_PASSED: "REVIEW_PASSED",
  REVIEW_FAILED: "REVIEW_FAILED",
  SECURITY_PENDING: "SECURITY_PENDING",
  SECURITY_PASSED: "SECURITY_PASSED",
  SECURITY_FAILED: "SECURITY_FAILED",
  SCM_PENDING: "SCM_PENDING",
  STAGE2_MERGED: "STAGE2_MERGED",
  MERGE_BLOCKED: "MERGE_BLOCKED",
  MERGE_VERIFIED: "MERGE_VERIFIED",
  STAGE2_COMPLETED: "STAGE2_COMPLETED",
} as const;

export type EnvTestRunPhase = (typeof ENV_TEST_RUN_PHASE)[keyof typeof ENV_TEST_RUN_PHASE];
