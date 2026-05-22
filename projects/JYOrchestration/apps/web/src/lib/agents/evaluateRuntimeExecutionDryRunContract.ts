/**
 * Stage 6-E runtime execution dry-run contract (read-only; no dry-run runner implementation).
 */

import type {
  RuntimeExecutionDryRunContractFinding,
  RuntimeExecutionDryRunContractInput,
  RuntimeExecutionDryRunContractReport,
} from "@/lib/agents/runtimeExecutionDryRunContractTypes";
import {
  appendRuntimeExecutionDryRunContractFindings,
  buildRuntimeExecutionDryRunContractChecklists,
  buildRuntimeExecutionDryRunContractFingerprint,
  buildRuntimeExecutionDryRunContractItems,
  buildRuntimeExecutionDryRunContractSummary,
  computeRuntimeExecutionDryRunContractTrace,
  evaluateRuntimeExecutionDryRunContractSource,
  parseRuntimeExecutionDryRunContractInput,
  REQUIRED_STAGE6_E_DRY_RUN_CONTRACT_CONFIRMATIONS,
  resolveRuntimeExecutionDryRunContractDecision,
  RUNTIME_EXECUTION_DRY_RUN_CONTRACT_TITLE,
  RUNTIME_EXECUTION_DRY_RUN_CONTRACT_VERSION,
  STAGE6_E_RECOMMENDED_NEXT_PHASES,
  STAGE6_E_SEPARATED_WORK_ITEMS,
  validateRuntimeExecutionDryRunContractItemDetails,
} from "@/lib/agents/runtimeExecutionDryRunContractSupport";

export {
  resolveRuntimeExecutionDryRunContractDecision,
  validateRuntimeExecutionDryRunContractItemDetails,
  validateRuntimeExecutionDryRunContractItems,
} from "@/lib/agents/runtimeExecutionDryRunContractSupport";

export {
  buildStage6EDryRunContractConfirmedInput,
  buildStage6EReadyDryRunContractInput,
} from "@/lib/agents/stage6RuntimeExecutionModelInput";

export type { RuntimeExecutionDryRunContractDecisionInput } from "@/lib/agents/runtimeExecutionDryRunContractTypes";

