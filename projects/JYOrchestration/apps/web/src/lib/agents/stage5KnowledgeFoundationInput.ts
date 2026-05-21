/**
 * Shared Stage 5-A~5-D evaluator input normalization (read-only chain).
 */

import type { KnowledgePackMetadataRegistryCandidateInput } from "@/lib/agents/knowledgePackMetadataRegistryCandidateTypes";
import type { PromptContextInjectionDesignCandidateInput } from "@/lib/agents/promptContextInjectionDesignCandidateTypes";
import type { RoleKnowledgeBindingClosureInput } from "@/lib/agents/roleKnowledgeBindingClosureTypes";
import type { RoleKnowledgePackMappingCandidateInput } from "@/lib/agents/roleKnowledgePackMappingCandidateTypes";
import type { Stage5IntegratedKnowledgeFoundationClosureInput } from "@/lib/agents/stage5IntegratedKnowledgeFoundationClosureTypes";

/** Common nested input shape for Stage 5 knowledge foundation evaluators. */
export type Stage5KnowledgeFoundationChainInput = Stage5IntegratedKnowledgeFoundationClosureInput;

export function toMetadataRegistryEvaluatorInput(
  input?: Pick<Stage5KnowledgeFoundationChainInput, "stage5AClosure" | "metadataRegistry">,
): KnowledgePackMetadataRegistryCandidateInput {
  return {
    stage5AClosure: input?.stage5AClosure,
    ...input?.metadataRegistry,
  };
}

export function toMappingEvaluatorInput(
  input?: Pick<
    Stage5KnowledgeFoundationChainInput,
    "stage5AClosure" | "metadataRegistry" | "mapping"
  >,
): RoleKnowledgePackMappingCandidateInput {
  return {
    stage5AClosure: input?.stage5AClosure,
    metadataRegistry: input?.metadataRegistry,
    ...input?.mapping,
  };
}

export function toPromptDesignEvaluatorInput(
  input?: Stage5KnowledgeFoundationChainInput,
): PromptContextInjectionDesignCandidateInput {
  return {
    stage5AClosure: input?.stage5AClosure,
    metadataRegistry: input?.metadataRegistry,
    mapping: input?.mapping,
    ...input?.promptDesign,
  };
}

export function extractStage5AClosureInput(
  input?: Stage5KnowledgeFoundationChainInput,
): RoleKnowledgeBindingClosureInput | undefined {
  return input?.stage5AClosure;
}
