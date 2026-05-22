/**
 * Stage 7-A runtime implementation planning candidate (read-only; no implementation permission).
 */

import type {
  RuntimeImplementationPlanningCandidateFinding,
  RuntimeImplementationPlanningCandidateInput,
  RuntimeImplementationPlanningCandidateReport,
} from "@/lib/agents/runtimeImplementationPlanningCandidateTypes";
import {
  appendRuntimeImplementationPlanningCandidateFindings,
  buildRuntimeImplementationPlanningCandidateChecklists,
  buildRuntimeImplementationPlanningCandidateFingerprint,
  buildRuntimeImplementationPlanningCandidateSummary,
  buildRuntimeImplementationPlanningItems,
  evaluateRuntimeImplementationPlanningCandidateSource,
  parseRuntimeImplementationPlanningCandidateInput,
  REQUIRED_STAGE7_A_IMPLEMENTATION_PLANNING_CONFIRMATIONS,
  resolveRuntimeImplementationPlanningCandidateDecision,
  RUNTIME_IMPLEMENTATION_PLANNING_CANDIDATE_TITLE,
  RUNTIME_IMPLEMENTATION_PLANNING_CANDIDATE_VERSION,
  STAGE7_A_RECOMMENDED_NEXT_PHASES,
  STAGE7_A_SEPARATED_WORK_ITEMS,
  validateRuntimeImplementationPlanningItems,
} from "@/lib/agents/runtimeImplementationPlanningCandidateSupport";

export {
  resolveRuntimeImplementationPlanningCandidateDecision,
  validateRuntimeImplementationPlanningItems,
  buildRuntimeImplementationPlanningItems,
} from "@/lib/agents/runtimeImplementationPlanningCandidateSupport";

export {
  buildStage7AReadyImplementationPlanningInput,
  buildStage7AImplementationPlanningConfirmedInput,
} from "@/lib/agents/stage6RuntimeExecutionModelInput";

export type { RuntimeImplementationPlanningCandidateDecisionInput } from "@/lib/agents/runtimeImplementationPlanningCandidateTypes";