/** Read-only Stage 6-E dry-run contract — does not implement dry-run runner. */
export function evaluateRuntimeExecutionDryRunContract(
  input: RuntimeExecutionDryRunContractInput = {},
): RuntimeExecutionDryRunContractReport {
  const source = evaluateRuntimeExecutionDryRunContractSource(input);
  const parsed = parseRuntimeExecutionDryRunContractInput(input);
  const dryRunContractItems = buildRuntimeExecutionDryRunContractItems(source);
  const dryRunContractValidation = validateRuntimeExecutionDryRunContractItemDetails(dryRunContractItems);
  const dryRunContractItemsValid = dryRunContractValidation.valid;
  const trace = computeRuntimeExecutionDryRunContractTrace(dryRunContractItems);

  const decision = resolveRuntimeExecutionDryRunContractDecision({
    sourceContractCandidateDecision: source.decision,
    sourceReviewGateOnly: source.sourceReviewGateOnly,
    sourceCandidateOnly: source.sourceCandidateOnly === true,
    sourceContractCandidateOnly: source.contractCandidateOnly === true,
    sourceContractCandidateValidationValid: source.contractCandidateValidation.valid === true,
    sourceForbiddenFieldDetected: source.sourceForbiddenFieldDetected === true,
    sourceActualRuntimeExecutionAllowedInThisStep: source.actualRuntimeExecutionAllowedInThisStep,
    sourceActualExecutionRunnerAllowedInThisStep: source.actualExecutionRunnerAllowedInThisStep,
    sourceActualExecutionWireAllowedInThisStep: source.actualExecutionWireAllowedInThisStep,
    sourceActualPersistenceAllowedInThisStep: source.actualPersistenceAllowedInThisStep,
    sourceActualExternalSideEffectAllowedInThisStep: source.actualExternalSideEffectAllowedInThisStep,
    sourceActualSchemaMigrationAllowedInThisStep: source.actualSchemaMigrationAllowedInThisStep,
    sourceActualCursorGithubWireAllowedInThisStep: source.actualCursorGithubWireAllowedInThisStep,
    sourceActualConnectorRoutingChangeAllowedInThisStep: source.actualConnectorRoutingChangeAllowedInThisStep,
    sourceNoRunBoundarySatisfied: source.sourceNoRunBoundarySatisfied,
    sourcePersistenceBoundarySatisfied: source.sourcePersistenceBoundarySatisfied,
    sourceSchemaMigrationBoundarySatisfied: source.sourceSchemaMigrationBoundarySatisfied,
    sourceContractCandidateCount: source.contractCandidateCount,
    confirmationsSatisfied: parsed.confirmationsSatisfied,
    dryRunContractItemsValid,
  });

  const dryRunContractFingerprint = buildRuntimeExecutionDryRunContractFingerprint({
    sourceContractCandidateFingerprint: source.contractCandidateFingerprint,
    dryRunContractItemCount: trace.dryRunContractItemCount,
    dryRunScenarioCount: trace.dryRunScenarioCount,
    dryRunAssertionCount: trace.dryRunAssertionCount,
    confirmationCount: parsed.confirmationCount,
    sourceContractCandidateOnly: source.contractCandidateOnly === true,
    sourceContractCandidateValidationValid: source.contractCandidateValidation.valid === true,
    sourceForbiddenFieldDetected: source.sourceForbiddenFieldDetected === true,
    sourceActualRuntimeExecutionAllowedInThisStep: source.actualRuntimeExecutionAllowedInThisStep,
    sourceActualExecutionWireAllowedInThisStep: source.actualExecutionWireAllowedInThisStep,
    sourceActualPersistenceAllowedInThisStep: source.actualPersistenceAllowedInThisStep,
    sourceNoRunBoundarySatisfied: source.sourceNoRunBoundarySatisfied,
    sourcePersistenceBoundarySatisfied: source.sourcePersistenceBoundarySatisfied,
    sourceSchemaMigrationBoundarySatisfied: source.sourceSchemaMigrationBoundarySatisfied,
  });

  const { dryRunChecklist, boundaryChecklist } = buildRuntimeExecutionDryRunContractChecklists({
    dryRunContractItems,
    parsed,
  });

  const findings: RuntimeExecutionDryRunContractFinding[] = [];
  appendRuntimeExecutionDryRunContractFindings({
    findings,
    decision,
    source,
    parsed,
    dryRunContractValidation,
  });

  return {
    mode: "read_only_runtime_execution_dry_run_contract",
    stage: "stage_6_e_runtime_execution_dry_run_contract",
    decision,
    sourceContractCandidateDecision: source.decision,
    sourceContractCandidateVersion: source.contractCandidateVersion,
    sourceContractCandidateFingerprint: source.contractCandidateFingerprint,
    sourceContractCandidateOnly: source.contractCandidateOnly,
    sourceContractCandidateCount: source.contractCandidateCount,
    sourceContractFieldCount: source.contractFieldCount,
    sourceContractBoundaryRuleCount: source.contractBoundaryRuleCount,
    sourceReviewGateDecision: source.sourceReviewGateDecision,
    sourceReviewGateOnly: source.sourceReviewGateOnly,
    sourceCandidateOnly: source.sourceCandidateOnly,
    sourceReviewedModelCount: source.sourceReviewedModelCount,
    sourceReviewedFieldCount: source.sourceReviewedFieldCount,
    sourceForbiddenFieldDetected: source.sourceForbiddenFieldDetected,
    sourceNoRunBoundarySatisfied: source.sourceNoRunBoundarySatisfied,
    sourcePersistenceBoundarySatisfied: source.sourcePersistenceBoundarySatisfied,
    sourceSchemaMigrationBoundarySatisfied: source.sourceSchemaMigrationBoundarySatisfied,
    sourceContractCandidateValidationValid: source.contractCandidateValidation.valid,
    sourceActualRuntimeExecutionAllowedInThisStep: source.actualRuntimeExecutionAllowedInThisStep,
    sourceActualExecutionRunnerAllowedInThisStep: source.actualExecutionRunnerAllowedInThisStep,
    sourceActualExecutionWireAllowedInThisStep: source.actualExecutionWireAllowedInThisStep,
    sourceActualPersistenceAllowedInThisStep: source.actualPersistenceAllowedInThisStep,
    sourceActualExternalSideEffectAllowedInThisStep: source.actualExternalSideEffectAllowedInThisStep,
    sourceActualSchemaMigrationAllowedInThisStep: source.actualSchemaMigrationAllowedInThisStep,
    sourceActualCursorGithubWireAllowedInThisStep: source.actualCursorGithubWireAllowedInThisStep,
    sourceActualConnectorRoutingChangeAllowedInThisStep: source.actualConnectorRoutingChangeAllowedInThisStep,
    dryRunContractVersion: RUNTIME_EXECUTION_DRY_RUN_CONTRACT_VERSION,
    dryRunContractTitle: RUNTIME_EXECUTION_DRY_RUN_CONTRACT_TITLE,
    dryRunContractSummary: buildRuntimeExecutionDryRunContractSummary(decision),
    dryRunContractFingerprint,
    dryRunContractValidation,
    dryRunContractOnly: true,
    actualRuntimeExecutionAllowedInThisStep: false,
    actualExecutionRunnerAllowedInThisStep: false,
    actualDryRunRunnerAllowedInThisStep: false,
    actualExecutionWireAllowedInThisStep: false,
    actualPersistenceAllowedInThisStep: false,
    actualExternalSideEffectAllowedInThisStep: false,
    actualSchemaMigrationAllowedInThisStep: false,
    actualCursorGithubWireAllowedInThisStep: false,
    actualConnectorRoutingChangeAllowedInThisStep: false,
    requiredConfirmations: [...REQUIRED_STAGE6_E_DRY_RUN_CONTRACT_CONFIRMATIONS],
    dryRunContractItems,
    dryRunChecklist,
    boundaryChecklist,
    findings,
    dryRunContractItemCount: trace.dryRunContractItemCount,
    dryRunScenarioCount: trace.dryRunScenarioCount,
    dryRunAssertionCount: trace.dryRunAssertionCount,
    recommendedNextPhases: [...STAGE6_E_RECOMMENDED_NEXT_PHASES],
    separatedWorkItems: [...STAGE6_E_SEPARATED_WORK_ITEMS],
  };
}
