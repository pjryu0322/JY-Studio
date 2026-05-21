/**
 * Stage 5-F integrated knowledge foundation closure (read-only).
 */

import type { KnowledgePackMetadataRegistryCandidateDecision } from "@/lib/agents/knowledgePackMetadataRegistryCandidateTypes";
import type { PromptContextInjectionDesignCandidateDecision } from "@/lib/agents/promptContextInjectionDesignCandidateTypes";
import type { RoleKnowledgeBindingClosureDecision } from "@/lib/agents/roleKnowledgeBindingClosureTypes";
import type { RoleKnowledgePackMappingCandidateDecision } from "@/lib/agents/roleKnowledgePackMappingCandidateTypes";

export type Stage5IntegratedKnowledgeFoundationClosureDecision =
  | "stage5_knowledge_foundation_ready"
  | "defer"
  | "blocked";

export interface Stage5IntegratedKnowledgeFoundationClosureFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface Stage5IntegratedKnowledgeFoundationClosureChecklistItem {
  readonly item: string;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface Stage5IntegratedKnowledgeFoundationClosureReport {
  readonly mode: "read_only_stage5_integrated_knowledge_foundation_closure";
  readonly stage: "stage_5_f_closure";
  readonly decision: Stage5IntegratedKnowledgeFoundationClosureDecision;

  readonly sourceStage5AClosureDecision: RoleKnowledgeBindingClosureDecision;
  readonly sourceStage5BDecision: KnowledgePackMetadataRegistryCandidateDecision;
  readonly sourceStage5CDecision: RoleKnowledgePackMappingCandidateDecision;
  readonly sourceStage5DDecision: PromptContextInjectionDesignCandidateDecision;

  readonly closureVersion: "stage_5_integrated_knowledge_foundation_closure_v1";
  readonly closureTitle: string;
  readonly closureSummary: string;
  readonly closureFingerprint: string;

  readonly knowledgeFoundationOnly: true;
  readonly actualKnowledgePackImplementationAllowedAfterStage5: false;
  readonly actualKnowledgePackCrudAllowedAfterStage5: false;
  readonly actualRagIndexingAllowedAfterStage5: false;
  readonly actualPromptInjectionAllowedAfterStage5: false;
  readonly actualRuntimeExecutionAllowedAfterStage5: false;
  readonly actualDbMigrationAllowedAfterStage5: false;
  readonly actualUiImplementationAllowedAfterStage5: false;

  readonly stage6EntryCandidate: "runtime_execution_model_design";
  readonly stage6EntryIsCandidateOnly: true;

  readonly closureChecklist: readonly Stage5IntegratedKnowledgeFoundationClosureChecklistItem[];
  readonly boundaryChecklist: readonly Stage5IntegratedKnowledgeFoundationClosureChecklistItem[];
  readonly findings: readonly Stage5IntegratedKnowledgeFoundationClosureFinding[];

  readonly recommendedNextPhases: readonly string[];
  readonly separatedWorkItems: readonly string[];
}

export interface Stage5IntegratedKnowledgeFoundationClosureInput {
  readonly stage5AClosure?: import("@/lib/agents/roleKnowledgeBindingClosureTypes").RoleKnowledgeBindingClosureInput;
  readonly metadataRegistry?: import("@/lib/agents/knowledgePackMetadataRegistryCandidateTypes").KnowledgePackMetadataRegistryCandidateInput;
  readonly mapping?: import("@/lib/agents/roleKnowledgePackMappingCandidateTypes").RoleKnowledgePackMappingCandidateInput;
  readonly promptDesign?: import("@/lib/agents/promptContextInjectionDesignCandidateTypes").PromptContextInjectionDesignCandidateInput;
}

export type Stage5IntegratedKnowledgeFoundationClosureDecisionInput = {
  readonly sourceStage5AClosureDecision: RoleKnowledgeBindingClosureDecision;
  readonly sourceStage5BDecision: KnowledgePackMetadataRegistryCandidateDecision;
  readonly sourceStage5CDecision: RoleKnowledgePackMappingCandidateDecision;
  readonly sourceStage5DDecision: PromptContextInjectionDesignCandidateDecision;
};
