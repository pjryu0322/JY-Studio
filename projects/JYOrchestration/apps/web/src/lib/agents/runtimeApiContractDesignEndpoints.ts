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
    source.sourceActualDryRunRunnerAllowedInThisStep === false &&
    source.sourceActualExecutionWireAllowedInThisStep === false &&
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
  readonly approvalCount: number;
  readonly endpointDesignOnlyCount: number;
  readonly implementedEndpointCount: number;
  readonly postEndpointCount: number;
  readonly getEndpointCount: number;
  readonly patchEndpointCount: number;
} {
  return {
    statusTransitionCount: endpoints.reduce((sum, endpoint) => sum + endpoint.statusTransitions.length, 0),
    errorCodeCount: endpoints.reduce((sum, endpoint) => sum + endpoint.errorCodes.length, 0),
    auditEventCount: endpoints.reduce((sum, endpoint) => sum + endpoint.auditEvents.length, 0),
    approvalCount: endpoints.reduce((sum, endpoint) => sum + endpoint.requiredApprovals.length, 0),
    endpointDesignOnlyCount: endpoints.filter((endpoint) => endpoint.endpointDesignOnly === true).length,
    implementedEndpointCount: endpoints.filter((endpoint) => endpoint.implementedInThisStep !== false).length,
    postEndpointCount: endpoints.filter((endpoint) => endpoint.method === "POST").length,
    getEndpointCount: endpoints.filter((endpoint) => endpoint.method === "GET").length,
    patchEndpointCount: endpoints.filter((endpoint) => endpoint.method === "PATCH").length,
  };
}
