import type { ActiveKnowledgePackRef } from "@/lib/overlay/activeKnowledgePackRef";
import { resolveAiIdentityContract } from "@/lib/overlay/overlayRuntimeResolver";

/** 진단용: 계약 roleKey → synthetic 힌트 scope 라벨 */
export const OVERLAY_KNOWLEDGE_HINT_SCOPE_BY_ROLE: Readonly<Record<string, string>> = {
  "ui-designer": "uiux",
  "security-reviewer": "security",
  "solution-architect": "architecture",
  prototype_build: "development",
  planner: "planning",
  "service-designer": "planning",
  "domain-expert": "analysis",
  "task-reviewer": "review",
  "quality-reviewer": "review",
  "spec-reviewer": "planning",
  "scm-manager": "governance",
  reviewer: "review",
};

function hintScopeForContractRole(roleKey: string): string {
  return OVERLAY_KNOWLEDGE_HINT_SCOPE_BY_ROLE[roleKey] ?? "general";
}

/**
 * DB 조회·retrieval 변경 없이 synthetic id 기반 힌트만 생성한다.
 */
export function resolveKnowledgeActivationHintsForRole(input: {
  roleKey: string | null | undefined;
  projectId?: string | null;
}): readonly ActiveKnowledgePackRef[] {
  const id = resolveAiIdentityContract(input.roleKey);
  const key = (id?.roleKey ?? String(input.roleKey ?? "").trim().toLowerCase().replace(/-/g, "_")) || "";
  if (!key) return [];
  const scope = hintScopeForContractRole(key);
  const suffix = input.projectId?.trim() ? `:pid=${input.projectId.trim().slice(0, 36)}` : "";
  return [
    {
      knowledgePackId: `role-default:${key}:${scope}${suffix}`,
      targetRoles: [id?.roleKey ?? key],
      activationReason: "overlay_runtime_hint",
      priority: 0,
      status: "proposed",
    },
  ];
}
