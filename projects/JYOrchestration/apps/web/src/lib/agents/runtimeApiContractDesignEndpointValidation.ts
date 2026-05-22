/**
 * Stage 7-B runtime API endpoint contract validation (read-only).
 */

import { STAGE7_B_REQUIRED_ENDPOINT_CONTRACT_IDS } from "@/lib/agents/runtimeApiContractDesignConstants";
import type {
  RuntimeApiEndpointContract,
  RuntimeApiEndpointContractValidationResult,
} from "@/lib/agents/runtimeApiContractDesignTypes";

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
