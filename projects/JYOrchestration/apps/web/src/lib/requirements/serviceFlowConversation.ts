import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";

/** `requirementsConversation.messages`에 저장되는 서비스 흐름 워크숍 대화 구분자 */
export const SERVICE_FLOW_WORKSHOP_INTERNAL_TYPE = "service-flow-workshop" as const;

export function isServiceFlowWorkshopMessage(m: RequirementsMessage): boolean {
  return m.meta?.internalType === SERVICE_FLOW_WORKSHOP_INTERNAL_TYPE;
}

export function filterIdeationConversationMessages(messages: readonly RequirementsMessage[]): RequirementsMessage[] {
  return messages.filter((m) => !isServiceFlowWorkshopMessage(m));
}
