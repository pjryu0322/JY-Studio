/**
 * Stage 5-B knowledge pack metadata registry candidate (read-only; no CRUD/DB/UI).
 */

import type { RoleKnowledgeBindingClosureDecision } from "@/lib/agents/roleKnowledgeBindingClosureTypes";

export type KnowledgePackMetadataRegistryCandidateDecision =
  | "ready_for_metadata_registry_design"
  | "defer"
  | "blocked";

export type KnowledgePackMetadataCategory =
  | "platform"
  | "development"
  | "security"
  | "review"
  | "domain"
  | "project"
  | "external_product";

export type KnowledgePackMetadataSourceType =
  | "manual"
  | "document"
  | "policy"
  | "standard"
  | "guide"
  | "external_reference"
  | "unknown";

export type KnowledgePackMetadataStatus = "candidate" | "needs_review" | "blocked";

export interface KnowledgePackMetadataCandidate {
  readonly knowledgePackId: string;
  readonly title: string;
  readonly version: string;
  readonly category: KnowledgePackMetadataCategory;
  readonly intendedAgentTypes: readonly string[];
  readonly sourceType: KnowledgePackMetadataSourceType;
  readonly status: KnowledgePackMetadataStatus;
  readonly summary: string;
  readonly requiredForRoles: readonly string[];
  readonly optionalForRoles: readonly string[];
}

export interface KnowledgePackMetadataRegistryCandidateFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface KnowledgePackMetadataRegistryCandidateChecklistItem {
  readonly item: string;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface KnowledgePackMetadataRegistryCandidateReport {
  readonly mode: "read_only_knowledge_pack_metadata_registry_candidate";
  readonly stage: "stage_5_b_candidate";
  readonly decision: KnowledgePackMetadataRegistryCandidateDecision;

  readonly sourceStage5AClosureDecision: RoleKnowledgeBindingClosureDecision;
  readonly metadataCandidates: readonly KnowledgePackMetadataCandidate[];
  readonly candidateCount: number;

  readonly requiredMetadataFields: readonly string[];
  readonly missingMetadataFieldFindings: readonly KnowledgePackMetadataRegistryCandidateFinding[];

  readonly registryCandidateOnly: true;
  readonly actualRegistryImplementationAllowedInThisStep: false;
  readonly actualKnowledgePackCrudAllowedInThisStep: false;
  readonly actualDbWriteAllowedInThisStep: false;
  readonly actualRagIndexingAllowedInThisStep: false;
  readonly actualUiAllowedInThisStep: false;

  readonly checklist: readonly KnowledgePackMetadataRegistryCandidateChecklistItem[];
  readonly findings: readonly KnowledgePackMetadataRegistryCandidateFinding[];
}

export interface KnowledgePackMetadataRegistryCandidateInput {
  readonly stage5AClosure?: import("@/lib/agents/roleKnowledgeBindingClosureTypes").RoleKnowledgeBindingClosureInput;
  readonly metadataCandidates?: readonly KnowledgePackMetadataCandidate[];
}

export type KnowledgePackMetadataRegistryCandidateDecisionInput = {
  readonly sourceStage5AClosureDecision: RoleKnowledgeBindingClosureDecision;
  readonly hasBlockedCandidate: boolean;
  readonly hasMissingRequiredFields: boolean;
};
