/**
 * H25 — no-op adapter 진단 **직렬화 전용**(report 재빌드 없음).
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type {
  RuntimeAdapterInvocationGuardReport,
  RuntimeNoopAdapterBoundaryViolationReport,
  RuntimeNoopAdapterResultMetadata,
  RuntimeNoopAdapterSkeleton,
  RuntimeNoopAdapterSummary,
  RuntimePilotContractVerificationReport,
} from "./runtimeNoopAdapterTypes";

function sortKo(rows: readonly string[]): readonly string[] {
  return [...rows].sort((a, b) => a.localeCompare(b, "ko"));
}

function serializeSummary(s: RuntimeNoopAdapterSummary): Readonly<Record<string, unknown>> {
  return {
    mode: s.mode,
    actualRuntimeOrchestrationEnabled: s.actualRuntimeOrchestrationEnabled,
    actualRuntimeAdapterInvocationEnabled: s.actualRuntimeAdapterInvocationEnabled,
    actualExecutionEnabled: s.actualExecutionEnabled,
    actualProviderRoutingEnabled: s.actualProviderRoutingEnabled,
    actualQueueControlEnabled: s.actualQueueControlEnabled,
    actualRollbackExecutionEnabled: s.actualRollbackExecutionEnabled,
    noopAdapterStatus: s.noopAdapterStatus,
    invocationGuard: s.invocationGuard,
    rationaleKo: s.rationaleKo,
    contractVerificationStatus: s.contractVerificationStatus,
    noopResultMetadata: sortKo(s.noopResultMetadata),
    recommendations: sortKo(s.recommendations),
  };
}

function serializeSkeleton(sk: RuntimeNoopAdapterSkeleton): Readonly<Record<string, unknown>> {
  return {
    mode: sk.mode,
    actualRuntimeOrchestrationEnabled: sk.actualRuntimeOrchestrationEnabled,
    actualRuntimeAdapterInvocationEnabled: sk.actualRuntimeAdapterInvocationEnabled,
    adapterName: sk.adapterName,
    adapterMode: sk.adapterMode,
    acceptedContractInputs: sortKo(sk.acceptedContractInputs),
    expectedNoopOutputs: sortKo(sk.expectedNoopOutputs),
    forbiddenOperations: sortKo(sk.forbiddenOperations),
    noOpGuarantees: sortKo(sk.noOpGuarantees),
  };
}

function serializeVerification(v: RuntimePilotContractVerificationReport): Readonly<Record<string, unknown>> {
  return {
    mode: v.mode,
    actualRuntimeOrchestrationEnabled: v.actualRuntimeOrchestrationEnabled,
    actualRuntimeAdapterInvocationEnabled: v.actualRuntimeAdapterInvocationEnabled,
    verificationStatus: v.verificationStatus,
    missingRequiredInputs: sortKo(v.missingRequiredInputs),
    outputContractAligned: v.outputContractAligned,
    boundaryAligned: v.boundaryAligned,
    handoffAligned: v.handoffAligned,
    forbiddenOperationAligned: v.forbiddenOperationAligned,
    findings: sortKo(v.findings),
    recommendations: sortKo(v.recommendations),
  };
}

function serializeResult(r: RuntimeNoopAdapterResultMetadata): Readonly<Record<string, unknown>> {
  return {
    mode: r.mode,
    actualRuntimeOrchestrationEnabled: r.actualRuntimeOrchestrationEnabled,
    actualRuntimeAdapterInvocationEnabled: r.actualRuntimeAdapterInvocationEnabled,
    actualExecutionEnabled: r.actualExecutionEnabled,
    actualProviderRoutingEnabled: r.actualProviderRoutingEnabled,
    actualQueueControlEnabled: r.actualQueueControlEnabled,
    actualRollbackExecutionEnabled: r.actualRollbackExecutionEnabled,
    noopAccepted: r.noopAccepted,
    adapterInvoked: r.adapterInvoked,
    executionPerformed: r.executionPerformed,
    providerRoutingPerformed: r.providerRoutingPerformed,
    queueControlPerformed: r.queueControlPerformed,
    rollbackPerformed: r.rollbackPerformed,
    diagnosticOnly: r.diagnosticOnly,
    resultRows: sortKo(r.resultRows),
  };
}

function serializeGuard(g: RuntimeAdapterInvocationGuardReport): Readonly<Record<string, unknown>> {
  return {
    mode: g.mode,
    actualRuntimeOrchestrationEnabled: g.actualRuntimeOrchestrationEnabled,
    actualRuntimeAdapterInvocationEnabled: g.actualRuntimeAdapterInvocationEnabled,
    invocationGuard: g.invocationGuard,
    rationaleKo: g.rationaleKo,
    blockedReasons: sortKo(g.blockedReasons),
    recommendations: sortKo(g.recommendations),
  };
}

function serializeViolations(v: RuntimeNoopAdapterBoundaryViolationReport): Readonly<Record<string, unknown>> {
  return {
    mode: v.mode,
    actualRuntimeOrchestrationEnabled: v.actualRuntimeOrchestrationEnabled,
    actualRuntimeAdapterInvocationEnabled: v.actualRuntimeAdapterInvocationEnabled,
    actualFlagViolations: sortKo(v.actualFlagViolations),
    wordingRiskFindings: sortKo(v.wordingRiskFindings),
    recommendations: sortKo(v.recommendations),
  };
}

export function serializeRuntimeNoopAdapterDiagnosticBundleFromSemanticReports(
  reports: RuntimeSemanticPlanningReports
): Readonly<{
  runtimeNoopAdapterSummary: ReturnType<typeof serializeSummary>;
  runtimeNoopAdapterSkeleton: ReturnType<typeof serializeSkeleton>;
  runtimePilotContractVerificationReport: ReturnType<typeof serializeVerification>;
  runtimeNoopAdapterResultMetadata: ReturnType<typeof serializeResult>;
  runtimeAdapterInvocationGuardReport: ReturnType<typeof serializeGuard>;
  runtimeNoopAdapterBoundaryViolationReport: ReturnType<typeof serializeViolations>;
}> {
  return {
    runtimeNoopAdapterSummary: serializeSummary(reports.runtimeNoopAdapterSummary),
    runtimeNoopAdapterSkeleton: serializeSkeleton(reports.runtimeNoopAdapterSkeleton),
    runtimePilotContractVerificationReport: serializeVerification(reports.runtimePilotContractVerificationReport),
    runtimeNoopAdapterResultMetadata: serializeResult(reports.runtimeNoopAdapterResultMetadata),
    runtimeAdapterInvocationGuardReport: serializeGuard(reports.runtimeAdapterInvocationGuardReport),
    runtimeNoopAdapterBoundaryViolationReport: serializeViolations(reports.runtimeNoopAdapterBoundaryViolationReport),
  };
}
