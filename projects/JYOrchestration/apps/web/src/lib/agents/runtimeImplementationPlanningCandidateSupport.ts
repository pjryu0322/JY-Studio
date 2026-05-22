/**
 * Stage 7-A runtime implementation planning candidate support (read-only).
 */

import { evaluateRuntimeExecutionContractClosure } from "@/lib/agents/evaluateRuntimeExecutionContractClosure";
import type { RuntimeExecutionContractClosureReport } from "@/lib/agents/runtimeExecutionContractClosureTypes";
import { buildRuntimeImplementationPlanningCandidateChecklists } from "@/lib/agents/runtimeImplementationPlanningCandidateChecklists";
import { appendRuntimeImplementationPlanningCandidateFindings } from "@/lib/agents/runtimeImplementationPlanningCandidateFindings";
import {
  buildRuntimeImplementationPlanningItems,
  validateRuntimeImplementationPlanningItems,
} from "@/lib/agents/runtimeImplementationPlanningCandidateItems";

export {
  buildRuntimeImplementationPlanningItems,
  validateRuntimeImplementationPlanningItems,
} from "@/lib/agents/runtimeImplementationPlanningCandidateItems";

export { buildRuntimeImplementationPlanningCandidateChecklists } from "@/lib/agents/runtimeImplementationPlanningCandidateChecklists";
export { appendRuntimeImplementationPlanningCandidateFindings } from "@/lib/agents/runtimeImplementationPlanningCandidateFindings";

export {
  REQUIRED_STAGE7_A_IMPLEMENTATION_PLANNING_CONFIRMATIONS,
  RUNTIME_IMPLEMENTATION_PLANNING_CANDIDATE_TITLE,
  RUNTIME_IMPLEMENTATION_PLANNING_CANDIDATE_VERSION,
  STAGE7_A_RECOMMENDED_NEXT_PHASES,
  STAGE7_A_SEPARATED_WORK_ITEMS,
} from "@/lib/agents/runtimeImplementationPlanningCandidateConstants";

import type {
  ParsedRuntimeImplementationPlanningCandidateInput,
  RuntimeImplementationPlanningCandidateDecision,
  RuntimeImplementationPlanningCandidateDecisionInput,
  RuntimeImplementationPlanningCandidateInput,
} from "@/lib/agents/runtimeImplementationPlanningCandidateTypes";

export function parseRuntimeImplementationPlanningCandidateInput(
  input?: RuntimeImplementationPlanningCandidateInput,
): ParsedRuntimeImplementationPlanningCandidateInput {
  const flags = [
    input?.runtimeImplementationPlanningReviewed === true,
    input?.runtimeImplementationSeparatePrConfirmed === true,
    input?.runtimeImplementationNoActualExecutionConfirmed === true,
    input?.runtimeImplementationRollbackPlanReviewed === true,
    input?.runtimeImplementationOperatorApprovalRequiredConfirmed === true,
  ];
  return {
    runtimeImplementationPlanningReviewed: flags[0],
    runtimeImplementationSeparatePrConfirmed: flags[1],
    runtimeImplementationNoActualExecutionConfirmed: flags[2],
    runtimeImplementationRollbackPlanReviewed: flags[3],
    runtimeImplementationOperatorApprovalRequiredConfirmed: flags[4],
    confirmationsSatisfied: flags.every(Boolean),
    confirmationCount: flags.filter(Boolean).length,
  };
}

