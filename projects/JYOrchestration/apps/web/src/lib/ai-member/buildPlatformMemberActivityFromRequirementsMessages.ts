import type { WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";

/** 요구사항 워크스페이스 대화 슬라이스에서 참여 AI 패널용 최근 스니펫을 만든다. */
export function buildPlatformMemberActivityFromRequirementsMessages(
  ideationConversationOnly: readonly RequirementsMessage[],
  serviceFlowWorkshopPersisted: readonly RequirementsMessage[]
): Partial<Record<WorkspaceAiMemberId, { readonly recentSnippet?: string }>> {
  const lastIdeationAi = [...ideationConversationOnly].reverse().find((m) => m.role === "ai");
  const ideationSnippet = String(lastIdeationAi?.content ?? "").trim();
  const lastSf = [...serviceFlowWorkshopPersisted].reverse().find((m) => m.role === "ai");
  const sfSnippet = String(lastSf?.content ?? "").trim();
  const out: Partial<Record<WorkspaceAiMemberId, { readonly recentSnippet?: string }>> = {};
  if (ideationSnippet) out.ideation = { recentSnippet: ideationSnippet };
  if (sfSnippet) out.actor_flow = { recentSnippet: sfSnippet };
  return out;
}
