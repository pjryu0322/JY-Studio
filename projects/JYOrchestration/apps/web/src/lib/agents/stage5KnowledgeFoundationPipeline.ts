/**
 * Stage 5-A~5-D read-only evaluation pipeline (shared input, single orchestration point).
 */

import { evaluateKnowledgePackMetadataRegistryCandidate } from "@/lib/agents/evaluateKnowledgePackMetadataRegistryCandidate";
import { evaluatePromptContextInjectionDesignCandidate } from "@/lib/agents/evaluatePromptContextInjectionDesignCandidate";
import { evaluateRoleKnowledgeBindingClosure } from "@/lib/agents/evaluateRoleKnowledgeBindingClosure";
import { evaluateRoleKnowledgePackMappingCandidate } from "@/lib/agents/evaluateRoleKnowledgePackMappingCandidate";
import type { KnowledgePackMetadataRegistryCandidateReport } from "@/lib/agents/knowledgePackMetadataRegistryCandidateTypes";
import type { PromptContextInjectionDesignCandidateReport } from "@/lib/agents/promptContextInjectionDesignCandidateTypes";
import type { RoleKnowledgeBindingClosureReport } from "@/lib/agents/roleKnowledgeBindingClosureTypes";
import type { RoleKnowledgePackMappingCandidateReport } from "@/lib/agents/roleKnowledgePackMappingCandidateTypes";
import {
  extractStage5AClosureInput,
  toMappingEvaluatorInput,
  toMetadataRegistryEvaluatorInput,
  toPromptDesignEvaluatorInput,
} from "@/lib/agents/stage5KnowledgeFoundationInput";
import type { Stage5IntegratedKnowledgeFoundationClosureInput } from "@/lib/agents/stage5IntegratedKnowledgeFoundationClosureTypes";

export type Stage5KnowledgeFoundationPipelineReports = {
  readonly stage5A: RoleKnowledgeBindingClosureReport;
  readonly stage5B: KnowledgePackMetadataRegistryCandidateReport;
  readonly stage5C: RoleKnowledgePackMappingCandidateReport;
  readonly stage5D: PromptContextInjectionDesignCandidateReport;
};

/** Run Stage 5-A through 5-D once with normalized shared input. */
export function evaluateStage5KnowledgeFoundationPipeline(
  input?: Stage5IntegratedKnowledgeFoundationClosureInput,
): Stage5KnowledgeFoundationPipelineReports {
  return {
    stage5A: evaluateRoleKnowledgeBindingClosure(extractStage5AClosureInput(input)),
    stage5B: evaluateKnowledgePackMetadataRegistryCandidate(toMetadataRegistryEvaluatorInput(input)),
    stage5C: evaluateRoleKnowledgePackMappingCandidate(toMappingEvaluatorInput(input)),
    stage5D: evaluatePromptContextInjectionDesignCandidate(toPromptDesignEvaluatorInput(input)),
  };
}
