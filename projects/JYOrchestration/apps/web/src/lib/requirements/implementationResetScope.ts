import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export type ImplementationResetScope = "conversation_only" | "codetask_with_conversation";

export type ImplementationResetRequest = Readonly<{
  readonly scope: ImplementationResetScope;
  readonly projectId: string;
  readonly reason?: string;
}>;

export const IMPLEMENTATION_RESET_SCOPE_TRACE_ACTIONS = {
  dialogOpened: "implementation_reset_dialog_opened",
  conversationRequested: "implementation_conversation_reset_requested",
  conversationCompleted: "implementation_conversation_reset_completed",
  codetaskRequested: "implementation_codetask_reset_requested",
  codetaskCompleted: "implementation_codetask_reset_completed",
} as const;

export type ImplementationResetAuditFields = Readonly<{
  readonly projectId: string;
  readonly scope: ImplementationResetScope;
  readonly resetConversation: boolean;
  readonly resetCodeTasks: boolean;
  readonly resetExecutionState: boolean;
  readonly resetPreview: boolean;
  readonly createdAt: string;
}>;

export function implementationResetAuditFieldsForScope(
  scope: ImplementationResetScope,
  projectId: string,
  createdAt: string,
): ImplementationResetAuditFields {
  if (scope === "conversation_only") {
    return {
      projectId,
      scope,
      resetConversation: true,
      resetCodeTasks: false,
      resetExecutionState: false,
      resetPreview: false,
      createdAt,
    };
  }
  return {
    projectId,
    scope,
    resetConversation: true,
    resetCodeTasks: true,
    resetExecutionState: true,
    resetPreview: true,
    createdAt,
  };
}

export function appendImplementationResetScopeTrace(
  timeline: readonly RequirementsPromptTimelineEntry[],
  input: Readonly<{
    readonly action: string;
    readonly audit: ImplementationResetAuditFields;
  }>,
): RequirementsPromptTimelineEntry[] {
  const entry: RequirementsPromptTimelineEntry = {
    stage: "implementation",
    stageGroup: "구현",
    workspaceScreenKey: "prototype_execution",
    action: input.action,
    source: "system",
    orchestrationTraceGroup: "implementation_orchestration",
    responseText: [
      `type=implementation_reset_scope`,
      `scope=${input.audit.scope}`,
      `resetConversation=${input.audit.resetConversation}`,
      `resetCodeTasks=${input.audit.resetCodeTasks}`,
      `resetExecutionState=${input.audit.resetExecutionState}`,
      `resetPreview=${input.audit.resetPreview}`,
      `projectId=${input.audit.projectId}`,
    ].join(" "),
    createdAt: input.audit.createdAt,
  };
  return [...(timeline ?? []), entry];
}

export const IMPLEMENTATION_RESET_CONVERSATION_ONLY_SUCCESS_MESSAGE =
  "구현단계 대화내용만 초기화했습니다.\nCodeTask, 실행상태, GitHub 확인 기록, Preview는 유지했습니다." as const;

export const IMPLEMENTATION_RESET_CODETASK_SUCCESS_MESSAGE =
  "구현단계 CodeTask까지 초기화했습니다.\n대화내용, CodeTask, 실행상태, GitHub 확인 기록, Preview 실행 정보를 초기화하고 기획 산출물 기준으로 CodeTask를 다시 생성했습니다." as const;
