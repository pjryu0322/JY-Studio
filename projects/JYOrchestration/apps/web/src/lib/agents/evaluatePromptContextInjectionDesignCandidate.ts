/**
 * Stage 5-D prompt context injection design candidate (read-only; no prompt wire).
 */

import { evaluateRoleKnowledgePackMappingCandidate } from "@/lib/agents/evaluateRoleKnowledgePackMappingCandidate";
import { toMappingEvaluatorInput } from "@/lib/agents/stage5KnowledgeFoundationInput";
import type {
  PromptContextInjectionDesignCandidateFinding,
  PromptContextInjectionDesignCandidateInput,
  PromptContextInjectionDesignCandidateReport,
} from "@/lib/agents/promptContextInjectionDesignCandidateTypes";
import {
  appendPromptContextInjectionDesignCandidateFindings,
  buildDefaultPromptContextInjectionDesignCandidates,
  buildPromptContextInjectionDesignCandidateChecklist,
  parsePromptContextInjectionDesignCandidateInput,
  resolvePromptContextInjectionDesignCandidateDecision,
  validatePromptContextInjectionDesigns,
} from "@/lib/agents/promptContextInjectionDesignCandidateSupport";

export {
  buildDefaultPromptContextInjectionDesignCandidates,
  resolvePromptContextInjectionDesignCandidateDecision,
  SUPPORTED_INJECTION_MODES,
  validatePromptContextInjectionDesigns,
} from "@/lib/agents/promptContextInjectionDesignCandidateSupport";

export type { PromptContextInjectionDesignCandidateDecisionInput } from "@/lib/agents/promptContextInjectionDesignCandidateTypes";

/** Read-only Stage 5-D prompt context design — not runtime prompt builder wire. */
export function evaluatePromptContextInjectionDesignCandidate(
  input?: PromptContextInjectionDesignCandidateInput,
): PromptContextInjectionDesignCandidateReport {
  const stage5CReport = evaluateRoleKnowledgePackMappingCandidate(toMappingEvaluatorInput(input));
  const { agentTypes } = parsePromptContextInjectionDesignCandidateInput(input);
  const designCandidates =
    input?.designCandidates ?? buildDefaultPromptContextInjectionDesignCandidates(stage5CReport.mappingCandidates);

  const validation = validatePromptContextInjectionDesigns({ agentTypes, designCandidates });

  const decision = resolvePromptContextInjectionDesignCandidateDecision({
    sourceStage5CDecision: stage5CReport.decision,
    hasUnsupportedInjectionMode: validation.hasUnsupportedInjectionMode,
    hasMissingDesignAgent: validation.hasMissingDesignAgent,
  });

  const findings: PromptContextInjectionDesignCandidateFinding[] = [];
  appendPromptContextInjectionDesignCandidateFindings({
    findings,
    decision,
    sourceStage5CDecision: stage5CReport.decision,
    validation,
  });

  return {
    mode: "read_only_prompt_context_injection_design_candidate",
    stage: "stage_5_d_candidate",
    decision,
    sourceStage5CDecision: stage5CReport.decision,
    designCandidates: [...designCandidates].sort((a, b) => a.agentType.localeCompare(b.agentType)),
    designCandidateCount: designCandidates.length,
    unsupportedInjectionModes: validation.unsupportedInjectionModes,
    missingMappingAgentTypes: validation.missingMappingAgentTypes,
    promptInjectionDesignOnly: true,
    actualPromptInjectionWireAllowedInThisStep: false,
    actualRagRetrievalAllowedInThisStep: false,
    actualRuntimePromptBuilderChangeAllowedInThisStep: false,
    checklist: buildPromptContextInjectionDesignCandidateChecklist({
      sourceStage5CDecision: stage5CReport.decision,
      validation,
      designCandidateCount: designCandidates.length,
    }),
    findings,
  };
}
