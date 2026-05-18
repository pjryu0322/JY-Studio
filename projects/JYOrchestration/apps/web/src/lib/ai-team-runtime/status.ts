/**
 * AI Team Execution Runtime status (distinct from Task DAG `EXECUTION_WORKFLOW`).
 *
 * Stored on `TaskExecutionRun.teamExecutionStatus` (Option B — legacy `status` unchanged).
 */

export const AI_TEAM_EXECUTION_STATUS = {
  REQUESTED: "requested",
  DEVELOPER_RUNNING: "developer_running",
  DEVELOPER_FAILED: "developer_failed",
  REVIEW_RUNNING: "review_running",
  REVIEW_FAILED: "review_failed",
  SECURITY_RUNNING: "security_running",
  SECURITY_FAILED: "security_failed",
  APPROVAL_WAITING: "approval_waiting",
  MERGE_RUNNING: "merge_running",
  DEPLOY_RUNNING: "deploy_running",
  REFLECTION_WAITING: "reflection_waiting",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELED: "canceled",
} as const;

export type AiTeamExecutionStatus = (typeof AI_TEAM_EXECUTION_STATUS)[keyof typeof AI_TEAM_EXECUTION_STATUS];

export const AI_TEAM_EXECUTION_STATUS_LABEL_KO: Readonly<Record<AiTeamExecutionStatus, string>> = {
  requested: "실행 요청됨",
  developer_running: "AI개발자 실행",
  developer_failed: "AI개발자 실행 실패",
  review_running: "AI검수자 검토",
  review_failed: "AI검수자 검토 실패",
  security_running: "AI보안관 점검",
  security_failed: "AI보안관 점검 실패",
  approval_waiting: "사용자 승인 대기",
  merge_running: "PR/Merge 진행",
  deploy_running: "배포 진행",
  reflection_waiting: "Git 반영 확인 대기",
  completed: "완료",
  failed: "실패",
  canceled: "취소됨",
};

export function isAiTeamExecutionStatus(value: string): value is AiTeamExecutionStatus {
  return Object.values(AI_TEAM_EXECUTION_STATUS).includes(value as AiTeamExecutionStatus);
}
