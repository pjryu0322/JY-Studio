/**
 * Stage 7-B runtime API endpoint contract builders (read-only).
 */

import type { RuntimeImplementationPlanningCandidateReport } from "@/lib/agents/runtimeImplementationPlanningCandidateTypes";
import {
  STAGE7_B_ENDPOINT_SPECS,
  STAGE7_B_REQUIRED_ENDPOINT_CONTRACT_IDS,
} from "@/lib/agents/runtimeApiContractDesignConstants";
import type {
  RuntimeApiEndpointContract,
  RuntimeApiEndpointContractValidationResult,
} from "@/lib/agents/runtimeApiContractDesignTypes";

function sourceReadyForEndpointContracts(source: RuntimeImplementationPlanningCandidateReport): boolean {
  return (
    source.decision === "ready_for_runtime_implementation_pr_planning" &&
    source.planningCandidateOnly === true &&
    source.planningItemCount >= 10 &&
    source.actualRuntimeExecutionAllowedInThisStep === false &&
    source.actualExecutionRunnerAllowedInThisStep === false &&
    source.actualPersistenceAllowedInThisStep === false &&
    source.actualSchemaMigrationAllowedInThisStep === false &&
    source.actualCursorGithubWireAllowedInThisStep === false &&
    source.actualConnectorRoutingChangeAllowedInThisStep === false
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

const EMPTY_VALIDATION: RuntimeApiEndpointContractValidationResult = {
  valid: true,
  missingEndpointContractIds: [],
  duplicateEndpointContractIds: [],
  emptyPathEndpointIds: [],
  emptyRequestContractEndpointIds: [],
  emptyResponseContractEndpointIds: [],
  missingApprovalEndpointIds: [],
  insufficientErrorCodeEndpointIds: [],
  missingAuditEventEndpointIds: [],
  implementedInThisStepEndpointIds: [],
};

export function validateRuntimeApiEndpointContracts(
  endpoints: readonly RuntimeApiEndpointContract[],
): RuntimeApiEndpointContractValidationResult {
  if (endpoints.length === 0) {
    return {
      valid: false,
      missingEndpointContractIds: [...STAGE7_B_REQUIRED_ENDPOINT_CONTRACT_IDS],
      duplicateEndpointContractIds: [],
      emptyPathEndpointIds: [],
      emptyRequestContractEndpointIds: [],
      emptyResponseContractEndpointIds: [],
      missingApprovalEndpointIds: [],
      insufficientErrorCodeEndpointIds: [],
      missingAuditEventEndpointIds: [],
      implementedInThisStepEndpointIds: [],
    };
  }

  const missingEndpointContractIds: string[] = [];
  const duplicateEndpointContractIds: string[] = [];
  const emptyPathEndpointIds: string[] = [];
  const emptyRequestContractEndpointIds: string[] = [];
  const emptyResponseContractEndpointIds: string[] = [];
  const missingApprovalEndpointIds: string[] = [];
  const insufficientErrorCodeEndpointIds: string[] = [];
  const missingAuditEventEndpointIds: string[] = [];
  const implementedInThisStepEndpointIds: string[] = [];

  const seen = new Set<string>();
  for (const endpoint of endpoints) {
    if (seen.has(endpoint.endpointId)) {
      duplicateEndpointContractIds.push(endpoint.endpointId);
    } else {
      seen.add(endpoint.endpointId);
    }

    if (endpoint.pathPattern.trim().length === 0) {
      emptyPathEndpointIds.push(endpoint.endpointId);
    }
    if (endpoint.requestContract.trim().length === 0) {
      emptyRequestContractEndpointIds.push(endpoint.endpointId);
    }
    if (endpoint.responseContract.trim().length === 0) {
      emptyResponseContractEndpointIds.push(endpoint.endpointId);
    }
    if (endpoint.requiredApprovals.length < 1) {
      missingApprovalEndpointIds.push(endpoint.endpointId);
    }
    if (endpoint.errorCodes.length < 2) {
      insufficientErrorCodeEndpointIds.push(endpoint.endpointId);
    }
    if (endpoint.auditEvents.length < 1) {
      missingAuditEventEndpointIds.push(endpoint.endpointId);
    }
    if (endpoint.implementedInThisStep !== false) {
      implementedInThisStepEndpointIds.push(endpoint.endpointId);
    }
  }

  for (const requiredId of STAGE7_B_REQUIRED_ENDPOINT_CONTRACT_IDS) {
    if (!seen.has(requiredId)) {
      missingEndpointContractIds.push(requiredId);
    }
  }

  const valid =
    missingEndpointContractIds.length === 0 &&
    duplicateEndpointContractIds.length === 0 &&
    emptyPathEndpointIds.length === 0 &&
    emptyRequestContractEndpointIds.length === 0 &&
    emptyResponseContractEndpointIds.length === 0 &&
    missingApprovalEndpointIds.length === 0 &&
    insufficientErrorCodeEndpointIds.length === 0 &&
    missingAuditEventEndpointIds.length === 0 &&
    implementedInThisStepEndpointIds.length === 0;

  if (valid) {
    return EMPTY_VALIDATION;
  }

  return {
    valid: false,
    missingEndpointContractIds,
    duplicateEndpointContractIds,
    emptyPathEndpointIds,
    emptyRequestContractEndpointIds,
    emptyResponseContractEndpointIds,
    missingApprovalEndpointIds,
    insufficientErrorCodeEndpointIds,
    missingAuditEventEndpointIds,
    implementedInThisStepEndpointIds,
  };
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
