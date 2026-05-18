import type { IntegrationCapability } from "@prisma/client";
import type { WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";

/**
 * 카탈로그 AI 멤버가 런타임에 요구하는 capability 집합(정적).
 * DB `ai_member_capabilities` 대신 MVP에서 사용합니다.
 */
export const WORKSPACE_AI_MEMBER_CAPABILITIES: Record<WorkspaceAiMemberId, readonly IntegrationCapability[]> = {
  ideation: ["LLM"],
  actor_flow: ["LLM"],
  feature_planning: ["LLM"],
  prototype_build: ["CODE_AGENT", "SCM"],
  designer: ["LLM"],
  prototype_review: ["LLM"],
  security_reviewer: ["LLM", "SCM"],
  memo: ["LLM"],
};

export function getCapabilitiesForWorkspaceAiMember(id: WorkspaceAiMemberId): readonly IntegrationCapability[] {
  return WORKSPACE_AI_MEMBER_CAPABILITIES[id] ?? ["LLM"];
}
