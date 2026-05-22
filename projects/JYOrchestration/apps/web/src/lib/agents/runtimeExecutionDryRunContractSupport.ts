/**
 * Stage 6-E runtime execution dry-run contract support (read-only).
 */

import { evaluateRuntimeExecutionContractCandidate } from "@/lib/agents/evaluateRuntimeExecutionContractCandidate";
import type { RuntimeExecutionContractCandidateReport } from "@/lib/agents/runtimeExecutionContractCandidateTypes";
import { buildRuntimeExecutionDryRunContractChecklists } from "@/lib/agents/runtimeExecutionDryRunContractChecklists";
import { appendRuntimeExecutionDryRunContractFindings } from "@/lib/agents/runtimeExecutionDryRunContractFindings";
import {
  buildRuntimeExecutionDryRunContractItems,
  validateRuntimeExecutionDryRunContractItemDetails,
  validateRuntimeExecutionDryRunContractItems,
} from "@/lib/agents/runtimeExecutionDryRunContractItems";

export {
  buildRuntimeExecutionDryRunContractItems,
  validateRuntimeExecutionDryRunContractItemDetails,
  validateRuntimeExecutionDryRunContractItems,
} from "@/lib/agents/runtimeExecutionDryRunContractItems";

export { buildRuntimeExecutionDryRunContractChecklists } from "@/lib/agents/runtimeExecutionDryRunContractChecklists";
export { appendRuntimeExecutionDryRunContractFindings } from "@/lib/agents/runtimeExecutionDryRunContractFindings";

export {
  REQUIRED_STAGE6_E_DRY_RUN_CONTRACT_CONFIRMATIONS,
  RUNTIME_EXECUTION_DRY_RUN_CONTRACT_TITLE,
  RUNTIME_EXECUTION_DRY_RUN_CONTRACT_VERSION,
  STAGE6_E_RECOMMENDED_NEXT_PHASES,
  STAGE6_E_SEPARATED_WORK_ITEMS,
} from "@/lib/agents/runtimeExecutionDryRunContractConstants";

import type {
  ParsedRuntimeExecutionDryRunContractInput,
  RuntimeExecutionDryRunContractDecision,
  RuntimeExecutionDryRunContractDecisionInput,
  RuntimeExecutionDryRunContractInput,
  RuntimeExecutionDryRunContractItem,
} from "@/lib/agents/runtimeExecutionDryRunContractTypes";

export function parseRuntimeExecutionDryRunContractInput(
  input?: RuntimeExecutionDryRunContractInput,
): ParsedRuntimeExecutionDryRunContractInput {
  const flags = [
    input?.runtimeExecutionDryRunContractConfirmed === true,
    input?.runtimeExecutionDryRunBoundaryReviewed === true,
    input?.runtimeExecutionDryRunNoRunnerConfirmed === true,
    input?.runtimeExecutionDryRunPersistenceReviewed === true,
    input?.runtimeExecutionDryRunRollbackReviewed === true,
  ];
  return {
    runtimeExecutionDryRunContractConfirmed: flags[0],
    runtimeExecutionDryRunBoundaryReviewed: flags[1],
    runtimeExecutionDryRunNoRunnerConfirmed: flags[2],
    runtimeExecutionDryRunPersistenceReviewed: flags[3],
    runtimeExecutionDryRunRollbackReviewed: flags[4],
    confirmationsSatisfied: flags.every(Boolean),
    confirmationCount: flags.filter(Boolean).length,
  };
}

export function computeRuntimeExecutionDryRunContractTrace(items: readonly RuntimeExecutionDryRunContractItem[]): {
  readonly dryRunContractItemCount: number;
  readonly dryRunScenarioCount: number;
  readonly dryRunAssertionCount: number;
} {
  return {
    dryRunContractItemCount: items.length,
    dryRunScenarioCount: items.length,
    dryRunAssertionCount: items.reduce((sum, item) => sum + item.expectedAssertions.length, 0),
  };
}

