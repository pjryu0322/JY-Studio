/**
 * Stage 5-D prompt context injection design candidate (read-only; no prompt wire).
 */

import type {
  RoleKnowledgePackMappingCandidateDecision,
  RoleKnowledgePackMappingCandidateInput,
} from "@/lib/agents/roleKnowledgePackMappingCandidateTypes";

export type PromptContextInjectionDesignCandidateDecision =
  | "ready_for_prompt_context_design"
  | "defer"
  | "blocked";

export type PromptContextInjectionMode = "none" | "summary_only" | "selected_sections" | "retrieval_candidate";

export type PromptContextMaxContextPolicy = "minimal" | "standard" | "expanded";

export type PromptContextInjectionTiming =
  | "planning"
  | "analysis"
  | "design"
  | "implementation_request"
  | "review"
  | "security_review";

export interface PromptContextInjectionDesignCandidate {
  readonly agentType: string;
  readonly injectionMode: PromptContextInjectionMode;
  readonly maxContextPolicy: PromptContextMaxContextPolicy;
  readonly requiredKnowledgePackIds: readonly string[];
  readonly optionalKnowledgePackIds: readonly string[];
  readonly injectionTiming: PromptContextInjectionTiming;
  readonly designReason: string;
}

export interface PromptContextInjectionDesignCandidateFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface PromptContextInjectionDesignCandidateChecklistItem {
  readonly item: string;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface PromptContextInjectionDesignCandidateReport {
  readonly mode: "read_only_prompt_context_injection_design_candidate";
  readonly stage: "stage_5_d_candidate";
  readonly decision: PromptContextInjectionDesignCandidateDecision;

  readonly sourceStage5CDecision: RoleKnowledgePackMappingCandidateDecision;
  readonly designCandidates: readonly PromptContextInjectionDesignCandidate[];
  readonly designCandidateCount: number;

  readonly unsupportedInjectionModes: readonly string[];
  readonly missingMappingAgentTypes: readonly string[];

  readonly promptInjectionDesignOnly: true;
  readonly actualPromptInjectionWireAllowedInThisStep: false;
  readonly actualRagRetrievalAllowedInThisStep: false;
  readonly actualRuntimePromptBuilderChangeAllowedInThisStep: false;

  readonly checklist: readonly PromptContextInjectionDesignCandidateChecklistItem[];
  readonly findings: readonly PromptContextInjectionDesignCandidateFinding[];
}

export interface PromptContextInjectionDesignCandidateInput {
  readonly stage5AClosure?: import("@/lib/agents/roleKnowledgeBindingClosureTypes").RoleKnowledgeBindingClosureInput;
  readonly metadataRegistry?: import("@/lib/agents/knowledgePackMetadataRegistryCandidateTypes").KnowledgePackMetadataRegistryCandidateInput;
  readonly mapping?: RoleKnowledgePackMappingCandidateInput;
  readonly designCandidates?: readonly PromptContextInjectionDesignCandidate[];
  readonly agentTypes?: readonly string[];
}

export type PromptContextInjectionDesignCandidateDecisionInput = {
  readonly sourceStage5CDecision: RoleKnowledgePackMappingCandidateDecision;
  readonly hasUnsupportedInjectionMode: boolean;
  readonly hasMissingDesignAgent: boolean;
};
