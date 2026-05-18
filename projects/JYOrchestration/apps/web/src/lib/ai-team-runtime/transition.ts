import { AI_TEAM_EXECUTION_STATUS, type AiTeamExecutionStatus } from "./status";

const ALLOWED_TRANSITIONS: Readonly<Record<AiTeamExecutionStatus, readonly AiTeamExecutionStatus[]>> = {
  requested: [AI_TEAM_EXECUTION_STATUS.DEVELOPER_RUNNING, AI_TEAM_EXECUTION_STATUS.CANCELED],
  developer_running: [
    AI_TEAM_EXECUTION_STATUS.REVIEW_RUNNING,
    AI_TEAM_EXECUTION_STATUS.DEVELOPER_FAILED,
    AI_TEAM_EXECUTION_STATUS.REFLECTION_WAITING,
    AI_TEAM_EXECUTION_STATUS.FAILED,
  ],
  developer_failed: [AI_TEAM_EXECUTION_STATUS.FAILED],
  reflection_waiting: [
    AI_TEAM_EXECUTION_STATUS.REVIEW_RUNNING,
    AI_TEAM_EXECUTION_STATUS.DEVELOPER_RUNNING,
    AI_TEAM_EXECUTION_STATUS.FAILED,
    AI_TEAM_EXECUTION_STATUS.CANCELED,
  ],
  review_running: [
    AI_TEAM_EXECUTION_STATUS.SECURITY_RUNNING,
    AI_TEAM_EXECUTION_STATUS.APPROVAL_WAITING,
    AI_TEAM_EXECUTION_STATUS.REVIEW_FAILED,
    AI_TEAM_EXECUTION_STATUS.FAILED,
  ],
  review_failed: [AI_TEAM_EXECUTION_STATUS.FAILED],
  security_running: [
    AI_TEAM_EXECUTION_STATUS.APPROVAL_WAITING,
    AI_TEAM_EXECUTION_STATUS.SECURITY_FAILED,
    AI_TEAM_EXECUTION_STATUS.FAILED,
  ],
  security_failed: [AI_TEAM_EXECUTION_STATUS.FAILED],
  approval_waiting: [
    AI_TEAM_EXECUTION_STATUS.MERGE_RUNNING,
    AI_TEAM_EXECUTION_STATUS.COMPLETED,
    AI_TEAM_EXECUTION_STATUS.CANCELED,
    AI_TEAM_EXECUTION_STATUS.FAILED,
  ],
  merge_running: [AI_TEAM_EXECUTION_STATUS.COMPLETED, AI_TEAM_EXECUTION_STATUS.FAILED, AI_TEAM_EXECUTION_STATUS.DEPLOY_RUNNING],
  deploy_running: [AI_TEAM_EXECUTION_STATUS.COMPLETED, AI_TEAM_EXECUTION_STATUS.FAILED],
  completed: [],
  failed: [],
  canceled: [],
};

export function canTeamExecutionTransition(
  from: AiTeamExecutionStatus | null | undefined,
  to: AiTeamExecutionStatus
): boolean {
  if (!from) {
    return to === AI_TEAM_EXECUTION_STATUS.REQUESTED || to === AI_TEAM_EXECUTION_STATUS.DEVELOPER_RUNNING;
  }
  if (from === to) {
    return true;
  }
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}

export function assertTeamExecutionTransition(
  from: AiTeamExecutionStatus | null | undefined,
  to: AiTeamExecutionStatus
): void {
  if (!canTeamExecutionTransition(from, to)) {
    throw new Error(`ai_team_runtime:invalid_transition:${from ?? "null"}->${to}`);
  }
}
