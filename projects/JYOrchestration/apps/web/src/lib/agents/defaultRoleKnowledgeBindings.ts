/**
 * Stage 5 entry candidate registry: default role → knowledge pack binding IDs only.
 * Read-only foundation for Stage 5 planning — not RAG, UI, prompt injection, runtime wire, or DB.
 */

import type { RoleKnowledgePackBinding, RoleKnowledgePackKind } from "@/lib/agents/roleKnowledgeBindingTypes";

const KNOWLEDGE_PACK_VERSION = "v0.1.0";

const PACK_IDS: Record<RoleKnowledgePackKind, string> = {
  development_standard: "kp.platform.development-standard.default",
  security_standard: "kp.platform.security-standard.default",
  review_standard: "kp.platform.review-standard.default",
  architecture_standard: "kp.platform.architecture-standard.default",
  planning_standard: "kp.platform.planning-standard.default",
  project_context: "kp.platform.project-context.default",
  connector_policy: "kp.platform.connector-policy.default",
  cursor_execution_policy: "kp.platform.cursor-execution-policy.default",
  governance_policy: "kp.platform.governance-policy.default",
};

function binding(
  agentType: string,
  knowledgePackKind: RoleKnowledgePackKind,
  options: {
    readonly required?: boolean;
    readonly injectionMode?: RoleKnowledgePackBinding["injectionMode"];
    readonly purpose?: string;
  } = {},
): RoleKnowledgePackBinding {
  return {
    bindingId: `binding.${agentType}.${knowledgePackKind}`,
    agentType,
    required: options.required ?? true,
    scope: "role",
    knowledgePackKind,
    knowledgePackId: PACK_IDS[knowledgePackKind],
    knowledgePackVersion: KNOWLEDGE_PACK_VERSION,
    injectionMode: options.injectionMode ?? "summary_only",
    purpose: options.purpose ?? `${knowledgePackKind} for ${agentType}`,
  };
}

const PLANNER_BINDINGS: readonly RoleKnowledgePackBinding[] = [
  binding("planner", "planning_standard"),
  binding("planner", "project_context"),
];

const ANALYST_BINDINGS: readonly RoleKnowledgePackBinding[] = [
  binding("analyst", "planning_standard"),
  binding("analyst", "project_context"),
  binding("analyst", "architecture_standard"),
];

const ARCHITECT_BINDINGS: readonly RoleKnowledgePackBinding[] = [
  binding("architect", "architecture_standard"),
  binding("architect", "development_standard"),
  binding("architect", "connector_policy"),
];

const DESIGNER_BINDINGS: readonly RoleKnowledgePackBinding[] = [
  binding("designer", "planning_standard"),
  binding("designer", "project_context"),
];

const DEVELOPER_BINDINGS: readonly RoleKnowledgePackBinding[] = [
  binding("developer", "development_standard"),
  binding("developer", "cursor_execution_policy"),
  binding("developer", "project_context"),
  binding("developer", "connector_policy"),
  binding("developer", "governance_policy", { required: false }),
];

const REVIEWER_BINDINGS: readonly RoleKnowledgePackBinding[] = [
  binding("reviewer", "review_standard"),
  binding("reviewer", "development_standard"),
  binding("reviewer", "project_context"),
];

const SECURITY_BINDINGS: readonly RoleKnowledgePackBinding[] = [
  binding("security", "security_standard"),
  binding("security", "governance_policy"),
  binding("security", "project_context"),
];

const SCM_BINDINGS: readonly RoleKnowledgePackBinding[] = [
  binding("scm", "governance_policy"),
  binding("scm", "connector_policy"),
];

const OPERATOR_BINDINGS: readonly RoleKnowledgePackBinding[] = [
  binding("operator", "governance_policy"),
  binding("operator", "connector_policy"),
];

/** All default role knowledge pack bindings. */
export const DEFAULT_ROLE_KNOWLEDGE_BINDINGS: Readonly<Record<string, readonly RoleKnowledgePackBinding[]>> = {
  planner: PLANNER_BINDINGS,
  analyst: ANALYST_BINDINGS,
  architect: ARCHITECT_BINDINGS,
  designer: DESIGNER_BINDINGS,
  developer: DEVELOPER_BINDINGS,
  reviewer: REVIEWER_BINDINGS,
  security: SECURITY_BINDINGS,
  scm: SCM_BINDINGS,
  operator: OPERATOR_BINDINGS,
};

/** Lists all default bindings across agent types. */
export function listDefaultRoleKnowledgeBindings(): readonly RoleKnowledgePackBinding[] {
  return Object.values(DEFAULT_ROLE_KNOWLEDGE_BINDINGS).flat();
}

/** Returns default bindings for an agent type, or empty if unknown. */
export function getDefaultRoleKnowledgeBindingsForAgent(agentType: string): readonly RoleKnowledgePackBinding[] {
  return DEFAULT_ROLE_KNOWLEDGE_BINDINGS[agentType] ?? [];
}

/** All platform knowledge pack IDs referenced by default bindings. */
export function listDefaultKnowledgePackIds(): readonly string[] {
  return [...new Set(listDefaultRoleKnowledgeBindings().map((b) => b.knowledgePackId))];
}
