/**
 * Stage 7-B runtime API endpoint contract builders (read-only).
 */

import type { RuntimeImplementationPlanningCandidateReport } from "@/lib/agents/runtimeImplementationPlanningCandidateTypes";
import {
  STAGE7_B_ENDPOINT_SPECS,
  STAGE7_B_REQUIRED_ENDPOINT_CONTRACT_IDS,
} from "@/lib/agents/runtimeApiContractDesignConstants";
import type { RuntimeApiEndpointContract } from "@/lib/agents/runtimeApiContractDesignTypes";

export { validateRuntimeApiEndpointContracts } from "@/lib/agents/runtimeApiContractDesignEndpointValidation";

function sourceReadyForEndpointContracts(source: RuntimeImplementationPlanningCandidateReport): boolean {
  return (
    source.decision === "ready_for_runtime_implementation_pr_planning" &&
    source.planningCandidateOnly === true &&
    source.planningItemCount >= 10 &&
    source.sourceActualRuntimeExecutionAllowedInThisStep === false &&
    source.sourceActualExecutionRunnerAllowedInThisStep === false &&
    source.sourceActualPersistenceAllowedInThisStep === false &&
    source.sourceActualSchemaMigrationAllowedInThisStep === false &&
    source.sourceActualCursorGithubWireAllowedInThisStep === false &&
    source.sourceActualConnectorRoutingChangeAllowedInThisStep === false
  );
}

export function buildRuntimeApiEndpointContracts(
  source: RuntimeImplementationPlanningCandidateReport,
): readonly RuntimeApiEndpointContract[] {
  if (!sourceReadyForEndpointContracts(source)) {
    return [];
  }

  return STAGE7_B_REQUIRED_ENDPOINT_CONTRACT_IDS.map((endpointId) => {
    const spec = STAGE7_B_ENDPOINT_SPECS[endpointId];
    return {
      endpointId,
      method: spec.method,
      pathPattern: spec.pathPattern,
      purpose: spec.purpose,
      requestContract: spec.requestContract,
      responseContract: spec.responseContract,
      statusTransitions: [...spec.statusTransitions],
      requiredApprovals: [...spec.requiredApprovals],
      errorCodes: [...spec.errorCodes],
      auditEvents: [...spec.auditEvents],
      endpointDesignOnly: true as const,
      implementedInThisStep: false as const,
    };
  });
}

export function computeRuntimeApiContractTrace(endpoints: readonly RuntimeApiEndpointContract[]): {
  readonly statusTransitionCount: number;
  readonly errorCodeCount: number;
  readonly auditEventCount: number;
} {
  return {
    statusTransitionCount: endpoints.reduce((sum, endpoint) => sum + endpoint.statusTransitions.length, 0),
    errorCodeCount: endpoints.reduce((sum, endpoint) => sum + endpoint.errorCodes.length, 0),
    auditEventCount: endpoints.reduce((sum, endpoint) => sum + endpoint.auditEvents.length, 0),
  };
}
