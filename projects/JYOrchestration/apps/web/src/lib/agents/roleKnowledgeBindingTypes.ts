/**
 * Stage 5 entry candidate: role knowledge binding at read-only foundation level only.
 * Not full knowledge-pack implementation. Out of scope: RAG, knowledge-pack UI, prompt injection,
 * runtime wire, DB/schema/migration.
 */

export type RoleKnowledgeBindingStage = "stage_5_a";

export type RoleKnowledgeBindingDecision = "knowledge_binding_ready" | "defer" | "blocked";

export type RoleKnowledgeBindingScope = "platform_default" | "project" | "role" | "task";

export type RoleKnowledgePackKind =
  | "development_standard"
  | "security_standard"
  | "review_standard"
  | "architecture_standard"
  | "planning_standard"
  | "project_context"
  | "connector_policy"
  | "cursor_execution_policy"
  | "governance_policy";

export type RoleKnowledgeInjectionMode =
  | "summary_only"
  | "retrieval_required"
  | "checklist_only"
  | "disabled";

export interface RoleKnowledgePackBinding {
  readonly bindingId: string;
  readonly agentType: string;
  readonly required: boolean;
  readonly scope: RoleKnowledgeBindingScope;
  readonly knowledgePackKind: RoleKnowledgePackKind;
  readonly knowledgePackId: string;
  readonly knowledgePackVersion: string;
  readonly injectionMode: RoleKnowledgeInjectionMode;
  readonly purpose: string;
}

export interface RoleKnowledgeBindingReadinessInput {
  readonly agentType?: string;
  readonly taskType?: string;
  readonly projectId?: string;
  readonly availableKnowledgePackIds?: readonly string[];
  readonly allowMissingOptionalBindings?: boolean;
}

export interface RoleKnowledgeBindingChecklistItem {
  readonly item: string;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface RoleKnowledgeBindingFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface RoleKnowledgeBindingReadinessReport {
  readonly mode: "read_only_role_knowledge_binding_readiness";
  readonly stage: RoleKnowledgeBindingStage;
  readonly decision: RoleKnowledgeBindingDecision;
  readonly agentType: string;
  readonly taskType: string;
  readonly bindingCount: number;
  readonly requiredBindingCount: number;
  readonly satisfiedRequiredBindingCount: number;
  readonly missingRequiredBindingIds: readonly string[];
  readonly missingOptionalBindingIds: readonly string[];
  readonly optionalBindingCount: number;
  readonly satisfiedOptionalBindingCount: number;
  readonly availableKnowledgePackIdsInputCount: number;
  readonly normalizedAvailableKnowledgePackIds: readonly string[];
  readonly normalizedAvailableKnowledgePackIdCount: number;
  readonly duplicateAvailableKnowledgePackIdsRemoved: readonly string[];
  readonly blankAvailableKnowledgePackIdsRemovedCount: number;
  readonly unknownAvailableKnowledgePackIds: readonly string[];
  readonly unknownAvailableKnowledgePackIdCount: number;
  readonly sourceDefaultKnowledgePackIds: readonly string[];
  readonly sourceDefaultKnowledgePackIdCount: number;
  readonly inputHygieneChecklist: readonly RoleKnowledgeBindingChecklistItem[];
  readonly selectedBindings: readonly RoleKnowledgePackBinding[];
  readonly checklist: readonly RoleKnowledgeBindingChecklistItem[];
  readonly findings: readonly RoleKnowledgeBindingFinding[];
  readonly usesRagInThisStep: false;
  readonly writesKnowledgePackInThisStep: false;
  readonly modifiesPromptInjectionInThisStep: false;

  readonly stage5CandidateFoundationOnly: true;
  readonly stage5AIsKnowledgePackImplementation: false;
  readonly readsRoleKnowledgeBindingRegistryInThisStep: true;
  readonly writesRoleKnowledgeBindingRegistryInThisStep: false;
  readonly modifiesKnowledgePackRegistryInThisStep: false;
  readonly createsKnowledgePackInThisStep: false;
  readonly updatesKnowledgePackInThisStep: false;
  readonly versionsKnowledgePackInThisStep: false;
  readonly uploadsSourceDocumentInThisStep: false;
  readonly indexesKnowledgePackInThisStep: false;
  readonly embedsKnowledgePackInThisStep: false;
  readonly retrievesKnowledgeWithRagInThisStep: false;
  readonly injectsKnowledgeIntoPromptInThisStep: false;
  readonly modifiesRuntimeExecutionInThisStep: false;
  readonly modifiesDbInThisStep: false;
  readonly modifiesUiInThisStep: false;
  readonly mvpBaselineBindingRole: "role_to_knowledge_pack_id_readiness_only";
}
