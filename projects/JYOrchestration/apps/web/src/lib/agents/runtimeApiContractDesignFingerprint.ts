/**
 * Stage 7-B runtime API contract design fingerprint and summary (read-only).
 */

import type { RuntimeApiContractDesignDecision } from "@/lib/agents/runtimeApiContractDesignTypes";

export function buildRuntimeApiContractDesignFingerprint(input: {
  readonly sourcePlanningFingerprint: string;
  readonly endpointContractCount: number;
  readonly statusTransitionCount: number;
  readonly errorCodeCount: number;
  readonly auditEventCount: number;
  readonly confirmationCount: number;
  readonly sourceActualDryRunRunnerAllowedInThisStep: boolean;
  readonly sourceActualExecutionWireAllowedInThisStep: boolean;
  readonly sourceActualExternalSideEffectAllowedInThisStep: boolean;
  readonly sourceActualUiImplementationAllowedInThisStep: boolean;
  readonly approvalCount: number;
  readonly endpointDesignOnlyCount: number;
  readonly implementedEndpointCount: number;
  readonly postEndpointCount: number;
  readonly getEndpointCount: number;
  readonly patchEndpointCount: number;
  readonly endpointContractsValid: boolean;
}): string {
  return [
    "runtime-api-contract-design-v1",
    input.sourcePlanningFingerprint,
    `endpoints:${input.endpointContractCount}`,
    `transitions:${input.statusTransitionCount}`,
    `errors:${input.errorCodeCount}`,
    `audits:${input.auditEventCount}`,
    `confirmations:${input.confirmationCount}`,
    `sourceActualDryRunRunner:${input.sourceActualDryRunRunnerAllowedInThisStep}`,
    `sourceActualExecutionWire:${input.sourceActualExecutionWireAllowedInThisStep}`,
    `sourceActualExternalSideEffect:${input.sourceActualExternalSideEffectAllowedInThisStep}`,
    `sourceActualUi:${input.sourceActualUiImplementationAllowedInThisStep}`,
    `approvalCount:${input.approvalCount}`,
    `endpointDesignOnlyCount:${input.endpointDesignOnlyCount}`,
    `implementedEndpointCount:${input.implementedEndpointCount}`,
    `methodCounts:post=${input.postEndpointCount},get=${input.getEndpointCount},patch=${input.patchEndpointCount}`,
    `endpointValid:${input.endpointContractsValid}`,
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
