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
import type {
  RuntimePilotValidationAuditTraceCandidate,
  RuntimePilotValidationOperatorApprovalSnapshot,
  RuntimePilotValidationRequestDraft,
  RuntimePilotValidationRollbackPlanCandidate,
} from "./runtimePilotValidationRequestDraftTypes";
import type {
  RuntimeSafeEchoInvocationSimulatorBoundary,
  RuntimeSafeEchoInvocationSimulatorInput,
  RuntimeSafeEchoInvocationSimulatorOutput,
  RuntimeSafeEchoInvocationSimulatorSummary,
} from "./runtimeSafeEchoInvocationSimulatorTypes";

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

function serializeRequestDraft(d: RuntimePilotValidationRequestDraft): Readonly<Record<string, unknown>> {
  return {
    mode: d.mode,
    ...SERIALIZED_RUNTIME_SAFE_ECHO_ADAPTER_ACTUAL_FLAGS,
    draftStatus: d.draftStatus,
    draftMode: d.draftMode,
    validationRequestIdCandidate: d.validationRequestIdCandidate,
    requestedValidationMode: d.requestedValidationMode,
    projectIdRequired: d.projectIdRequired,
    taskIdOptional: d.taskIdOptional,
    userApprovalRequired: d.userApprovalRequired,
    operatorApprovalRequired: d.operatorApprovalRequired,
    auditTraceRequired: d.auditTraceRequired,
    rollbackPlanRequired: d.rollbackPlanRequired,
    sourceSummaryRows: sortKo(d.sourceSummaryRows),
    prohibitedOperationRows: sortKo(d.prohibitedOperationRows),
    blockers: sortKo(d.blockers),
    warnings: sortKo(d.warnings),
    recommendations: sortKo(d.recommendations),
  };
}

function serializeOperatorApprovalSnapshot(
  s: RuntimePilotValidationOperatorApprovalSnapshot
): Readonly<Record<string, unknown>> {
  return {
    mode: s.mode,
    actualApprovalEnforcementEnabled: s.actualApprovalEnforcementEnabled,
    actualExecutionBlockingEnabled: s.actualExecutionBlockingEnabled,
    actualMergeBlockingEnabled: s.actualMergeBlockingEnabled,
    approvalSnapshotStatus: s.approvalSnapshotStatus,
    approvalSourceLayer: s.approvalSourceLayer,
    approvalRequiredBeforeAnyInvocation: s.approvalRequiredBeforeAnyInvocation,
    approvalDoesNotTriggerExecution: s.approvalDoesNotTriggerExecution,
    approvalRows: sortKo(s.approvalRows),
    missingApprovalRows: sortKo(s.missingApprovalRows),
    recommendations: sortKo(s.recommendations),
  };
}

function serializeAuditTraceCandidate(
  c: RuntimePilotValidationAuditTraceCandidate
): Readonly<Record<string, unknown>> {
  return {
    mode: c.mode,
    actualExecutionEnabled: c.actualExecutionEnabled,
    actualAdapterInvocationEnabled: c.actualAdapterInvocationEnabled,
    auditTraceStatus: c.auditTraceStatus,
    auditTraceIdCandidate: c.auditTraceIdCandidate,
    traceSourceLayers: sortKo(c.traceSourceLayers),
    traceRows: sortKo(c.traceRows),
    missingTraceRows: sortKo(c.missingTraceRows),
    recommendations: sortKo(c.recommendations),
  };
}

function serializeRollbackPlanCandidate(
  c: RuntimePilotValidationRollbackPlanCandidate
): Readonly<Record<string, unknown>> {
  return {
    mode: c.mode,
    actualRollbackExecutionEnabled: c.actualRollbackExecutionEnabled,
    actualExecutionEnabled: c.actualExecutionEnabled,
    rollbackPlanStatus: c.rollbackPlanStatus,
    rollbackPlanCandidateId: c.rollbackPlanCandidateId,
    rollbackScope: c.rollbackScope,
    rollbackDoesNotExecute: c.rollbackDoesNotExecute,
    rollbackRows: sortKo(c.rollbackRows),
    missingRollbackRows: sortKo(c.missingRollbackRows),
    recommendations: sortKo(c.recommendations),
  };
}

