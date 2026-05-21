/**
 * Stage 6-B runtime execution model candidate (read-only; no schema/API/persistence).
 */

import { evaluateRuntimeExecutionModelBaseline } from "@/lib/agents/evaluateRuntimeExecutionModelBaseline";
import type {
  RuntimeExecutionModelCandidateFinding,
  RuntimeExecutionModelCandidateInput,
  RuntimeExecutionModelCandidateReport,
} from "@/lib/agents/runtimeExecutionModelCandidateTypes";
import {
  appendRuntimeExecutionModelCandidateFindings,
  buildDefaultRuntimeExecutionModelCandidates,
  buildRuntimeExecutionModelCandidateChecklists,
  buildRuntimeExecutionModelCandidateFingerprint,
  buildRuntimeExecutionModelCandidateSummary,
  MODEL_CANDIDATE_TITLE,
  MODEL_CANDIDATE_VERSION,
  parseRuntimeExecutionModelCandidateInput,
  resolveRuntimeExecutionModelCandidateDecision,
  STAGE6_B_RECOMMENDED_NEXT_PHASES,
  STAGE6_B_SEPARATED_WORK_ITEMS,
  validateRuntimeExecutionModelCandidates,
} from "@/lib/agents/runtimeExecutionModelCandidateSupport";

export {
  buildDefaultRuntimeExecutionModelCandidates,
  resolveRuntimeExecutionModelCandidateDecision,
  validateRuntimeExecutionModelCandidates,
} from "@/lib/agents/runtimeExecutionModelCandidateSupport";

export {
  buildStage6BReadyCandidateInput,
  buildStage6BRuntimeExecutionModelCandidateConfirmedInput,
} from "@/lib/agents/stage6RuntimeExecutionModelInput";

export type { RuntimeExecutionModelCandidateDecisionInput } from "@/lib/agents/runtimeExecutionModelCandidateTypes";

/** Read-only Stage 6-B model candidate — does not create schema or execution wire. */
export function evaluateRuntimeExecutionModelCandidate(
  input?: RuntimeExecutionModelCandidateInput,
): RuntimeExecutionModelCandidateReport {
  const baselineReport = evaluateRuntimeExecutionModelBaseline(input?.baseline);
  const parsed = parseRuntimeExecutionModelCandidateInput(input);
  const modelCandidates = buildDefaultRuntimeExecutionModelCandidates();
  const validation = validateRuntimeExecutionModelCandidates(modelCandidates);

  const decision = resolveRuntimeExecutionModelCandidateDecision({
    sourceBaselineDecision: baselineReport.decision,
    confirmationsSatisfied: parsed.confirmationsSatisfied,
    hasRequiredModelKinds: validation.hasRequiredModelKinds,
    candidatePostureValid: validation.candidatePostureValid,
  });

  const modelCandidateFingerprint = buildRuntimeExecutionModelCandidateFingerprint({
    sourceBaselineDecision: baselineReport.decision,
    modelKinds: modelCandidates.map((c) => c.kind),
    confirmationsSatisfied: parsed.confirmationsSatisfied,
  });

  const { modelChecklist, boundaryChecklist } = buildRuntimeExecutionModelCandidateChecklists({
    parsed,
    sourceBaselineDecision: baselineReport.decision,
    validation,
  });

  const findings: RuntimeExecutionModelCandidateFinding[] = [];
  appendRuntimeExecutionModelCandidateFindings({
    findings,
    decision,
    sourceBaselineDecision: baselineReport.decision,
    parsed,
    validation,
  });

  return {
    mode: "read_only_runtime_execution_model_candidate",
    stage: "stage_6_b_runtime_execution_model_candidate",
    decision,
    sourceBaselineDecision: baselineReport.decision,
    modelCandidateVersion: MODEL_CANDIDATE_VERSION,
    modelCandidateTitle: MODEL_CANDIDATE_TITLE,
    modelCandidateSummary: buildRuntimeExecutionModelCandidateSummary(decision),
    modelCandidateFingerprint,
    candidateOnly: true,
    actualExecutionWireAllowedInThisStep: false,
    actualPersistenceAllowedInThisStep: false,
    actualExternalSideEffectAllowedInThisStep: false,
    modelCandidates,
    modelChecklist,
    boundaryChecklist,
    findings,
    recommendedNextPhases: [...STAGE6_B_RECOMMENDED_NEXT_PHASES],
    separatedWorkItems: [...STAGE6_B_SEPARATED_WORK_ITEMS],
  };
}
