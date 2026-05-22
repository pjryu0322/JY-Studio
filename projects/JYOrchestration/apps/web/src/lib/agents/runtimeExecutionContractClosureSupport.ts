/**
 * Stage 6-F runtime execution contract closure support (read-only).
 */

import { evaluateRuntimeExecutionDryRunContract } from "@/lib/agents/evaluateRuntimeExecutionDryRunContract";
import type { RuntimeExecutionDryRunContractReport } from "@/lib/agents/runtimeExecutionDryRunContractTypes";
import { STAGE6_CLOSED_STAGES } from "@/lib/agents/runtimeExecutionContractClosureConstants";
import { buildRuntimeExecutionContractClosureChecklists } from "@/lib/agents/runtimeExecutionContractClosureChecklists";
import { appendRuntimeExecutionContractClosureFindings } from "@/lib/agents/runtimeExecutionContractClosureFindings";

export { buildRuntimeExecutionContractClosureChecklists } from "@/lib/agents/runtimeExecutionContractClosureChecklists";
export { appendRuntimeExecutionContractClosureFindings } from "@/lib/agents/runtimeExecutionContractClosureFindings";

export {
  REQUIRED_STAGE6_F_CONTRACT_CLOSURE_CONFIRMATIONS,
  RUNTIME_EXECUTION_CONTRACT_CLOSURE_TITLE,
  RUNTIME_EXECUTION_CONTRACT_CLOSURE_VERSION,
  STAGE6_CLOSED_STAGES,
  STAGE6_F_RECOMMENDED_NEXT_PHASES,
  STAGE6_F_SEPARATED_WORK_ITEMS,
} from "@/lib/agents/runtimeExecutionContractClosureConstants";

import type {
  ParsedRuntimeExecutionContractClosureInput,
  RuntimeExecutionContractClosureDecision,
  RuntimeExecutionContractClosureDecisionInput,
  RuntimeExecutionContractClosureInput,
} from "@/lib/agents/runtimeExecutionContractClosureTypes";

export function parseRuntimeExecutionContractClosureInput(
  input?: RuntimeExecutionContractClosureInput,
): ParsedRuntimeExecutionContractClosureInput {
  const flags = [
    input?.runtimeExecutionContractClosureConfirmed === true,
    input?.runtimeExecutionNoActualRunnerConfirmed === true,
    input?.runtimeExecutionNoPersistenceConfirmed === true,
    input?.runtimeExecutionSeparatedWorkReviewed === true,
    input?.runtimeExecutionStage7HandoffReviewed === true,
  ];
  return {
    runtimeExecutionContractClosureConfirmed: flags[0],
    runtimeExecutionNoActualRunnerConfirmed: flags[1],
    runtimeExecutionNoPersistenceConfirmed: flags[2],
    runtimeExecutionSeparatedWorkReviewed: flags[3],
    runtimeExecutionStage7HandoffReviewed: flags[4],
    confirmationsSatisfied: flags.every(Boolean),
    confirmationCount: flags.filter(Boolean).length,
  };
}

export function resolveRuntimeExecutionContractClosureDecision(
  input: RuntimeExecutionContractClosureDecisionInput,
): RuntimeExecutionContractClosureDecision {
  if (input.sourceDryRunContractDecision === "blocked") {
    return "blocked";
  }

  if (input.sourceDryRunContractDecision === "defer") {
    return "defer";
  }

  if (input.sourceDryRunContractDecision !== "ready_for_runtime_execution_contract_closure") {
    return "defer";
  }

  if (
    input.sourceDryRunContractOnly !== true ||
    input.sourceDryRunContractValidationValid !== true ||
    input.sourceNoRunBoundarySatisfied !== true ||
    input.sourcePersistenceBoundarySatisfied !== true ||
    input.sourceSchemaMigrationBoundarySatisfied !== true ||
    input.sourceActualRuntimeExecutionAllowedInThisStep !== false ||
    input.sourceActualExecutionRunnerAllowedInThisStep !== false ||
    input.sourceActualDryRunRunnerAllowedInThisStep !== false ||
    input.sourceActualExecutionWireAllowedInThisStep !== false ||
    input.sourceActualPersistenceAllowedInThisStep !== false ||
    input.sourceActualExternalSideEffectAllowedInThisStep !== false ||
    input.sourceActualSchemaMigrationAllowedInThisStep !== false ||
    input.sourceActualCursorGithubWireAllowedInThisStep !== false ||
    input.sourceActualConnectorRoutingChangeAllowedInThisStep !== false ||
    input.sourceDryRunContractItemCount < 7 ||
    input.sourceDryRunScenarioCount < 7 ||
    input.sourceDryRunAssertionCount < 14
  ) {
    return "blocked";
  }

  if (!input.confirmationsSatisfied) {
    return "defer";
  }

  return "stage6_runtime_execution_contract_closed";
}

