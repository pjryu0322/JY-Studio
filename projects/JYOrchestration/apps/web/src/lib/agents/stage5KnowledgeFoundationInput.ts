/**
 * Shared Stage 5-A~5-D evaluator input normalization (read-only chain).
 */

import { buildStage5AClosureConfirmedInput } from "@/lib/agents/roleKnowledgeBindingClosureSupport";
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

/** Ready-path input for Stage 5-B~5-F evaluators (all required 5-A confirmations set). */
export function buildStage5ReadyChainInput(): Stage5KnowledgeFoundationChainInput {
  return {
    stage5AClosure: buildStage5AClosureConfirmedInput(),
  };
}

export { buildStage5AClosureConfirmedInput } from "@/lib/agents/roleKnowledgeBindingClosureSupport";