export function resolveRuntimeImplementationPlanningCandidateDecision(
  input: RuntimeImplementationPlanningCandidateDecisionInput,
): RuntimeImplementationPlanningCandidateDecision {
  if (input.sourceContractClosureDecision === "blocked") {
    return "blocked";
  }

  if (input.sourceContractClosureDecision === "defer") {
    return "defer";
  }

  if (input.sourceContractClosureDecision !== "stage6_runtime_execution_contract_closed") {
    return "defer";
  }

  if (
    input.sourceStage6ContractClosed !== true ||
    input.sourceStage6ClosureOnly !== true ||
    input.sourceActualRuntimeExecutionAllowedAfterStage6 !== false ||
    input.sourceActualRuntimeExecutionAllowedInThisStep !== false ||
    input.sourceActualExecutionRunnerAllowedInThisStep !== false ||
    input.sourceActualDryRunRunnerAllowedInThisStep !== false ||
    input.sourceActualExecutionWireAllowedInThisStep !== false ||
    input.sourceActualPersistenceAllowedInThisStep !== false ||
    input.sourceActualExternalSideEffectAllowedInThisStep !== false ||
    input.sourceActualSchemaMigrationAllowedInThisStep !== false ||
    input.sourceActualCursorGithubWireAllowedInThisStep !== false ||
    input.sourceActualConnectorRoutingChangeAllowedInThisStep !== false ||
    !input.planningItemsValid
  ) {
    return "blocked";
  }

  if (!input.confirmationsSatisfied) {
    return "defer";
  }

  return "ready_for_runtime_implementation_pr_planning";
}

export function buildRuntimeImplementationPlanningCandidateFingerprint(input: {
  readonly sourceContractClosureFingerprint: string;
  readonly planningItemCount: number;
  readonly confirmationCount: number;
  readonly separatedPrCandidateCount: number;
  readonly sourceActualRuntimeExecutionAllowedInThisStep: boolean;
  readonly sourceActualExecutionRunnerAllowedInThisStep: boolean;
  readonly sourceActualDryRunRunnerAllowedInThisStep: boolean;
  readonly sourceActualExecutionWireAllowedInThisStep: boolean;
  readonly sourceActualPersistenceAllowedInThisStep: boolean;
  readonly sourceActualSchemaMigrationAllowedInThisStep: boolean;
  readonly sourceActualCursorGithubWireAllowedInThisStep: boolean;
  readonly sourceActualConnectorRoutingChangeAllowedInThisStep: boolean;
  readonly planningItemsValid: boolean;
}): string {
  return [
    "runtime-implementation-planning-candidate-v1",
    input.sourceContractClosureFingerprint,
    `planningItems:${input.planningItemCount}`,
    `confirmations:${input.confirmationCount}`,
    `separatePr:${input.separatedPrCandidateCount}`,
    `sourceActualRuntime:${input.sourceActualRuntimeExecutionAllowedInThisStep}`,
    `sourceActualRunner:${input.sourceActualExecutionRunnerAllowedInThisStep}`,
    `sourceActualDryRunRunner:${input.sourceActualDryRunRunnerAllowedInThisStep}`,
    `sourceActualWire:${input.sourceActualExecutionWireAllowedInThisStep}`,
    `sourceActualPersistence:${input.sourceActualPersistenceAllowedInThisStep}`,
    `sourceActualSchema:${input.sourceActualSchemaMigrationAllowedInThisStep}`,
    `sourceActualCursorGithub:${input.sourceActualCursorGithubWireAllowedInThisStep}`,
    `sourceActualConnectorRouting:${input.sourceActualConnectorRoutingChangeAllowedInThisStep}`,
    `planningValid:${input.planningItemsValid}`,
  ].join("::");
}

export function buildRuntimeImplementationPlanningCandidateSummary(
  decision: RuntimeImplementationPlanningCandidateDecision,
): string {
  if (decision === "blocked") {
    return "Stage 7-A runtime implementation planning candidate is blocked.";
  }
  if (decision === "defer") {
    return "Stage 7-A planning candidate defers; Stage 6-F closure or confirmations are incomplete.";
  }
  return "Stage 6 contract chain is closed; implementation PR candidates are ready for planning review. Actual runtime implementation remains disallowed.";
}

/** Evaluate source Stage 6-F report for implementation planning. */
export function evaluateRuntimeImplementationPlanningCandidateSource(
  input?: RuntimeImplementationPlanningCandidateInput,
): RuntimeExecutionContractClosureReport {
  return evaluateRuntimeExecutionContractClosure(input?.contractClosure);
}
