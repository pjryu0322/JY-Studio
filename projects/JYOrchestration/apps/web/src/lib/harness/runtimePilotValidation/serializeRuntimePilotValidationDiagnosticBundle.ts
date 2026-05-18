/**
 * Pilot Validation Phase 0 — diagnostic serialization (no report rebuild).
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import { SERIALIZED_RUNTIME_PILOT_VALIDATION_ACTUAL_FLAGS } from "./runtimePilotValidationConstants";
import type { RuntimePilotValidationReadOnlyChainSummary } from "./runtimePilotValidationTypes";
import type {
  RuntimeSafeEchoAdapterContractSummary,
  RuntimeSafeEchoAdapterInputContract,
  RuntimeSafeEchoAdapterOutputContract,
  RuntimeSandboxDryRunBoundary,
} from "./runtimeSafeEchoAdapterContractTypes";
import { SERIALIZED_RUNTIME_SAFE_ECHO_ADAPTER_ACTUAL_FLAGS } from "./runtimeSafeEchoAdapterContractConstants";

function sortKo(rows: readonly string[]): readonly string[] {
  return [...rows].sort((a, b) => a.localeCompare(b, "ko"));
}

function serializeSummary(s: RuntimePilotValidationReadOnlyChainSummary): Readonly<Record<string, unknown>> {
  return {
    mode: s.mode,
    ...SERIALIZED_RUNTIME_PILOT_VALIDATION_ACTUAL_FLAGS,
    validationStatus: s.validationStatus,
    finalGateStatus: s.finalGateStatus,
    pilotValidationEntryReadiness: s.pilotValidationEntryReadiness,
    topBlockers: sortKo(s.topBlockers),
    topWarnings: sortKo(s.topWarnings),
    finalProofSummary: sortKo(s.finalProofSummary),
    userVisibleSummaryKo: s.userVisibleSummaryKo,
    operatorVisibleSummaryKo: s.operatorVisibleSummaryKo,
    recommendations: sortKo(s.recommendations),
  };
}

function serializeSafeEchoSummary(s: RuntimeSafeEchoAdapterContractSummary): Readonly<Record<string, unknown>> {
  return {
    mode: s.mode,
    ...SERIALIZED_RUNTIME_SAFE_ECHO_ADAPTER_ACTUAL_FLAGS,
    contractStatus: s.contractStatus,
    adapterMode: s.adapterMode,
    rationaleKo: s.rationaleKo,
    blockers: sortKo(s.blockers),
    warnings: sortKo(s.warnings),
    recommendations: sortKo(s.recommendations),
  };
}

function serializeInputContract(c: RuntimeSafeEchoAdapterInputContract): Readonly<Record<string, unknown>> {
  return {
    mode: c.mode,
    ...SERIALIZED_RUNTIME_SAFE_ECHO_ADAPTER_ACTUAL_FLAGS,
    requiredInputs: sortKo(c.requiredInputs),
    acceptedInputMetadata: sortKo(c.acceptedInputMetadata),
    prohibitedInputPayloads: sortKo(c.prohibitedInputPayloads),
    validationRules: sortKo(c.validationRules),
  };
}

function serializeOutputContract(c: RuntimeSafeEchoAdapterOutputContract): Readonly<Record<string, unknown>> {
  return {
    mode: c.mode,
    ...SERIALIZED_RUNTIME_SAFE_ECHO_ADAPTER_ACTUAL_FLAGS,
    expectedOutputs: sortKo(c.expectedOutputs),
    prohibitedOutputs: sortKo(c.prohibitedOutputs),
    auditMetadataRows: sortKo(c.auditMetadataRows),
  };
}

function serializeSandboxBoundary(b: RuntimeSandboxDryRunBoundary): Readonly<Record<string, unknown>> {
  return {
    mode: b.mode,
    ...SERIALIZED_RUNTIME_SAFE_ECHO_ADAPTER_ACTUAL_FLAGS,
    boundarySourceLayer: b.boundarySourceLayer,
    boundaryTargetLayer: b.boundaryTargetLayer,
    allowedBoundaryScopes: sortKo(b.allowedBoundaryScopes),
    forbiddenBoundaryOperations: sortKo(b.forbiddenBoundaryOperations),
    operatorApprovalRequiredBeforeInvocation: b.operatorApprovalRequiredBeforeInvocation,
    auditTraceRequired: b.auditTraceRequired,
    rollbackPlanRequired: b.rollbackPlanRequired,
  };
}

export function serializeRuntimePilotValidationDiagnosticBundleFromSemanticReports(
  reports: RuntimeSemanticPlanningReports
): Readonly<Record<string, unknown>> {
  return {
    runtimePilotValidationReadOnlyChainSummary: serializeSummary(
      reports.runtimePilotValidationReadOnlyChainSummary
    ),
    runtimeSafeEchoAdapterContractSummary: serializeSafeEchoSummary(
      reports.runtimeSafeEchoAdapterContractSummary
    ),
    runtimeSafeEchoAdapterInputContract: serializeInputContract(reports.runtimeSafeEchoAdapterInputContract),
    runtimeSafeEchoAdapterOutputContract: serializeOutputContract(reports.runtimeSafeEchoAdapterOutputContract),
    runtimeSandboxDryRunBoundary: serializeSandboxBoundary(reports.runtimeSandboxDryRunBoundary),
  };
}
