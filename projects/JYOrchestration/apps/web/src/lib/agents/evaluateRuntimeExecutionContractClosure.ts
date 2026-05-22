/**
 * Stage 6-F runtime execution contract closure (read-only; no implementation permission).
 */

import type {
  RuntimeExecutionContractClosureFinding,
  RuntimeExecutionContractClosureInput,
  RuntimeExecutionContractClosureReport,
} from "@/lib/agents/runtimeExecutionContractClosureTypes";
import {
  appendRuntimeExecutionContractClosureFindings,
  buildRuntimeExecutionContractClosureChecklists,
  buildRuntimeExecutionContractClosureFingerprint,
  buildRuntimeExecutionContractClosureSummary,
  buildStage6ClosureSummary,
  evaluateRuntimeExecutionContractClosureSource,
  parseRuntimeExecutionContractClosureInput,
  REQUIRED_STAGE6_F_CONTRACT_CLOSURE_CONFIRMATIONS,
  resolveRuntimeExecutionContractClosureDecision,
  RUNTIME_EXECUTION_CONTRACT_CLOSURE_TITLE,
  RUNTIME_EXECUTION_CONTRACT_CLOSURE_VERSION,
  STAGE6_CLOSED_STAGES,
  STAGE6_F_RECOMMENDED_NEXT_PHASES,
  STAGE6_F_SEPARATED_WORK_ITEMS,
} from "@/lib/agents/runtimeExecutionContractClosureSupport";

export { resolveRuntimeExecutionContractClosureDecision } from "@/lib/agents/runtimeExecutionContractClosureSupport";

export {
  buildStage6FReadyContractClosureInput,
  buildStage6FRuntimeExecutionContractClosureConfirmedInput,
} from "@/lib/agents/stage6RuntimeExecutionModelInput";

export type { RuntimeExecutionContractClosureDecisionInput } from "@/lib/agents/runtimeExecutionContractClosureTypes";

