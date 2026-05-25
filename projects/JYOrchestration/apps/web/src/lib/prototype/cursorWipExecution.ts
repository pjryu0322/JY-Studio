/**
 * @deprecated Use `@/lib/prototype/codeAgentWipExecution` — Cursor-specific aliases for legacy imports.
 */
export {
  CODE_AGENT_WIP_EXECUTION_VERSION as CURSOR_WIP_EXECUTION_VERSION,
  CODE_AGENT_WIP_WORK_REQUEST_CHIP as CURSOR_WIP_WORK_REQUEST_CHIP,
  LEGACY_CURSOR_EXECUTION_REQUEST_CHIP,
  LEGACY_CURSOR_WIP_WORK_REQUEST_CHIP,
  CODE_AGENT_WIP_POLICY_SECTION as CURSOR_WIP_POLICY_SECTION,
  CODE_AGENT_WIP_REVIEW_CHIPS as CURSOR_WIP_REVIEW_CHIPS,
  appendWipPolicyToCodeAgentPrompt as appendWipPolicyToCursorPrompt,
  buildInitialCodeAgentWipExecution as buildInitialCursorWipExecution,
  buildStubCodeAgentWipCommit as buildStubCursorWipCommit,
  buildCodeAgentWipRequestedMessage as buildCursorWipRequestedMessage,
  buildCodeAgentWipReviewMessage as buildCursorWipReviewMessage,
  buildCodeAgentWipTimelineEntry as buildCursorWipTimelineEntry,
  codeAgentIsNotSingleChatMember as cursorIsNotSingleChatMember,
  evaluateDeveloperApprovalGate,
  applyStubWipCommitToExecution,
  buildDeveloperApprovedMessage,
  buildScmOfficialCommitPendingMessage,
  type CodeAgentWipExecutionStatus as CursorWipExecutionStatus,
  type CodeAgentWipCommit as CursorWipCommit,
  type CodeAgentDeveloperReview as CursorDeveloperReview,
  type CodeAgentDeveloperReviewStatus as CursorDeveloperReviewStatus,
  type CodeAgentRefactorRequest as CursorRefactorRequest,
  type CodeAgentWipExecutionV1 as CursorWipExecutionV1,
} from "@/lib/prototype/codeAgentWipExecution";

import { buildProviderWipBranchName, buildProviderWipCommitMessage, DEFAULT_CODE_AGENT_PROVIDER } from "@/lib/prototype/codeAgentProvider";

/** @deprecated Use `buildProviderWipBranchName("cursor", ...)` */
export function buildWipBranchName(projectId: string, primaryTaskId: string): string {
  return buildProviderWipBranchName(DEFAULT_CODE_AGENT_PROVIDER, projectId, primaryTaskId);
}

/** @deprecated Use `buildProviderWipCommitMessage("cursor", ...)` */
export function buildWipCommitMessage(taskTitle: string, refactor = false): string {
  return buildProviderWipCommitMessage(DEFAULT_CODE_AGENT_PROVIDER, taskTitle, refactor);
}