export function buildRuntimeExecutionContractClosureFingerprint(input: {
  readonly sourceDryRunContractFingerprint: string;
  readonly closedStageCount: number;
  readonly confirmationCount: number;
  readonly sourceNoRunBoundarySatisfied: boolean;
  readonly sourcePersistenceBoundarySatisfied: boolean;
  readonly sourceSchemaMigrationBoundarySatisfied: boolean;
  readonly sourceActualRuntimeExecutionAllowedInThisStep: boolean;
  readonly sourceActualExecutionRunnerAllowedInThisStep: boolean;
  readonly sourceActualDryRunRunnerAllowedInThisStep: boolean;
  readonly sourceActualExecutionWireAllowedInThisStep: boolean;
  readonly sourceActualPersistenceAllowedInThisStep: boolean;
  readonly sourceActualSchemaMigrationAllowedInThisStep: boolean;
  readonly sourceActualConnectorRoutingChangeAllowedInThisStep: boolean;
}): string {
  return [
    "runtime-execution-contract-closure-v1",
    input.sourceDryRunContractFingerprint,
    `closedStages:${input.closedStageCount}`,
    `confirmations:${input.confirmationCount}`,
    `noRun:${input.sourceNoRunBoundarySatisfied}`,
    `persistence:${input.sourcePersistenceBoundarySatisfied}`,
    `schema:${input.sourceSchemaMigrationBoundarySatisfied}`,
    `sourceActualRuntime:${input.sourceActualRuntimeExecutionAllowedInThisStep}`,
    `sourceActualRunner:${input.sourceActualExecutionRunnerAllowedInThisStep}`,
    `sourceActualDryRunRunner:${input.sourceActualDryRunRunnerAllowedInThisStep}`,
    `sourceActualWire:${input.sourceActualExecutionWireAllowedInThisStep}`,
    `sourceActualPersistence:${input.sourceActualPersistenceAllowedInThisStep}`,
    `sourceActualSchema:${input.sourceActualSchemaMigrationAllowedInThisStep}`,
    `sourceActualConnectorRouting:${input.sourceActualConnectorRoutingChangeAllowedInThisStep}`,
  ].join("::");
}

export function buildRuntimeExecutionContractClosureSummary(
  decision: RuntimeExecutionContractClosureDecision,
): string {
  if (decision === "blocked") {
    return "Stage 6-F runtime execution contract closure is blocked.";
  }
  if (decision === "defer") {
    return "Stage 6-F contract closure defers; dry-run contract or confirmations are incomplete.";
  }
  return "Stage 6-A through 6-E read-only runtime execution contract design chain is closed. Actual implementation requires Stage 7 or separate PR approval.";
}

export function buildStage6ClosureSummary(decision: RuntimeExecutionContractClosureDecision): string {
  if (decision !== "stage6_runtime_execution_contract_closed") {
    return "Stage 6 runtime execution contract chain is not closed.";
  }
  return `Closed stages: ${STAGE6_CLOSED_STAGES.join(", ")}. Actual runtime execution remains disallowed after Stage 6.`;
}

/** Evaluate source Stage 6-E report for contract closure. */
export function evaluateRuntimeExecutionContractClosureSource(
  input?: RuntimeExecutionContractClosureInput,
): RuntimeExecutionDryRunContractReport {
  return evaluateRuntimeExecutionDryRunContract(input?.dryRunContract);
}
