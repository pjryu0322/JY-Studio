import type { WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";
import { buildDynamicServicePlanningSlotDefinitions } from "@/lib/requirements/singleChatOrchestrationSlots";
import type { SingleChatOrchestrationSlotDefinition } from "@/lib/requirements/singleChatOrchestrationTypes";
import { allCatalogMemberIds } from "@/lib/workspace-ai/workspaceScreenKeys";

/** AI Agent 탭 카탈로그 멤버 → SingleChat 슬롯 정의의 `ownerAgent` 집합 */
export function catalogIdToSlotOwnerAgents(catalogId: WorkspaceAiMemberId): readonly string[] {
  switch (catalogId) {
    case "ideation":
      return ["planner"];
    case "actor_flow":
      return ["service-designer", "domain-expert"];
    case "feature_planning":
      return ["solution-architect", "task-reviewer"];
    case "prototype_build":
      return ["solution-architect", "task-reviewer", "ui-designer"];
    case "designer":
      return ["ui-designer"];
    case "prototype_review":
      return ["task-reviewer", "ui-designer"];
    case "security_reviewer":
      return ["security-reviewer"];
    case "memo":
      return [];
    default:
      return [];
  }
}

/**
 * 설정 화면용: 프로젝트 문맥 없이 서비스 기획 슬롯 템플릿 전체(디자이너·보안 슬롯 포함)를 만든다.
 */
export function buildWorkspaceAiSlotDefinitionPreview(): readonly SingleChatOrchestrationSlotDefinition[] {
  const keys = allCatalogMemberIds().filter((k) => k !== "memo") as WorkspaceAiMemberId[];
  return buildDynamicServicePlanningSlotDefinitions({
    projectName: "프로젝트",
    projectDescription: "",
    projectType: null,
    servicePlanningAgentCatalogKeys: keys,
  });
}

export type WorkspaceAiSlotPreviewRow = {
  readonly label: string;
  readonly description: string;
};

export function slotPreviewRowsForCatalogMember(
  catalogId: WorkspaceAiMemberId,
  definitions: readonly SingleChatOrchestrationSlotDefinition[]
): readonly WorkspaceAiSlotPreviewRow[] {
  const owners = new Set(catalogIdToSlotOwnerAgents(catalogId));
  return definitions
    .filter((d) => !String(d.slotKey).startsWith("dyn_"))
    .filter((d) => owners.has(d.ownerAgent))
    .map((d) => ({
      label: d.label,
      description: String(d.hints ?? "").trim() || "—",
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "ko"));
}
