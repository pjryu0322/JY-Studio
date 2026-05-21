/**
 * Stage 5-A aggregate closure package (read-only; not Stage 5-B implementation).
 */

export type RoleKnowledgeBindingClosureDecision = "stage5_a_closure_ready" | "defer" | "blocked";

export interface RoleKnowledgeBindingClosureFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface RoleKnowledgeBindingClosureChecklistItem {
  readonly item: string;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface RoleKnowledgeBindingClosureAgentSummary {
  readonly agentType: string;
  readonly decision: "knowledge_binding_ready" | "defer" | "blocked";
  readonly bindingCount: number;
  readonly requiredBindingCount: number;
  readonly satisfiedRequiredBindingCount: number;
  readonly optionalBindingCount: number;
  readonly satisfiedOptionalBindingCount: number;
  readonly missingRequiredBindingIds: readonly string[];
  readonly missingOptionalBindingIds: readonly string[];
  readonly unknownAvailableKnowledgePackIds: readonly string[];
  readonly normalizedAvailableKnowledgePackIdCount: number;
}

export interface RoleKnowledgeBindingClosureReport {
  readonly mode: "read_only_role_knowledge_binding_closure";
  readonly stage: "stage_5_a_closure";
  readonly decision: RoleKnowledgeBindingClosureDecision;

  readonly closureVersion: "stage_5_a_closure_v1";
  readonly closureTitle: string;
  readonly closureSummary: string;
  readonly closureFingerprint: string;

  readonly sourceStage: "stage_5_a";
  readonly sourceEvaluator: "evaluateRoleKnowledgeBindingReadiness";
  readonly sourceDefaultKnowledgePackIds: readonly string[];
  readonly sourceDefaultKnowledgePackIdCount: number;

  readonly agentSummaries: readonly RoleKnowledgeBindingClosureAgentSummary[];
  readonly agentCount: number;
  readonly readyAgentCount: number;
  readonly deferredAgentCount: number;
  readonly blockedAgentCount: number;

  readonly totalBindingCount: number;
  readonly totalRequiredBindingCount: number;
  readonly totalSatisfiedRequiredBindingCount: number;
  readonly totalOptionalBindingCount: number;
  readonly totalSatisfiedOptionalBindingCount: number;

  readonly allRequiredBindingsSatisfied: boolean;
  readonly noUnknownKnowledgePackIds: boolean;
  readonly noBlankKnowledgePackIdsRemoved: boolean;
  readonly noDuplicateKnowledgePackIdsRemoved: boolean;

  readonly closureChecklist: readonly RoleKnowledgeBindingClosureChecklistItem[];
  readonly boundaryChecklist: readonly RoleKnowledgeBindingClosureChecklistItem[];
  readonly findings: readonly RoleKnowledgeBindingClosureFinding[];

  readonly stage5AClosureIsKnowledgePackImplementation: false;
  readonly stage5AClosureUsesRag: false;
  readonly stage5AClosureModifiesPromptInjection: false;
  readonly stage5AClosureModifiesRuntime: false;
  readonly stage5AClosureModifiesDb: false;
  readonly stage5AClosureModifiesUi: false;

  readonly stage5BEntryCandidate: "knowledge_pack_metadata_registry_candidate";
  readonly stage5BEntryIsCandidateOnly: true;
  readonly actualKnowledgePackMetadataRegistryAllowedInThisStep: false;
  readonly actualKnowledgePackCrudAllowedInThisStep: false;
  readonly actualRagIndexingAllowedInThisStep: false;
  readonly actualPromptInjectionAllowedInThisStep: false;
}

export interface RoleKnowledgeBindingClosureInput {
  readonly agentTypes?: readonly string[];
  readonly availableKnowledgePackIds?: readonly string[];
  readonly allowMissingOptionalBindings?: boolean;
  readonly stage5AClosureReviewConfirmed?: boolean;
  readonly stage5ANotKnowledgePackImplementationConfirmed?: boolean;
  readonly stage5ANoRagConfirmed?: boolean;
  readonly stage5ANoPromptInjectionConfirmed?: boolean;
  readonly stage5ANoRuntimeDbUiConfirmed?: boolean;
}
