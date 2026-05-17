/**
 * H35 — release-gate final preflight 진단 **직렬화 전용**(report 재빌드 없음).
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type {
  RuntimeReleaseGateExecutionReadinessBoundary,
  RuntimeReleaseGateInputEnvelope,
  RuntimeReleaseGateNoExecutionProof,
  RuntimeReleaseGateOperationForbiddenProof,
  RuntimeReleaseGateOutputEnvelope,
  RuntimeReleaseGatePreflightAlignmentReport,
  RuntimeReleaseGatePreflightBlockerReport,
  RuntimeReleaseGatePreflightBoundaryViolationReport,
  RuntimeReleaseGatePreflightChecklist,
  RuntimeReleaseGatePreflightFinalSafetyGate,
  RuntimeReleaseGatePreflightReadinessVerificationReport,
  RuntimeReleaseGatePreflightSummary,
} from "./runtimeReleaseGatePreflightTypes";

function sortKo(rows: readonly string[]): readonly string[] {
  return [...rows].sort((a, b) => a.localeCompare(b, "ko"));
}

const SERIALIZED_ACTUAL_FLAGS_DISABLED = {
  actualRuntimeOrchestrationEnabled: false,
  actualPilotExecutionEnabled: false,
  actualNoopShellExecutionEnabled: false,
  actualExecutionShellExecutionEnabled: false,
  actualReleaseEnforcementEnabled: false,
  actualRuntimeAdapterInvocationEnabled: false,
  actualExecutionEnabled: false,
  actualProviderRoutingEnabled: false,
  actualQueueControlEnabled: false,
  actualRollbackExecutionEnabled: false,
} as const;

function serializePreflightSummary(s: RuntimeReleaseGatePreflightSummary): Readonly<Record<string, unknown>> {
  return {
    mode: s.mode,
    ...SERIALIZED_ACTUAL_FLAGS_DISABLED,
    preflightReadiness: s.preflightReadiness,
    preflightMode: s.preflightMode,
    rationaleKo: s.rationaleKo,
    preflightBlockers: sortKo(s.preflightBlockers),
    recommendations: sortKo(s.recommendations),
  };
}

function serializeExecutionReadinessBoundary(
  b: RuntimeReleaseGateExecutionReadinessBoundary
): Readonly<Record<string, unknown>> {
  return {
    mode: b.mode,
    ...SERIALIZED_ACTUAL_FLAGS_DISABLED,
    boundarySourceLayer: b.boundarySourceLayer,
    boundaryTargetLayer: b.boundaryTargetLayer,
    allowedBoundaryScopes: sortKo(b.allowedBoundaryScopes),
    requiredBoundaryInputs: sortKo(b.requiredBoundaryInputs),
    expectedBoundaryOutputs: sortKo(b.expectedBoundaryOutputs),
    forbiddenBoundaryOperations: sortKo(b.forbiddenBoundaryOperations),
    recommendations: sortKo(b.recommendations),
  };
}

function serializeEnvelope(
  e: RuntimeReleaseGateInputEnvelope | RuntimeReleaseGateOutputEnvelope
): Readonly<Record<string, unknown>> {
  return {
    mode: e.mode,
    ...SERIALIZED_ACTUAL_FLAGS_DISABLED,
    envelopeRows: sortKo(e.envelopeRows),
    recommendations: sortKo(e.recommendations),
  };
}

function serializeNoExecutionProof(p: RuntimeReleaseGateNoExecutionProof): Readonly<Record<string, unknown>> {
  return {
    mode: p.mode,
    ...SERIALIZED_ACTUAL_FLAGS_DISABLED,
    releaseEnforced: p.releaseEnforced,
    noopShellExecuted: p.noopShellExecuted,
    executionShellExecuted: p.executionShellExecuted,
    runtimeAdapterInvoked: p.runtimeAdapterInvoked,
    executionPerformed: p.executionPerformed,
    providerRoutingPerformed: p.providerRoutingPerformed,
    queueControlPerformed: p.queueControlPerformed,
    rollbackPerformed: p.rollbackPerformed,
    promptMutated: p.promptMutated,
    tokenEnforced: p.tokenEnforced,
    contextPruned: p.contextPruned,
    mergeBlocked: p.mergeBlocked,
    diagnosticOnly: p.diagnosticOnly,
    proofRows: sortKo(p.proofRows),
    recommendations: sortKo(p.recommendations),
  };
}

function serializeOperationForbiddenProof(
  p: RuntimeReleaseGateOperationForbiddenProof
): Readonly<Record<string, unknown>> {
  return {
    mode: p.mode,
    ...SERIALIZED_ACTUAL_FLAGS_DISABLED,
    actualReleaseEnforcementForbidden: p.actualReleaseEnforcementForbidden,
    actualShellExecutionForbidden: p.actualShellExecutionForbidden,
    actualAdapterInvocationForbidden: p.actualAdapterInvocationForbidden,
    actualExecutionForbidden: p.actualExecutionForbidden,
    actualProviderRoutingForbidden: p.actualProviderRoutingForbidden,
    actualQueueControlForbidden: p.actualQueueControlForbidden,
    actualRollbackForbidden: p.actualRollbackForbidden,
    actualPromptMutationForbidden: p.actualPromptMutationForbidden,
    actualTokenEnforcementForbidden: p.actualTokenEnforcementForbidden,
    actualContextPruningForbidden: p.actualContextPruningForbidden,
    actualMergeBlockingForbidden: p.actualMergeBlockingForbidden,
    proofRows: sortKo(p.proofRows),
    recommendations: sortKo(p.recommendations),
  };
}

function serializeBlockerReport(b: RuntimeReleaseGatePreflightBlockerReport): Readonly<Record<string, unknown>> {
  return {
    mode: b.mode,
    actualRuntimeOrchestrationEnabled: b.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: b.actualPilotExecutionEnabled,
    actualNoopShellExecutionEnabled: b.actualNoopShellExecutionEnabled,
    actualExecutionShellExecutionEnabled: b.actualExecutionShellExecutionEnabled,
    actualReleaseEnforcementEnabled: b.actualReleaseEnforcementEnabled,
    actualRuntimeAdapterInvocationEnabled: b.actualRuntimeAdapterInvocationEnabled,
    actualExecutionEnabled: b.actualExecutionEnabled,
    actualProviderRoutingEnabled: b.actualProviderRoutingEnabled,
    actualQueueControlEnabled: b.actualQueueControlEnabled,
    actualRollbackExecutionEnabled: b.actualRollbackExecutionEnabled,
    blockers: sortKo(b.blockers),
    recommendations: sortKo(b.recommendations),
  };
}

function serializeBoundaryViolation(
  b: RuntimeReleaseGatePreflightBoundaryViolationReport
): Readonly<Record<string, unknown>> {
  return {
    mode: b.mode,
    ...SERIALIZED_ACTUAL_FLAGS_DISABLED,
    actualFlagViolations: sortKo(b.actualFlagViolations),
    proofViolations: sortKo(b.proofViolations),
    wordingRiskFindings: sortKo(b.wordingRiskFindings),
    recommendations: sortKo(b.recommendations),
  };
}

function serializeReadinessVerification(
  r: RuntimeReleaseGatePreflightReadinessVerificationReport
): Readonly<Record<string, unknown>> {
  return {
    mode: r.mode,
    actualRuntimeOrchestrationEnabled: r.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: r.actualPilotExecutionEnabled,
    actualNoopShellExecutionEnabled: r.actualNoopShellExecutionEnabled,
    actualExecutionShellExecutionEnabled: r.actualExecutionShellExecutionEnabled,
    actualReleaseEnforcementEnabled: r.actualReleaseEnforcementEnabled,
    verificationStatus: r.verificationStatus,
    findings: sortKo(r.findings),
    recommendations: sortKo(r.recommendations),
  };
}

function serializeAlignmentReport(a: RuntimeReleaseGatePreflightAlignmentReport): Readonly<Record<string, unknown>> {
  return {
    mode: a.mode,
    actualRuntimeOrchestrationEnabled: a.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: a.actualPilotExecutionEnabled,
    actualNoopShellExecutionEnabled: a.actualNoopShellExecutionEnabled,
    actualExecutionShellExecutionEnabled: a.actualExecutionShellExecutionEnabled,
    actualReleaseEnforcementEnabled: a.actualReleaseEnforcementEnabled,
    alignmentStatus: a.alignmentStatus,
    findings: sortKo(a.findings),
    recommendations: sortKo(a.recommendations),
  };
}

function serializeFinalSafetyGate(g: RuntimeReleaseGatePreflightFinalSafetyGate): Readonly<Record<string, unknown>> {
  return {
    mode: g.mode,
    ...SERIALIZED_ACTUAL_FLAGS_DISABLED,
    finalGateStatus: g.finalGateStatus,
    h36EntryReadiness: g.h36EntryReadiness,
    checklist: sortKo(g.checklist),
    blockers: sortKo(g.blockers),
    recommendations: sortKo(g.recommendations),
  };
}

function serializeChecklist(c: RuntimeReleaseGatePreflightChecklist): Readonly<Record<string, unknown>> {
  return {
    mode: c.mode,
    ...SERIALIZED_ACTUAL_FLAGS_DISABLED,
    checklist: sortKo(c.checklist),
    missingRows: sortKo(c.missingRows),
    blockers: sortKo(c.blockers),
    recommendations: sortKo(c.recommendations),
  };
}

export function serializeRuntimeReleaseGatePreflightDiagnosticBundleFromSemanticReports(
  reports: RuntimeSemanticPlanningReports
): Readonly<{
  runtimeReleaseGatePreflightSummary: ReturnType<typeof serializePreflightSummary>;
  runtimeReleaseGateExecutionReadinessBoundary: ReturnType<typeof serializeExecutionReadinessBoundary>;
  runtimeReleaseGateInputEnvelope: ReturnType<typeof serializeEnvelope>;
  runtimeReleaseGateOutputEnvelope: ReturnType<typeof serializeEnvelope>;
  runtimeReleaseGateNoExecutionProof: ReturnType<typeof serializeNoExecutionProof>;
  runtimeReleaseGateOperationForbiddenProof: ReturnType<typeof serializeOperationForbiddenProof>;
  runtimeReleaseGatePreflightBlockerReport: ReturnType<typeof serializeBlockerReport>;
  runtimeReleaseGatePreflightChecklist: ReturnType<typeof serializeChecklist>;
  runtimeReleaseGatePreflightBoundaryViolationReport: ReturnType<typeof serializeBoundaryViolation>;
  runtimeReleaseGatePreflightReadinessVerificationReport: ReturnType<typeof serializeReadinessVerification>;
  runtimeReleaseGatePreflightAlignmentReport: ReturnType<typeof serializeAlignmentReport>;
  runtimeReleaseGatePreflightFinalSafetyGate: ReturnType<typeof serializeFinalSafetyGate>;
}> {
  return {
    runtimeReleaseGatePreflightSummary: serializePreflightSummary(reports.runtimeReleaseGatePreflightSummary),
    runtimeReleaseGateExecutionReadinessBoundary: serializeExecutionReadinessBoundary(
      reports.runtimeReleaseGateExecutionReadinessBoundary
    ),
    runtimeReleaseGateInputEnvelope: serializeEnvelope(reports.runtimeReleaseGateInputEnvelope),
    runtimeReleaseGateOutputEnvelope: serializeEnvelope(reports.runtimeReleaseGateOutputEnvelope),
    runtimeReleaseGateNoExecutionProof: serializeNoExecutionProof(reports.runtimeReleaseGateNoExecutionProof),
    runtimeReleaseGateOperationForbiddenProof: serializeOperationForbiddenProof(
      reports.runtimeReleaseGateOperationForbiddenProof
    ),
    runtimeReleaseGatePreflightBlockerReport: serializeBlockerReport(
      reports.runtimeReleaseGatePreflightBlockerReport
    ),
    runtimeReleaseGatePreflightChecklist: serializeChecklist(reports.runtimeReleaseGatePreflightChecklist),
    runtimeReleaseGatePreflightBoundaryViolationReport: serializeBoundaryViolation(
      reports.runtimeReleaseGatePreflightBoundaryViolationReport
    ),
    runtimeReleaseGatePreflightReadinessVerificationReport: serializeReadinessVerification(
      reports.runtimeReleaseGatePreflightReadinessVerificationReport
    ),
    runtimeReleaseGatePreflightAlignmentReport: serializeAlignmentReport(
      reports.runtimeReleaseGatePreflightAlignmentReport
    ),
    runtimeReleaseGatePreflightFinalSafetyGate: serializeFinalSafetyGate(
      reports.runtimeReleaseGatePreflightFinalSafetyGate
    ),
  };
}