/** Read-only Stage 7-A planning candidate — does not grant runtime implementation permission. */
export function evaluateRuntimeImplementationPlanningCandidate(
  input: RuntimeImplementationPlanningCandidateInput = {},
): RuntimeImplementationPlanningCandidateReport {
  const source = evaluateRuntimeImplementationPlanningCandidateSource(input);
  const parsed = parseRuntimeImplementationPlanningCandidateInput(input);
  const planningItems = buildRuntimeImplementationPlanningItems(source);
  const planningValidation = validateRuntimeImplementationPlanningItems(planningItems);
  const planningItemsValid = planningValidation.valid;
  const planningItemCount = planningItems.length;
  const separatedPrCandidateCount = planningItems.filter((item) => item.recommendedPrType === "separate_pr").length;

  const decision = resolveRuntimeImplementationPlanningCandidateDecision({
    sourceContractClosureDecision: source.decision,
    sourceStage6ContractClosed: source.stage6ContractClosed === true,
    sourceStage6ClosureOnly: source.stage6ClosureOnly === true,
    sourceActualRuntimeExecutionAllowedAfterStage6: source.actualRuntimeExecutionAllowedAfterStage6,
    sourceActualRuntimeExecutionAllowedInThisStep: source.actualRuntimeExecutionAllowedInThisStep,
    sourceActualExecutionRunnerAllowedInThisStep: source.actualExecutionRunnerAllowedInThisStep,
    sourceActualDryRunRunnerAllowedInThisStep: source.actualDryRunRunnerAllowedInThisStep,
    sourceActualExecutionWireAllowedInThisStep: source.actualExecutionWireAllowedInThisStep,
    sourceActualPersistenceAllowedInThisStep: source.actualPersistenceAllowedInThisStep,
    sourceActualExternalSideEffectAllowedInThisStep: source.actualExternalSideEffectAllowedInThisStep,
    sourceActualSchemaMigrationAllowedInThisStep: source.actualSchemaMigrationAllowedInThisStep,
    sourceActualCursorGithubWireAllowedInThisStep: source.actualCursorGithubWireAllowedInThisStep,
    sourceActualConnectorRoutingChangeAllowedInThisStep: source.actualConnectorRoutingChangeAllowedInThisStep,
    planningItemsValid,
    confirmationsSatisfied: parsed.confirmationsSatisfied,
  });

  const planningFingerprint = buildRuntimeImplementationPlanningCandidateFingerprint({
    sourceContractClosureFingerprint: source.closureFingerprint,
    planningItemCount,
    confirmationCount: parsed.confirmationCount,
    separatedPrCandidateCount,
    sourceActualRuntimeExecutionAllowedInThisStep: source.actualRuntimeExecutionAllowedInThisStep,
    sourceActualExecutionRunnerAllowedInThisStep: source.actualExecutionRunnerAllowedInThisStep,
    sourceActualDryRunRunnerAllowedInThisStep: source.actualDryRunRunnerAllowedInThisStep,
    sourceActualExecutionWireAllowedInThisStep: source.actualExecutionWireAllowedInThisStep,
    sourceActualPersistenceAllowedInThisStep: source.actualPersistenceAllowedInThisStep,
    sourceActualSchemaMigrationAllowedInThisStep: source.actualSchemaMigrationAllowedInThisStep,
    sourceActualCursorGithubWireAllowedInThisStep: source.actualCursorGithubWireAllowedInThisStep,
    sourceActualConnectorRoutingChangeAllowedInThisStep: source.actualConnectorRoutingChangeAllowedInThisStep,
    planningItemsValid,
  });

  const { planningChecklist, boundaryChecklist, approvalChecklist } =
    buildRuntimeImplementationPlanningCandidateChecklists({
      parsed,
      source,
      planningItemsValid,
      planningItemCount,
      separatedPrCandidateCount,
    });

  const findings: RuntimeImplementationPlanningCandidateFinding[] = [];
  appendRuntimeImplementationPlanningCandidateFindings({
    findings,
    decision,
    source,
    parsed,
    planningValidation,
  });

  return {
    mode: "read_only_runtime_implementation_planning_candidate",
    stage: "stage_7_a_runtime_implementation_planning_candidate",
    decision,
    sourceContractClosureDecision: source.decision,
    sourceContractClosureVersion: source.closureVersion,
    sourceContractClosureFingerprint: source.closureFingerprint,
    sourceStage6ContractClosed: source.stage6ContractClosed,
    sourceStage6ClosureOnly: source.stage6ClosureOnly,
    sourceActualRuntimeExecutionAllowedAfterStage6: source.actualRuntimeExecutionAllowedAfterStage6,
    sourceActualRuntimeExecutionAllowedInThisStep: source.actualRuntimeExecutionAllowedInThisStep,
    sourceActualExecutionRunnerAllowedInThisStep: source.actualExecutionRunnerAllowedInThisStep,
    sourceActualDryRunRunnerAllowedInThisStep: source.actualDryRunRunnerAllowedInThisStep,
    sourceActualExecutionWireAllowedInThisStep: source.actualExecutionWireAllowedInThisStep,
    sourceActualPersistenceAllowedInThisStep: source.actualPersistenceAllowedInThisStep,
    sourceActualExternalSideEffectAllowedInThisStep: source.actualExternalSideEffectAllowedInThisStep,
    sourceActualSchemaMigrationAllowedInThisStep: source.actualSchemaMigrationAllowedInThisStep,
    sourceActualCursorGithubWireAllowedInThisStep: source.actualCursorGithubWireAllowedInThisStep,
    sourceActualConnectorRoutingChangeAllowedInThisStep: source.actualConnectorRoutingChangeAllowedInThisStep,
    planningVersion: RUNTIME_IMPLEMENTATION_PLANNING_CANDIDATE_VERSION,
    planningTitle: RUNTIME_IMPLEMENTATION_PLANNING_CANDIDATE_TITLE,
    planningSummary: buildRuntimeImplementationPlanningCandidateSummary(decision),
    planningFingerprint,
    planningCandidateOnly: true,
    actualRuntimeExecutionAllowedInThisStep: false,
    actualExecutionRunnerAllowedInThisStep: false,
    actualDryRunRunnerAllowedInThisStep: false,
    actualExecutionWireAllowedInThisStep: false,
    actualPersistenceAllowedInThisStep: false,
    actualExternalSideEffectAllowedInThisStep: false,
    actualSchemaMigrationAllowedInThisStep: false,
    actualCursorGithubWireAllowedInThisStep: false,
    actualConnectorRoutingChangeAllowedInThisStep: false,
    actualUiImplementationAllowedInThisStep: false,
    requiredConfirmations: [...REQUIRED_STAGE7_A_IMPLEMENTATION_PLANNING_CONFIRMATIONS],
    planningItems,
    planningChecklist,
    boundaryChecklist,
    approvalChecklist,
    findings,
    planningItemCount,
    separatedPrCandidateCount,
    recommendedNextPhases: [...STAGE7_A_RECOMMENDED_NEXT_PHASES],
    separatedWorkItems: [...STAGE7_A_SEPARATED_WORK_ITEMS],
  };
}