function serializeSimulatorSummary(s: RuntimeSafeEchoInvocationSimulatorSummary): Readonly<Record<string, unknown>> {
  return {
    mode: s.mode,
    ...SERIALIZED_RUNTIME_SAFE_ECHO_ADAPTER_ACTUAL_FLAGS,
    simulatorStatus: s.simulatorStatus,
    simulatorMode: s.simulatorMode,
    rationaleKo: s.rationaleKo,
    blockers: sortKo(s.blockers),
    warnings: sortKo(s.warnings),
    recommendations: sortKo(s.recommendations),
  };
}

function serializeSimulatorInput(i: RuntimeSafeEchoInvocationSimulatorInput): Readonly<Record<string, unknown>> {
  return {
    mode: i.mode,
    ...SERIALIZED_RUNTIME_SAFE_ECHO_ADAPTER_ACTUAL_FLAGS,
    sourceRequestDraftIdCandidate: i.sourceRequestDraftIdCandidate,
    acceptedInputRows: sortKo(i.acceptedInputRows),
    rejectedInputRows: sortKo(i.rejectedInputRows),
    requiredApprovalRows: sortKo(i.requiredApprovalRows),
    requiredAuditRows: sortKo(i.requiredAuditRows),
    requiredRollbackRows: sortKo(i.requiredRollbackRows),
  };
}

function serializeSimulatorOutput(o: RuntimeSafeEchoInvocationSimulatorOutput): Readonly<Record<string, unknown>> {
  return {
    mode: o.mode,
    ...SERIALIZED_RUNTIME_SAFE_ECHO_ADAPTER_ACTUAL_FLAGS,
    expectedSimulationOutputs: sortKo(o.expectedSimulationOutputs),
    prohibitedSimulationOutputs: sortKo(o.prohibitedSimulationOutputs),
    auditEchoRows: sortKo(o.auditEchoRows),
    rollbackEchoRows: sortKo(o.rollbackEchoRows),
  };
}

function serializeSimulatorBoundary(b: RuntimeSafeEchoInvocationSimulatorBoundary): Readonly<Record<string, unknown>> {
  return {
    mode: b.mode,
    ...SERIALIZED_RUNTIME_SAFE_ECHO_ADAPTER_ACTUAL_FLAGS,
    boundarySourceLayer: b.boundarySourceLayer,
    boundaryTargetLayer: b.boundaryTargetLayer,
    allowedSimulatorScopes: sortKo(b.allowedSimulatorScopes),
    forbiddenSimulatorOperations: sortKo(b.forbiddenSimulatorOperations),
    simulationDoesNotInvokeAdapter: b.simulationDoesNotInvokeAdapter,
    simulationDoesNotInvokeSandbox: b.simulationDoesNotInvokeSandbox,
    simulationDoesNotInvokeRunner: b.simulationDoesNotInvokeRunner,
    simulationDoesNotModifySource: b.simulationDoesNotModifySource,
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
    runtimePilotValidationRequestDraft: serializeRequestDraft(reports.runtimePilotValidationRequestDraft),
    runtimePilotValidationOperatorApprovalSnapshot: serializeOperatorApprovalSnapshot(
      reports.runtimePilotValidationOperatorApprovalSnapshot
    ),
    runtimePilotValidationAuditTraceCandidate: serializeAuditTraceCandidate(
      reports.runtimePilotValidationAuditTraceCandidate
    ),
    runtimePilotValidationRollbackPlanCandidate: serializeRollbackPlanCandidate(
      reports.runtimePilotValidationRollbackPlanCandidate
    ),
    runtimeSafeEchoInvocationSimulatorSummary: serializeSimulatorSummary(
      reports.runtimeSafeEchoInvocationSimulatorSummary
    ),
    runtimeSafeEchoInvocationSimulatorInput: serializeSimulatorInput(
      reports.runtimeSafeEchoInvocationSimulatorInput
    ),
    runtimeSafeEchoInvocationSimulatorOutput: serializeSimulatorOutput(
      reports.runtimeSafeEchoInvocationSimulatorOutput
    ),
    runtimeSafeEchoInvocationSimulatorBoundary: serializeSimulatorBoundary(
      reports.runtimeSafeEchoInvocationSimulatorBoundary
    ),
  };
}
