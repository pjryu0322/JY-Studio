/**
 * @deprecated Use `@/lib/prototype/prototypeExecutionCodeAgentWipActions`.
 */
import type { CodeAgentWipExecutionV1 } from "@/lib/prototype/codeAgentWipExecution";
import {
  buildDeveloperApproveWipResult as buildDeveloperApproveWipResultBase,
  buildRefactorRequestWipState as buildRefactorRequestWipStateBase,
  buildRequestCodeAgentWipWorkResult as buildRequestCodeAgentWipWorkResultBase,
  buildScmOfficialCommitRequestResult as buildScmOfficialCommitRequestResultBase,
  type CodeAgentWipChatPatch,
  type CodeAgentWipOrchestrationPatch,
  formatWipChangesView,
  REFACTOR_REQUEST_PROMPT,
  buildWipCommitMessage,
} from "@/lib/prototype/prototypeExecutionCodeAgentWipActions";

export type CursorWipOrchestrationPatch = Readonly<{
  readonly cursorWipExecutionV1: CodeAgentWipExecutionV1;
  readonly promptTimeline: CodeAgentWipOrchestrationPatch["promptTimeline"];
}>;

export type CursorWipChatPatch = CodeAgentWipChatPatch;

function toLegacyOrchestrationPatch(patch: CodeAgentWipOrchestrationPatch): CursorWipOrchestrationPatch {
  return {
    cursorWipExecutionV1: patch.codeAgentWipExecutionV1,
    promptTimeline: patch.promptTimeline,
  };
}

export function buildRequestCursorWipWorkResult(
  input: Parameters<typeof buildRequestCodeAgentWipWorkResultBase>[0],
) {
  const result = buildRequestCodeAgentWipWorkResultBase(input);
  if (result.kind === "already_active") return result;
  return {
    kind: "created" as const,
    chatPatch: result.chatPatch,
    orchestrationPatch: toLegacyOrchestrationPatch(result.orchestrationPatch),
  };
}

export function buildDeveloperApproveWipResult(
  input: Parameters<typeof buildDeveloperApproveWipResultBase>[0],
) {
  const result = buildDeveloperApproveWipResultBase(input);
  if (result.kind === "blocked") return result;
  return {
    kind: "approved" as const,
    chatPatch: result.chatPatch,
    orchestrationPatch: toLegacyOrchestrationPatch(result.orchestrationPatch),
  };
}

export function buildScmOfficialCommitRequestResult(
  input: Parameters<typeof buildScmOfficialCommitRequestResultBase>[0],
) {
  const result = buildScmOfficialCommitRequestResultBase(input);
  if (result.kind === "blocked") return result;
  return {
    kind: "pending" as const,
    chatPatch: result.chatPatch,
    orchestrationPatch: toLegacyOrchestrationPatch(result.orchestrationPatch),
  };
}

export function buildRefactorRequestWipState(
  input: Parameters<typeof buildRefactorRequestWipStateBase>[0],
): CodeAgentWipExecutionV1 {
  return buildRefactorRequestWipStateBase(input);
}

export { formatWipChangesView, REFACTOR_REQUEST_PROMPT, buildWipCommitMessage };