/** Read-only Stage 6-F contract closure — does not grant runtime execution permission. */
export function evaluateRuntimeExecutionContractClosure(
  input: RuntimeExecutionContractClosureInput = {},
): RuntimeExecutionContractClosureReport {
  const source = evaluateRuntimeExecutionContractClosureSource(input);
  const parsed = parseRuntimeExecutionContractClosureInput(input);

  const decision = resolveRuntimeExecutionContractClosureDecision({
    sourceDryRunContractDecision: source.decision,
    sourceDryRunContractOnly: source.dryRunContractOnly === true,
    sourceDryRunContractValidationValid: source.dryRunContractValidation.valid === true,
    sourceNoRunBoundarySatisfied: source.sourceNoRunBoundarySatisfied,
    sourcePersistenceBoundarySatisfied: source.sourcePersistenceBoundarySatisfied,
    sourceSchemaMigrationBoundarySatisfied: source.sourceSchemaMigrationBoundarySatisfied,
    sourceActualRuntimeExecutionAllowedInThisStep: source.actualRuntimeExecutionAllowedInThisStep,
    sourceActualExecutionRunnerAllowedInThisStep: source.actualExecutionRunnerAllowedInThisStep,
    sourceActualDryRunRunnerAllowedInThisStep: source.actualDryRunRunnerAllowedInThisStep,
    sourceActualExecutionWireAllowedInThisStep: source.actualExecutionWireAllowedInThisStep,
    sourceActualPersistenceAllowedInThisStep: source.actualPersistenceAllowedInThisStep,
    sourceActualExternalSideEffectAllowedInThisStep: source.actualExternalSideEffectAllowedInThisStep,
    sourceActualSchemaMigrationAllowedInThisStep: source.actualSchemaMigrationAllowedInThisStep,
    sourceActualCursorGithubWireAllowedInThisStep: source.actualCursorGithubWireAllowedInThisStep,
    sourceActualConnectorRoutingChangeAllowedInThisStep: source.actualConnectorRoutingChangeAllowedInThisStep,
    sourceDryRunContractItemCount: source.dryRunContractItemCount,
    sourceDryRunScenarioCount: source.dryRunScenarioCount,
    sourceDryRunAssertionCount: source.dryRunAssertionCount,
    confirmationsSatisfied: parsed.confirmationsSatisfied,
  });

  const closureFingerprint = buildRuntimeExecutionContractClosureFingerprint({
    sourceDryRunContractFingerprint: source.dryRunContractFingerprint,
    closedStageCount: STAGE6_CLOSED_STAGES.length,
    confirmationCount: parsed.confirmationCount,
    sourceNoRunBoundarySatisfied: source.sourceNoRunBoundarySatisfied,
    sourcePersistenceBoundarySatisfied: source.sourcePersistenceBoundarySatisfied,
    sourceSchemaMigrationBoundarySatisfied: source.sourceSchemaMigrationBoundarySatisfied,
    sourceActualRuntimeExecutionAllowedInThisStep: source.actualRuntimeExecutionAllowedInThisStep,
    sourceActualExecutionRunnerAllowedInThisStep: source.actualExecutionRunnerAllowedInThisStep,
    sourceActualDryRunRunnerAllowedInThisStep: source.actualDryRunRunnerAllowedInThisStep,
    sourceActualExecutionWireAllowedInThisStep: source.actualExecutionWireAllowedInThisStep,
    sourceActualPersistenceAllowedInThisStep: source.actualPersistenceAllowedInThisStep,
    sourceActualSchemaMigrationAllowedInThisStep: source.actualSchemaMigrationAllowedInThisStep,
    sourceActualConnectorRoutingChangeAllowedInThisStep: source.actualConnectorRoutingChangeAllowedInThisStep,
  });

  const { closureChecklist, boundaryChecklist, handoffChecklist } =
    buildRuntimeExecutionContractClosureChecklists({ parsed, source });

  const findings: RuntimeExecutionContractClosureFinding[] = [];
  appendRuntimeExecutionContractClosureFindings({
    findings,
    decision,
    source,
    parsed,
    closureFingerprint,
  });

  const stage6ContractClosed = decision === "stage6_runtime_execution_contract_closed";

  return {
    mode: "read_only_runtime_execution_contract_closure",
    stage: "stage_6_f_runtime_execution_contract_closure",
    decision,
    sourceDryRunContractDecision: source.decision,
    sourceDryRunContractVersion: source.dryRunContractVersion,
    sourceDryRunContractFingerprint: source.dryRunContractFingerprint,
    sourceDryRunContractOnly: source.dryRunContractOnly,
    sourceDryRunContractItemCount: source.dryRunContractItemCount,
    sourceDryRunScenarioCount: source.dryRunScenarioCount,
    sourceDryRunAssertionCount: source.dryRunAssertionCount,
    sourceDryRunContractValidationValid: source.dryRunContractValidation.valid,
    sourceNoRunBoundarySatisfied: source.sourceNoRunBoundarySatisfied,
    sourcePersistenceBoundarySatisfied: source.sourcePersistenceBoundarySatisfied,
    sourceSchemaMigrationBoundarySatisfied: source.sourceSchemaMigrationBoundarySatisfied,
    sourceActualRuntimeExecutionAllowedInThisStep: source.actualRuntimeExecutionAllowedInThisStep,
    sourceActualExecutionRunnerAllowedInThisStep: source.actualExecutionRunnerAllowedInThisStep,
    sourceActualDryRunRunnerAllowedInThisStep: source.actualDryRunRunnerAllowedInThisStep,
    sourceActualExecutionWireAllowedInThisStep: source.actualExecutionWireAllowedInThisStep,
    sourceActualPersistenceAllowedInThisStep: source.actualPersistenceAllowedInThisStep,
    sourceActualExternalSideEffectAllowedInThisStep: source.actualExternalSideEffectAllowedInThisStep,
    sourceActualSchemaMigrationAllowedInThisStep: source.actualSchemaMigrationAllowedInThisStep,
    sourceActualCursorGithubWireAllowedInThisStep: source.actualCursorGithubWireAllowedInThisStep,
    sourceActualConnectorRoutingChangeAllowedInThisStep: source.actualConnectorRoutingChangeAllowedInThisStep,
    closureVersion: RUNTIME_EXECUTION_CONTRACT_CLOSURE_VERSION,
    closureTitle: RUNTIME_EXECUTION_CONTRACT_CLOSURE_TITLE,
    closureSummary: buildRuntimeExecutionContractClosureSummary(decision),
    closureFingerprint,
    stage6ContractClosed,
    stage6ClosureOnly: true,
    actualRuntimeExecutionAllowedAfterStage6: false,
    actualRuntimeExecutionAllowedInThisStep: false,
    actualExecutionRunnerAllowedInThisStep: false,
    actualDryRunRunnerAllowedInThisStep: false,
    actualExecutionWireAllowedInThisStep: false,
    actualPersistenceAllowedInThisStep: false,
    actualExternalSideEffectAllowedInThisStep: false,
    actualSchemaMigrationAllowedInThisStep: false,
    actualCursorGithubWireAllowedInThisStep: false,
    actualConnectorRoutingChangeAllowedInThisStep: false,
    requiredConfirmations: [...REQUIRED_STAGE6_F_CONTRACT_CLOSURE_CONFIRMATIONS],
    closureChecklist,
    boundaryChecklist,
    handoffChecklist,
    findings,
    closedStages: [...STAGE6_CLOSED_STAGES],
    stage6ClosureSummary: buildStage6ClosureSummary(decision),
    recommendedNextPhases: [...STAGE6_F_RECOMMENDED_NEXT_PHASES],
    separatedWorkItems: [...STAGE6_F_SEPARATED_WORK_ITEMS],
  };
}
