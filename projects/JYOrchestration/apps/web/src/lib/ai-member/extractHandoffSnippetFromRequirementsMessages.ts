import { filterIdeationConversationMessages, isServiceFlowWorkshopMessage } from "@/lib/requirements/serviceFlowConversation";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsWorkspaceStage } from "@/lib/requirements/requirementsWorkspaceHelpers";

/** 화면 전환 handoff용 — 직전 단계의 마지막 AI 발화 일부 */
export function extractHandoffSnippetFromRequirementsMessages(
  prevStage: RequirementsWorkspaceStage,
  messages: readonly RequirementsMessage[]
): string {
  if (prevStage === "ideation") {
    const filtered = filterIdeationConversationMessages(messages);
    const last = [...filtered].reverse().find((m) => m.role === "ai");
    const t = String(last?.content ?? "").replace(/\s+/g, " ").trim();
    return t.slice(0, 600);
  }
  const sf = messages.filter(isServiceFlowWorkshopMessage);
  const last = [...sf].reverse().find((m) => m.role === "ai");
  const t = String(last?.content ?? "").replace(/\s+/g, " ").trim();
  return t.slice(0, 600);
}
