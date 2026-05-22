/**
 * Stage 7-B runtime API contract design support (read-only).
 */

import { evaluateRuntimeImplementationPlanningCandidate } from "@/lib/agents/evaluateRuntimeImplementationPlanningCandidate";
import type { RuntimeImplementationPlanningCandidateReport } from "@/lib/agents/runtimeImplementationPlanningCandidateTypes";
import { buildRuntimeApiContractDesignChecklists } from "@/lib/agents/runtimeApiContractDesignChecklists";
import {
  buildRuntimeApiEndpointContracts,
  computeRuntimeApiContractTrace,
} from "@/lib/agents/runtimeApiContractDesignEndpoints";
import { validateRuntimeApiEndpointContracts } from "@/lib/agents/runtimeApiContractDesignEndpointValidation";
import { appendRuntimeApiContractDesignFindings } from "@/lib/agents/runtimeApiContractDesignFindings";

export { buildRuntimeApiEndpointContracts, computeRuntimeApiContractTrace } from "@/lib/agents/runtimeApiContractDesignEndpoints";
export { validateRuntimeApiEndpointContracts } from "@/lib/agents/runtimeApiContractDesignEndpointValidation";

export { buildRuntimeApiContractDesignChecklists } from "@/lib/agents/runtimeApiContractDesignChecklists";
export { appendRuntimeApiContractDesignFindings } from "@/lib/agents/runtimeApiContractDesignFindings";

export {
  REQUIRED_STAGE7_B_RUNTIME_API_CONFIRMATIONS,
  RUNTIME_API_CONTRACT_DESIGN_TITLE,
  RUNTIME_API_CONTRACT_DESIGN_VERSION,
  STAGE7_B_RECOMMENDED_NEXT_PHASES,
  STAGE7_B_SEPARATED_WORK_ITEMS,
} from "@/lib/agents/runtimeApiContractDesignConstants";

import type {
  ParsedRuntimeApiContractDesignInput,
  RuntimeApiContractDesignDecision,
  RuntimeApiContractDesignDecisionInput,
  RuntimeApiContractDesignInput,
} from "@/lib/agents/runtimeApiContractDesignTypes";

export function parseRuntimeApiContractDesignInput(
  input?: RuntimeApiContractDesignInput,
): ParsedRuntimeApiContractDesignInput {
  const flags = [
    input?.runtimeApiContractReviewed === true,
    input?.runtimeApiNoEndpointImplementationConfirmed === true,
    input?.runtimeApiNoPersistenceConfirmed === true,
    input?.runtimeApiSecurityBoundaryReviewed === true,
    input?.runtimeApiApprovalBoundaryReviewed === true,
  ];
  return {
    runtimeApiContractReviewed: flags[0],
    runtimeApiNoEndpointImplementationConfirmed: flags[1],
    runtimeApiNoPersistenceConfirmed: flags[2],
    runtimeApiSecurityBoundaryReviewed: flags[3],
    runtimeApiApprovalBoundaryReviewed: flags[4],
    confirmationsSatisfied: flags.every(Boolean),
    confirmationCount: flags.filter(Boolean).length,
  };
}

export function resolveRuntimeApiContractDesignDecision(
  input: RuntimeApiContractDesignDecisionInput,
): RuntimeApiContractDesignDecision {
  if (input.sourcePlanningDecision === "blocked") {
    return "blocked";
  }

  if (input.sourcePlanningDecision === "defer") {
    return "defer";
  }

  if (input.sourcePlanningDecision !== "ready_for_runtime_implementation_pr_planning") {
    return "defer";
  }

  if (
    input.sourcePlanningCandidateOnly !== true ||
    input.sourcePlanningItemCount < 10 ||
    input.sourceActualRuntimeExecutionAllowedInThisStep !== false ||
    input.sourceActualExecutionRunnerAllowedInThisStep !== false ||
    input.sourceActualPersistenceAllowedInThisStep !== false ||
    input.sourceActualSchemaMigrationAllowedInThisStep !== false ||
    input.sourceActualCursorGithubWireAllowedInThisStep !== false ||
    input.sourceActualConnectorRoutingChangeAllowedInThisStep !== false ||
    !input.endpointContractsValid
  ) {
    return "blocked";
  }

  if (!input.confirmationsSatisfied) {
    return "defer";
  }

  return "ready_for_execution_runner_contract_design";
}

export function buildRuntimeApiContractDesignFingerprint(input: {
  readonly sourcePlanningFingerprint: string;
  readonly endpointContractCount: number;
  readonly statusTransitionCount: number;
  readonly errorCodeCount: number;
  readonly auditEventCount: number;
  readonly confirmationCount: number;
}): string {
  return [
    "runtime-api-contract-design-v1",
    input.sourcePlanningFingerprint,
    `endpoints:${input.endpointContractCount}`,
    `transitions:${input.statusTransitionCount}`,
    `errors:${input.errorCodeCount}`,
    `audits:${input.auditEventCount}`,
    `confirmations:${input.confirmationCount}`,
  ].join("::");
}

export function buildRuntimeApiContractDesignSummary(decision: RuntimeApiContractDesignDecision): string {
  if (decision === "blocked") {
    return "Stage 7-B runtime API contract design is blocked.";
  }
  if (decision === "defer") {
    return "Stage 7-B API contract design defers; planning candidate or confirmations are incomplete.";
  }
  return "Runtime API endpoint contracts are designed for review. Actual API routes and runtime execution remain disallowed.";
}

/** Evaluate source Stage 7-A report for API contract design. */
export function evaluateRuntimeApiContractDesignSource(
  input?: RuntimeApiContractDesignInput,
): RuntimeImplementationPlanningCandidateReport {
  return evaluateRuntimeImplementationPlanningCandidate(input?.implementationPlanning);
}
