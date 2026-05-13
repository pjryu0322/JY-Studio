import type { WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";
import { resolveAiIdentityContract } from "@/lib/overlay/overlayRuntimeResolver";
import type { AiIdentityContract } from "@/lib/overlay/aiIdentityContract";

/**
 * `platformAiMembers` 카탈로그 키를 Overlay 계약 역할로 **힌트 매핑**한다. 구조 변경 없음.
 */
const CATALOG_TO_CONTRACT_ROLE: Partial<Readonly<Record<WorkspaceAiMemberId, string>>> = {
  ideation: "planner",
  actor_flow: "service-designer",
  feature_planning: "service-designer",
  prototype_build: "prototype_build",
  designer: "ui-designer",
  prototype_review: "task-reviewer",
  security_reviewer: "security-reviewer",
  memo: "planner",
};

function isWorkspaceCatalogKey(s: string): s is WorkspaceAiMemberId {
  return s in CATALOG_TO_CONTRACT_ROLE;
}

/**
 * orchestration role → catalog key → 순으로 Overlay identity를 찾는다.
 * `aiMemberId`는 현재 보조 식별자로만 받으며 향후 확장용이다.
 */
export function resolveOverlayIdentityFromAiMember(input: Readonly<{
  catalogKey?: string | null;
  aiOrchestrationRole?: string | null;
  aiMemberId?: string | null;
}>): AiIdentityContract | null {
  void input.aiMemberId;
  const orch = String(input.aiOrchestrationRole ?? "").trim();
  if (orch) {
    const byOrch = resolveAiIdentityContract(orch);
    if (byOrch) return byOrch;
  }
  const ck = String(input.catalogKey ?? "").trim();
  if (ck && isWorkspaceCatalogKey(ck)) {
    const mapped = CATALOG_TO_CONTRACT_ROLE[ck];
    if (mapped) return resolveAiIdentityContract(mapped);
  }
  if (ck) return resolveAiIdentityContract(ck);
  return null;
}
