/**
 * Stage 7-B runtime API contract design decision (read-only).
 */

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
    input.sourceActualDryRunRunnerAllowedInThisStep !== false ||
    input.sourceActualExecutionWireAllowedInThisStep !== false ||
    input.sourceActualPersistenceAllowedInThisStep !== false ||
    input.sourceActualExternalSideEffectAllowedInThisStep !== false ||
    input.sourceActualSchemaMigrationAllowedInThisStep !== false ||
    input.sourceActualCursorGithubWireAllowedInThisStep !== false ||
    input.sourceActualConnectorRoutingChangeAllowedInThisStep !== false ||
    input.sourceActualUiImplementationAllowedInThisStep !== false ||
    !input.endpointContractsValid
  ) {
    return "blocked";
  }

  if (!input.confirmationsSatisfied) {
    return "defer";
  }

  return "ready_for_execution_runner_contract_design";
}
