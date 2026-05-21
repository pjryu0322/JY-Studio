/**
 * Stage 5-C role knowledge pack mapping candidate (read-only; no runtime wire).
 */

import type { KnowledgePackMetadataRegistryCandidateDecision } from "@/lib/agents/knowledgePackMetadataRegistryCandidateTypes";

export type RoleKnowledgePackMappingCandidateDecision = "ready_for_mapping_design" | "defer" | "blocked";

export interface RoleKnowledgePackMappingCandidate {
  readonly agentType: string;
  readonly requiredKnowledgePackIds: readonly string[];
  readonly optionalKnowledgePackIds: readonly string[];
  readonly blockedKnowledgePackIds: readonly string[];
  readonly mappingReason: string;
}

export interface RoleKnowledgePackMappingCandidateFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface RoleKnowledgePackMappingCandidateChecklistItem {
  readonly item: string;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface RoleKnowledgePackMappingCandidateReport {
  readonly mode: "read_only_role_knowledge_pack_mapping_candidate";
  readonly stage: "stage_5_c_candidate";
  readonly decision: RoleKnowledgePackMappingCandidateDecision;

  readonly sourceStage5BDecision: KnowledgePackMetadataRegistryCandidateDecision;
  readonly mappingCandidates: readonly RoleKnowledgePackMappingCandidate[];
  readonly mappingCandidateCount: number;

  readonly mappedAgentCount: number;
  readonly unmappedAgentTypes: readonly string[];
  readonly unknownKnowledgePackIdsInMappings: readonly string[];
  readonly duplicateKnowledgePackIdsInMappings: readonly string[];

  readonly mappingCandidateOnly: true;
  readonly actualRoleKnowledgePackMappingWireAllowedInThisStep: false;
  readonly actualPromptInjectionAllowedInThisStep: false;
  readonly actualRuntimeBindingAllowedInThisStep: false;

  readonly checklist: readonly RoleKnowledgePackMappingCandidateChecklistItem[];
  readonly findings: readonly RoleKnowledgePackMappingCandidateFinding[];
}

export interface RoleKnowledgePackMappingCandidateInput {
  readonly stage5AClosure?: import("@/lib/agents/roleKnowledgeBindingClosureTypes").RoleKnowledgeBindingClosureInput;
  readonly metadataRegistry?: import("@/lib/agents/knowledgePackMetadataRegistryCandidateTypes").KnowledgePackMetadataRegistryCandidateInput;
  readonly mappingCandidates?: readonly RoleKnowledgePackMappingCandidate[];
  readonly agentTypes?: readonly string[];
}

export type RoleKnowledgePackMappingCandidateDecisionInput = {
  readonly sourceStage5BDecision: KnowledgePackMetadataRegistryCandidateDecision;
  readonly hasUnknownAgent: boolean;
  readonly hasUnmappedAgent: boolean;
  readonly hasUnknownPackInMetadata: boolean;
};
