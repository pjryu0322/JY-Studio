/**
 * Stage 6-D runtime execution contract candidate (read-only; no execution implementation).
 */

import type {
  RuntimeExecutionContractCandidateFinding,
  RuntimeExecutionContractCandidateInput,
  RuntimeExecutionContractCandidateReport,
} from "@/lib/agents/runtimeExecutionContractCandidateTypes";
import {
  appendRuntimeExecutionContractCandidateFindings,
  buildRuntimeExecutionContractCandidateChecklists,
  buildRuntimeExecutionContractCandidates,
  buildRuntimeExecutionContractCandidateFingerprint,
  buildRuntimeExecutionContractCandidateSummary,
  computeRuntimeExecutionContractCandidateTrace,
  evaluateRuntimeExecutionContractCandidateSource,
  parseRuntimeExecutionContractCandidateInput,
  REQUIRED_STAGE6_D_CONTRACT_CANDIDATE_CONFIRMATIONS,
  resolveRuntimeExecutionContractCandidateDecision,
  RUNTIME_EXECUTION_CONTRACT_CANDIDATE_TITLE,
  RUNTIME_EXECUTION_CONTRACT_CANDIDATE_VERSION,
  STAGE6_D_RECOMMENDED_NEXT_PHASES,
  STAGE6_D_SEPARATED_WORK_ITEMS,
  validateRuntimeExecutionContractCandidates,
} from "@/lib/agents/runtimeExecutionContractCandidateSupport";

export {
  resolveRuntimeExecutionContractCandidateDecision,
  validateRuntimeExecutionContractCandidates,
} from "@/lib/agents/runtimeExecutionContractCandidateSupport";

export {
  buildStage6DContractCandidateConfirmedInput,
  buildStage6DReadyContractCandidateInput,
} from "@/lib/agents/stage6RuntimeExecutionModelInput";

export type { RuntimeExecutionContractCandidateDecisionInput } from "@/lib/agents/runtimeExecutionContractCandidateTypes";

/** Read-only Stage 6-D contract candidate — does not implement runtime execution. */
export function evaluateRuntimeExecutionContractCandidate(
  input: RuntimeExecutionContractCandidateInput = {},
): RuntimeExecutionContractCandidateReport {
  const source = evaluateRuntimeExecutionContractCandidateSource(input);
  const parsed = parseRuntimeExecutionContractCandidateInput(input);
  const contractCandidates = buildRuntimeExecutionContractCandidates(source);
  const contractCandidatesValid = validateRuntimeExecutionContractCandidates(contractCandidates);
  const trace = computeRuntimeExecutionContractCandidateTrace(contractCandidates, source);

  const decision = resolveRuntimeExecutionContractCandidateDecision({
    sourceReviewGateDecision: source.decision,
    sourceReviewGateOnly: source.reviewGateOnly === true,
    sourceCandidateOnly: source.sourceCandidateOnly === true,
    sourceNoRunBoundarySatisfied: source.sourceNoRunBoundarySatisfied,
    sourcePersistenceBoundarySatisfied: source.sourcePersistenceBoundarySatisfied,
    sourceSchemaMigrationBoundarySatisfied: source.schemaMigrationBoundarySatisfied === true,
    confirmationsSatisfied: parsed.confirmationsSatisfied,
    contractCandidatesValid,
  });

  const contractCandidateFingerprint = buildRuntimeExecutionContractCandidateFingerprint({
    sourceReviewGateFingerprint: source.reviewGateFingerprint,
    contractCandidateCount: trace.contractCandidateCount,
    contractFieldCount: trace.contractFieldCount,
    contractBoundaryRuleCount: trace.contractBoundaryRuleCount,
    confirmationCount: parsed.confirmationCount,
    sourceNoRunBoundarySatisfied: source.sourceNoRunBoundarySatisfied,
    sourcePersistenceBoundarySatisfied: source.sourcePersistenceBoundarySatisfied,
    sourceSchemaMigrationBoundarySatisfied: source.schemaMigrationBoundarySatisfied === true,
  });

  const { contractChecklist, boundaryChecklist, dryRunChecklist } =
    buildRuntimeExecutionContractCandidateChecklists({
      contractCandidates,
      parsed,
    });

  const findings: RuntimeExecutionContractCandidateFinding[] = [];
  appendRuntimeExecutionContractCandidateFindings({
    findings,
    decision,
    source,
    parsed,
    contractCandidatesValid,
  });

  return {
    mode: "read_only_runtime_execution_contract_candidate",
    stage: "stage_6_d_runtime_execution_contract_candidate",
    decision,
    sourceReviewGateDecision: source.decision,
    sourceReviewGateVersion: source.reviewGateVersion,
    sourceReviewGateFingerprint: source.reviewGateFingerprint,
    sourceReviewGateOnly: source.reviewGateOnly,
    sourceCandidateOnly: source.sourceCandidateOnly,
    sourceNoRunBoundarySatisfied: source.sourceNoRunBoundarySatisfied,
    sourcePersistenceBoundarySatisfied: source.sourcePersistenceBoundarySatisfied,
    sourceSchemaMigrationBoundarySatisfied: source.schemaMigrationBoundarySatisfied,
    contractCandidateVersion: RUNTIME_EXECUTION_CONTRACT_CANDIDATE_VERSION,
    contractCandidateTitle: RUNTIME_EXECUTION_CONTRACT_CANDIDATE_TITLE,
    contractCandidateSummary: buildRuntimeExecutionContractCandidateSummary(decision),
    contractCandidateFingerprint,
    contractCandidateOnly: true,
    actualRuntimeExecutionAllowedInThisStep: false,
    actualExecutionRunnerAllowedInThisStep: false,
    actualExecutionWireAllowedInThisStep: false,
    actualPersistenceAllowedInThisStep: false,
    actualExternalSideEffectAllowedInThisStep: false,
    actualSchemaMigrationAllowedInThisStep: false,
    actualCursorGithubWireAllowedInThisStep: false,
    actualConnectorRoutingChangeAllowedInThisStep: false,
    requiredConfirmations: [...REQUIRED_STAGE6_D_CONTRACT_CANDIDATE_CONFIRMATIONS],
    contractCandidates,
    contractChecklist,
    boundaryChecklist,
    dryRunChecklist,
    findings,
    contractCandidateCount: trace.contractCandidateCount,
    contractFieldCount: trace.contractFieldCount,
    contractBoundaryRuleCount: trace.contractBoundaryRuleCount,
    reviewedModelCount: trace.reviewedModelCount,
    recommendedNextPhases: [...STAGE6_D_RECOMMENDED_NEXT_PHASES],
    separatedWorkItems: [...STAGE6_D_SEPARATED_WORK_ITEMS],
  };
}
