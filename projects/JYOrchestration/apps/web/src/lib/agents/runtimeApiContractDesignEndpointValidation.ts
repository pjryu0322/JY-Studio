/**
 * Stage 7-B runtime API endpoint contract validation (read-only).
 */

import { STAGE7_B_REQUIRED_ENDPOINT_CONTRACT_IDS } from "@/lib/agents/runtimeApiContractDesignConstants";
import type {
  RuntimeApiEndpointContract,
  RuntimeApiEndpointContractValidationResult,
} from "@/lib/agents/runtimeApiContractDesignTypes";

const VALID_METHODS = new Set(["POST", "GET", "PATCH"]);
const RUNTIME_API_PATH_PREFIX = "/api/runtime/";
const INSUFFICIENT_STATUS_TRANSITION_ENDPOINT_IDS = new Set([
  "create-runtime-execution-request",
  "submit-runtime-execution-approval",
  "request-runtime-execution-rollback",
]);

function hasSecurityErrorCode(errorCodes: readonly string[]): boolean {
  return errorCodes.some((code) => code.includes("UNAUTHORIZED") || code.includes("FORBIDDEN"));
}

function hasApprovalErrorCode(errorCodes: readonly string[]): boolean {
  return errorCodes.some((code) => code.includes("APPROVAL"));
}

function emptyInvalidValidation(): RuntimeApiEndpointContractValidationResult {
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
    invalidMethodEndpointIds: [],
    missingStatusTransitionEndpointIds: [],
    insufficientStatusTransitionEndpointIds: [],
    unsafePathPatternEndpointIds: [],
    nonRuntimeApiPathEndpointIds: [],
    missingSecurityErrorEndpointIds: [],
    missingApprovalErrorEndpointIds: [],
    missingAuditCorrelationEndpointIds: [],
  };
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
  invalidMethodEndpointIds: [],
  missingStatusTransitionEndpointIds: [],
  insufficientStatusTransitionEndpointIds: [],
  unsafePathPatternEndpointIds: [],
  nonRuntimeApiPathEndpointIds: [],
  missingSecurityErrorEndpointIds: [],
  missingApprovalErrorEndpointIds: [],
  missingAuditCorrelationEndpointIds: [],
};

export function validateRuntimeApiEndpointContracts(
  endpoints: readonly RuntimeApiEndpointContract[],
): RuntimeApiEndpointContractValidationResult {
  if (endpoints.length === 0) {
    return emptyInvalidValidation();
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
  const invalidMethodEndpointIds: string[] = [];
  const missingStatusTransitionEndpointIds: string[] = [];
  const insufficientStatusTransitionEndpointIds: string[] = [];
  const unsafePathPatternEndpointIds: string[] = [];
  const nonRuntimeApiPathEndpointIds: string[] = [];
  const missingSecurityErrorEndpointIds: string[] = [];
  const missingApprovalErrorEndpointIds: string[] = [];
  const missingAuditCorrelationEndpointIds: string[] = [];

  const seen = new Set<string>();
  for (const endpoint of endpoints) {
    if (seen.has(endpoint.endpointId)) {
      duplicateEndpointContractIds.push(endpoint.endpointId);
    } else {
      seen.add(endpoint.endpointId);
    }

    if (!VALID_METHODS.has(endpoint.method)) {
      invalidMethodEndpointIds.push(endpoint.endpointId);
    }

    if (endpoint.statusTransitions.length < 1) {
      missingStatusTransitionEndpointIds.push(endpoint.endpointId);
    }
    if (
      INSUFFICIENT_STATUS_TRANSITION_ENDPOINT_IDS.has(endpoint.endpointId) &&
      endpoint.statusTransitions.length < 2
    ) {
      insufficientStatusTransitionEndpointIds.push(endpoint.endpointId);
    }

    const path = endpoint.pathPattern;
    if (!path.startsWith(RUNTIME_API_PATH_PREFIX)) {
      nonRuntimeApiPathEndpointIds.push(endpoint.endpointId);
    }
    if (!path.startsWith("/api/runtime/executions") || path.includes(" ") || path.includes("..")) {
      unsafePathPatternEndpointIds.push(endpoint.endpointId);
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
    if (!hasSecurityErrorCode(endpoint.errorCodes)) {
      missingSecurityErrorEndpointIds.push(endpoint.endpointId);
    }
    if (endpoint.requiredApprovals.length > 0 && !hasApprovalErrorCode(endpoint.errorCodes)) {
      missingApprovalErrorEndpointIds.push(endpoint.endpointId);
    }
    if (endpoint.auditEvents.length < 1) {
      missingAuditEventEndpointIds.push(endpoint.endpointId);
    }
    if (
      endpoint.auditEvents.length > 0 &&
      (endpoint.endpointId.trim().length === 0 ||
        endpoint.requestContract.trim().length === 0 ||
        endpoint.responseContract.trim().length === 0)
    ) {
      missingAuditCorrelationEndpointIds.push(endpoint.endpointId);
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
    implementedInThisStepEndpointIds.length === 0 &&
    invalidMethodEndpointIds.length === 0 &&
    missingStatusTransitionEndpointIds.length === 0 &&
    insufficientStatusTransitionEndpointIds.length === 0 &&
    unsafePathPatternEndpointIds.length === 0 &&
    nonRuntimeApiPathEndpointIds.length === 0 &&
    missingSecurityErrorEndpointIds.length === 0 &&
    missingApprovalErrorEndpointIds.length === 0 &&
    missingAuditCorrelationEndpointIds.length === 0;

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
    invalidMethodEndpointIds,
    missingStatusTransitionEndpointIds,
    insufficientStatusTransitionEndpointIds,
    unsafePathPatternEndpointIds,
    nonRuntimeApiPathEndpointIds,
    missingSecurityErrorEndpointIds,
    missingApprovalErrorEndpointIds,
    missingAuditCorrelationEndpointIds,
  };
}
