/**
 * Stage 6-C runtime execution model review gate (read-only; no execution permission).
 */

import type {
  RuntimeExecutionModelReviewGateFinding,
  RuntimeExecutionModelReviewGateInput,
  RuntimeExecutionModelReviewGateReport,
} from "@/lib/agents/runtimeExecutionModelReviewGateTypes";
import {
  appendRuntimeExecutionModelReviewGateFindings,
  buildRuntimeExecutionModelReviewGateChecklists,
  buildRuntimeExecutionModelReviewGateFingerprint,
  buildRuntimeExecutionModelReviewGateSummary,
  computeNoRunBoundarySatisfied,
  computePersistenceBoundarySatisfied,
  computeReviewedModelTrace,
  detectForbiddenFieldsInModelCandidates,
  evaluateRuntimeExecutionModelReviewGateSource,
  parseRuntimeExecutionModelReviewGateInput,
  REQUIRED_STAGE6_C_MODEL_REVIEW_GATE_CONFIRMATIONS,
  resolveRuntimeExecutionModelReviewGateDecision,
  RUNTIME_EXECUTION_MODEL_REVIEW_GATE_TITLE,
  RUNTIME_EXECUTION_MODEL_REVIEW_GATE_VERSION,
  STAGE6_C_RECOMMENDED_NEXT_PHASES,
  STAGE6_C_SEPARATED_WORK_ITEMS,
} from "@/lib/agents/runtimeExecutionModelReviewGateSupport";

export { resolveRuntimeExecutionModelReviewGateDecision } from "@/lib/agents/runtimeExecutionModelReviewGateSupport";

export {
  buildStage6CModelReviewGateConfirmedInput,
  buildStage6CReadyReviewGateInput,
} from "@/lib/agents/stage6RuntimeExecutionModelInput";

export type {
  RuntimeExecutionModelReviewGateDecisionInput,
} from "@/lib/agents/runtimeExecutionModelReviewGateTypes";

/** Read-only Stage 6-C review gate — does not grant runtime execution permission. */
export function evaluateRuntimeExecutionModelReviewGate(
  input: RuntimeExecutionModelReviewGateInput = {},
): RuntimeExecutionModelReviewGateReport {
  const source = evaluateRuntimeExecutionModelReviewGateSource(input);
  const parsed = parseRuntimeExecutionModelReviewGateInput(input);
  const { reviewedModelKinds, reviewedModelCount, reviewedFieldCount } = computeReviewedModelTrace(source);
  const forbiddenFieldDetected = detectForbiddenFieldsInModelCandidates(source);
  const noRunBoundarySatisfied = computeNoRunBoundarySatisfied(source);
  const persistenceBoundarySatisfied = computePersistenceBoundarySatisfied(source);

  const decision = resolveRuntimeExecutionModelReviewGateDecision({
    sourceModelCandidateDecision: source.decision,
    sourceCandidateOnly: source.candidateOnly === true,
    confirmationsSatisfied: parsed.confirmationsSatisfied,
    forbiddenFieldDetected,
    noRunBoundarySatisfied,
    persistenceBoundarySatisfied,
  });

  const reviewGateFingerprint = buildRuntimeExecutionModelReviewGateFingerprint({
    sourceModelCandidateFingerprint: source.modelCandidateFingerprint,
    reviewedModelKinds,
    reviewedFieldCount,
    confirmationCount: parsed.confirmationCount,
  });

  const { reviewChecklist, noRunChecklist, persistenceChecklist } =
    buildRuntimeExecutionModelReviewGateChecklists({
      source,
      parsed,
      reviewedModelKinds,
      forbiddenFieldDetected,
      noRunBoundarySatisfied,
      persistenceBoundarySatisfied,
    });

  const findings: RuntimeExecutionModelReviewGateFinding[] = [];
  appendRuntimeExecutionModelReviewGateFindings({
    findings,
    decision,
    source,
    parsed,
    forbiddenFieldDetected,
    noRunBoundarySatisfied,
    persistenceBoundarySatisfied,
  });

  return {
    mode: "read_only_runtime_execution_model_review_gate",
    stage: "stage_6_c_runtime_execution_model_review_gate",
    decision,
    sourceModelCandidateDecision: source.decision,
    sourceModelCandidateVersion: source.modelCandidateVersion,
    sourceModelCandidateFingerprint: source.modelCandidateFingerprint,
    sourceCandidateOnly: true,
    reviewGateVersion: RUNTIME_EXECUTION_MODEL_REVIEW_GATE_VERSION,
    reviewGateTitle: RUNTIME_EXECUTION_MODEL_REVIEW_GATE_TITLE,
    reviewGateSummary: buildRuntimeExecutionModelReviewGateSummary(decision),
    reviewGateFingerprint,
    reviewGateOnly: true,
    actualRuntimeExecutionAllowedInThisStep: false,
    actualExecutionWireAllowedInThisStep: false,
    actualPersistenceAllowedInThisStep: false,
    actualExternalSideEffectAllowedInThisStep: false,
    actualSchemaMigrationAllowedInThisStep: false,
    requiredConfirmations: [...REQUIRED_STAGE6_C_MODEL_REVIEW_GATE_CONFIRMATIONS],
    reviewChecklist,
    noRunChecklist,
    persistenceChecklist,
    findings,
    reviewedModelKinds,
    reviewedModelCount,
    reviewedFieldCount,
    forbiddenFieldDetected,
    recommendedNextPhases: [...STAGE6_C_RECOMMENDED_NEXT_PHASES],
    separatedWorkItems: [...STAGE6_C_SEPARATED_WORK_ITEMS],
  };
}