export function resolveRuntimeExecutionDryRunContractDecision(
  input: RuntimeExecutionDryRunContractDecisionInput,
): RuntimeExecutionDryRunContractDecision {
  if (input.sourceContractCandidateDecision === "blocked") {
    return "blocked";
  }

  if (input.sourceContractCandidateDecision === "defer") {
    return "defer";
  }

  if (input.sourceContractCandidateDecision !== "ready_for_runtime_execution_dry_run_contract") {
    return "defer";
  }

  if (
    input.sourceReviewGateOnly !== true ||
    input.sourceCandidateOnly !== true ||
    input.sourceContractCandidateOnly !== true ||
    input.sourceContractCandidateValidationValid !== true ||
    input.sourceForbiddenFieldDetected === true ||
    input.sourceNoRunBoundarySatisfied !== true ||
    input.sourcePersistenceBoundarySatisfied !== true ||
    input.sourceSchemaMigrationBoundarySatisfied !== true ||
    input.sourceActualRuntimeExecutionAllowedInThisStep !== false ||
    input.sourceActualExecutionRunnerAllowedInThisStep !== false ||
    input.sourceActualExecutionWireAllowedInThisStep !== false ||
    input.sourceActualPersistenceAllowedInThisStep !== false ||
    input.sourceActualExternalSideEffectAllowedInThisStep !== false ||
    input.sourceActualSchemaMigrationAllowedInThisStep !== false ||
    input.sourceActualCursorGithubWireAllowedInThisStep !== false ||
    input.sourceActualConnectorRoutingChangeAllowedInThisStep !== false ||
    input.sourceContractCandidateCount < 7 ||
    !input.dryRunContractItemsValid
  ) {
    return "blocked";
  }

  if (!input.confirmationsSatisfied) {
    return "defer";
  }

  return "ready_for_runtime_execution_contract_closure";
}

export function buildRuntimeExecutionDryRunContractFingerprint(input: {
  readonly sourceContractCandidateFingerprint: string;
  readonly dryRunContractItemCount: number;
  readonly dryRunScenarioCount: number;
  readonly dryRunAssertionCount: number;
  readonly confirmationCount: number;
  readonly sourceContractCandidateOnly: boolean;
  readonly sourceContractCandidateValidationValid: boolean;
  readonly sourceForbiddenFieldDetected: boolean;
  readonly sourceActualRuntimeExecutionAllowedInThisStep: boolean;
  readonly sourceActualExecutionWireAllowedInThisStep: boolean;
  readonly sourceActualPersistenceAllowedInThisStep: boolean;
  readonly sourceNoRunBoundarySatisfied: boolean;
  readonly sourcePersistenceBoundarySatisfied: boolean;
  readonly sourceSchemaMigrationBoundarySatisfied: boolean;
}): string {
  return [
    "runtime-execution-dry-run-contract-v1",
    input.sourceContractCandidateFingerprint,
    `items:${input.dryRunContractItemCount}`,
    `scenarios:${input.dryRunScenarioCount}`,
    `assertions:${input.dryRunAssertionCount}`,
    `confirmations:${input.confirmationCount}`,
    `sourceCandidateOnly:${input.sourceContractCandidateOnly}`,
    `sourceValidation:${input.sourceContractCandidateValidationValid}`,
    `sourceForbidden:${input.sourceForbiddenFieldDetected}`,
    `actualRuntime:${input.sourceActualRuntimeExecutionAllowedInThisStep}`,
    `actualDryRunRunner:false`,
    `actualWire:${input.sourceActualExecutionWireAllowedInThisStep}`,
    `actualPersistence:${input.sourceActualPersistenceAllowedInThisStep}`,
    `noRun:${input.sourceNoRunBoundarySatisfied}`,
    `persistence:${input.sourcePersistenceBoundarySatisfied}`,
    `schema:${input.sourceSchemaMigrationBoundarySatisfied}`,
  ].join("::");
}

export function buildRuntimeExecutionDryRunContractSummary(
  decision: RuntimeExecutionDryRunContractDecision,
): string {
  if (decision === "blocked") {
    return "Stage 6-E runtime execution dry-run contract is blocked.";
  }
  if (decision === "defer") {
    return "Stage 6-E dry-run contract defers; contract candidate or confirmations are incomplete.";
  }
  return "Stage 6-E dry-run contracts are ready for contract closure design. This is not actual dry-run execution.";
}

/** Evaluate source Stage 6-D report for dry-run contract. */
export function evaluateRuntimeExecutionDryRunContractSource(
  input?: RuntimeExecutionDryRunContractInput,
): RuntimeExecutionContractCandidateReport {
  return evaluateRuntimeExecutionContractCandidate(input?.contractCandidate);
}
