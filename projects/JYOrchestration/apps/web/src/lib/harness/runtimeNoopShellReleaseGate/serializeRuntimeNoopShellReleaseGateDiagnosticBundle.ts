/**
 * H34 — no-op shell release-gate 진단 **직렬화 전용**(report 재빌드 없음).
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type {
  RuntimeNoopShellReleaseGateAlignmentReport,
  RuntimeNoopShellReleaseGateBlockerReport,
  RuntimeNoopShellReleaseGateBoundaryViolationReport,
  RuntimeNoopShellReleaseGateFinalSafetyGate,
  RuntimeNoopShellReleaseGatePolicy,
  RuntimeNoopShellReleaseGateReadinessChecklist,
  RuntimeNoopShellReleaseGateReadinessVerificationReport,
  RuntimeNoopShellReleaseGateScope,
  RuntimeNoopShellReleaseGateSummary,
} from "./runtimeNoopShellReleaseGateTypes";

function sortKo(rows: readonly string[]): readonly string[] {
  return [...rows].sort((a, b) => a.localeCompare(b, "ko"));
}

function serializeSummary(s: RuntimeNoopShellReleaseGateSummary): Readonly<Record<string, unknown>> {
  return {
    mode: s.mode,
    actualRuntimeOrchestrationEnabled: s.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: s.actualPilotExecutionEnabled,
    actualNoopShellExecutionEnabled: s.actualNoopShellExecutionEnabled,
    actualExecutionShellExecutionEnabled: s.actualExecutionShellExecutionEnabled,
    actualRuntimeAdapterInvocationEnabled: s.actualRuntimeAdapterInvocationEnabled,
    actualExecutionEnabled: s.actualExecutionEnabled,
    actualProviderRoutingEnabled: s.actualProviderRoutingEnabled,
    actualQueueControlEnabled: s.actualQueueControlEnabled,
    actualRollbackExecutionEnabled: s.actualRollbackExecutionEnabled,
    candidateStatus: s.candidateStatus,
    releaseGateMode: s.releaseGateMode,
    rationaleKo: s.rationaleKo,
    releaseGateBlockers: sortKo(s.releaseGateBlockers),
    recommendations: sortKo(s.recommendations),
  };
}

function serializeScope(scope: RuntimeNoopShellReleaseGateScope): Readonly<Record<string, unknown>> {
  return {
    mode: scope.mode,
    actualRuntimeOrchestrationEnabled: scope.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: scope.actualPilotExecutionEnabled,
    actualNoopShellExecutionEnabled: scope.actualNoopShellExecutionEnabled,
    actualExecutionShellExecutionEnabled: scope.actualExecutionShellExecutionEnabled,
    actualRuntimeAdapterInvocationEnabled: scope.actualRuntimeAdapterInvocationEnabled,
    actualExecutionEnabled: scope.actualExecutionEnabled,
    actualProviderRoutingEnabled: scope.actualProviderRoutingEnabled,
    actualQueueControlEnabled: scope.actualQueueControlEnabled,
    actualRollbackExecutionEnabled: scope.actualRollbackExecutionEnabled,
    candidateSourceLayer: scope.candidateSourceLayer,
    candidateTargetLayer: scope.candidateTargetLayer,
    requiredInputMetadata: sortKo(scope.requiredInputMetadata),
    expectedOutputMetadata: sortKo(scope.expectedOutputMetadata),
    allowedReleaseGateMetadataScopes: sortKo(scope.allowedReleaseGateMetadataScopes),
    forbiddenReleaseGateOperations: sortKo(scope.forbiddenReleaseGateOperations),
    recommendations: sortKo(scope.recommendations),
  };
}

function serializePolicy(p: RuntimeNoopShellReleaseGatePolicy): Readonly<Record<string, unknown>> {
  return {
    mode: p.mode,
    actualRuntimeOrchestrationEnabled: p.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: p.actualPilotExecutionEnabled,
    actualNoopShellExecutionEnabled: p.actualNoopShellExecutionEnabled,
    actualExecutionShellExecutionEnabled: p.actualExecutionShellExecutionEnabled,
    actualRuntimeAdapterInvocationEnabled: p.actualRuntimeAdapterInvocationEnabled,
    actualExecutionEnabled: p.actualExecutionEnabled,
    actualProviderRoutingEnabled: p.actualProviderRoutingEnabled,
    actualQueueControlEnabled: p.actualQueueControlEnabled,
    actualRollbackExecutionEnabled: p.actualRollbackExecutionEnabled,
    releaseGateAllowedMode: p.releaseGateAllowedMode,
    operatorReviewBeforeReleaseGate: p.operatorReviewBeforeReleaseGate,
    rollbackReadinessRequired: p.rollbackReadinessRequired,
    auditTraceRequired: p.auditTraceRequired,
    actualReleaseEnforcementForbidden: p.actualReleaseEnforcementForbidden,
    actualShellExecutionForbidden: p.actualShellExecutionForbidden,
    actualExecutionForbidden: p.actualExecutionForbidden,
    actualAdapterInvocationForbidden: p.actualAdapterInvocationForbidden,
    recommendations: sortKo(p.recommendations),
  };
}

function serializeBlockerReport(b: RuntimeNoopShellReleaseGateBlockerReport): Readonly<Record<string, unknown>> {
  return {
    mode: b.mode,
    actualRuntimeOrchestrationEnabled: b.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: b.actualPilotExecutionEnabled,
    actualNoopShellExecutionEnabled: b.actualNoopShellExecutionEnabled,
    actualExecutionShellExecutionEnabled: b.actualExecutionShellExecutionEnabled,
    actualRuntimeAdapterInvocationEnabled: b.actualRuntimeAdapterInvocationEnabled,
    actualExecutionEnabled: b.actualExecutionEnabled,
    actualProviderRoutingEnabled: b.actualProviderRoutingEnabled,
    actualQueueControlEnabled: b.actualQueueControlEnabled,
    actualRollbackExecutionEnabled: b.actualRollbackExecutionEnabled,
    blockers: sortKo(b.blockers),
    recommendations: sortKo(b.recommendations),
  };
}

function serializeChecklist(c: RuntimeNoopShellReleaseGateReadinessChecklist): Readonly<Record<string, unknown>> {
  return {
    mode: c.mode,
    actualRuntimeOrchestrationEnabled: c.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: c.actualPilotExecutionEnabled,
    actualNoopShellExecutionEnabled: c.actualNoopShellExecutionEnabled,
    actualExecutionShellExecutionEnabled: c.actualExecutionShellExecutionEnabled,
    actualRuntimeAdapterInvocationEnabled: c.actualRuntimeAdapterInvocationEnabled,
    actualExecutionEnabled: c.actualExecutionEnabled,
    actualProviderRoutingEnabled: c.actualProviderRoutingEnabled,
    actualQueueControlEnabled: c.actualQueueControlEnabled,
    actualRollbackExecutionEnabled: c.actualRollbackExecutionEnabled,
    checklist: sortKo(c.checklist),
    missingRows: sortKo(c.missingRows),
    blockers: sortKo(c.blockers),
    recommendations: sortKo(c.recommendations),
  };
}

function serializeBoundaryViolation(
  b: RuntimeNoopShellReleaseGateBoundaryViolationReport
): Readonly<Record<string, unknown>> {
  return {
    mode: b.mode,
    actualRuntimeOrchestrationEnabled: b.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: b.actualPilotExecutionEnabled,
    actualNoopShellExecutionEnabled: b.actualNoopShellExecutionEnabled,
    actualExecutionShellExecutionEnabled: b.actualExecutionShellExecutionEnabled,
    actualRuntimeAdapterInvocationEnabled: b.actualRuntimeAdapterInvocationEnabled,
    actualExecutionEnabled: b.actualExecutionEnabled,
    actualProviderRoutingEnabled: b.actualProviderRoutingEnabled,
    actualQueueControlEnabled: b.actualQueueControlEnabled,
    actualRollbackExecutionEnabled: b.actualRollbackExecutionEnabled,
    actualFlagViolations: sortKo(b.actualFlagViolations),
    wordingRiskFindings: sortKo(b.wordingRiskFindings),
    recommendations: sortKo(b.recommendations),
  };
}

function serializeReadinessVerification(
  r: RuntimeNoopShellReleaseGateReadinessVerificationReport
): Readonly<Record<string, unknown>> {
  return {
    mode: r.mode,
    actualRuntimeOrchestrationEnabled: r.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: r.actualPilotExecutionEnabled,
    actualNoopShellExecutionEnabled: r.actualNoopShellExecutionEnabled,
    actualExecutionShellExecutionEnabled: r.actualExecutionShellExecutionEnabled,
    verificationStatus: r.verificationStatus,
    findings: sortKo(r.findings),
    recommendations: sortKo(r.recommendations),
  };
}

function serializeAlignmentReport(a: RuntimeNoopShellReleaseGateAlignmentReport): Readonly<Record<string, unknown>> {
  return {
    mode: a.mode,
    actualRuntimeOrchestrationEnabled: a.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: a.actualPilotExecutionEnabled,
    actualNoopShellExecutionEnabled: a.actualNoopShellExecutionEnabled,
    actualExecutionShellExecutionEnabled: a.actualExecutionShellExecutionEnabled,
    alignmentStatus: a.alignmentStatus,
    findings: sortKo(a.findings),
    recommendations: sortKo(a.recommendations),
  };
}

function serializeFinalSafetyGate(g: RuntimeNoopShellReleaseGateFinalSafetyGate): Readonly<Record<string, unknown>> {
  return {
    mode: g.mode,
    actualRuntimeOrchestrationEnabled: g.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: g.actualPilotExecutionEnabled,
    actualNoopShellExecutionEnabled: g.actualNoopShellExecutionEnabled,
    actualExecutionShellExecutionEnabled: g.actualExecutionShellExecutionEnabled,
    actualRuntimeAdapterInvocationEnabled: g.actualRuntimeAdapterInvocationEnabled,
    actualExecutionEnabled: g.actualExecutionEnabled,
    actualProviderRoutingEnabled: g.actualProviderRoutingEnabled,
    actualQueueControlEnabled: g.actualQueueControlEnabled,
    actualRollbackExecutionEnabled: g.actualRollbackExecutionEnabled,
    finalGateStatus: g.finalGateStatus,
    h35EntryReadiness: g.h35EntryReadiness,
    checklist: sortKo(g.checklist),
    blockers: sortKo(g.blockers),
    recommendations: sortKo(g.recommendations),
  };
}

export function serializeRuntimeNoopShellReleaseGateDiagnosticBundleFromSemanticReports(
  reports: RuntimeSemanticPlanningReports
): Readonly<{
  runtimeNoopShellReleaseGateSummary: ReturnType<typeof serializeSummary>;
  runtimeNoopShellReleaseGateScope: ReturnType<typeof serializeScope>;
  runtimeNoopShellReleaseGatePolicy: ReturnType<typeof serializePolicy>;
  runtimeNoopShellReleaseGateBlockerReport: ReturnType<typeof serializeBlockerReport>;
  runtimeNoopShellReleaseGateReadinessChecklist: ReturnType<typeof serializeChecklist>;
  runtimeNoopShellReleaseGateBoundaryViolationReport: ReturnType<typeof serializeBoundaryViolation>;
  runtimeNoopShellReleaseGateReadinessVerificationReport: ReturnType<typeof serializeReadinessVerification>;
  runtimeNoopShellReleaseGateAlignmentReport: ReturnType<typeof serializeAlignmentReport>;
  runtimeNoopShellReleaseGateFinalSafetyGate: ReturnType<typeof serializeFinalSafetyGate>;
}> {
  return {
    runtimeNoopShellReleaseGateSummary: serializeSummary(reports.runtimeNoopShellReleaseGateSummary),
    runtimeNoopShellReleaseGateScope: serializeScope(reports.runtimeNoopShellReleaseGateScope),
    runtimeNoopShellReleaseGatePolicy: serializePolicy(reports.runtimeNoopShellReleaseGatePolicy),
    runtimeNoopShellReleaseGateBlockerReport: serializeBlockerReport(
      reports.runtimeNoopShellReleaseGateBlockerReport
    ),
    runtimeNoopShellReleaseGateReadinessChecklist: serializeChecklist(
      reports.runtimeNoopShellReleaseGateReadinessChecklist
    ),
    runtimeNoopShellReleaseGateBoundaryViolationReport: serializeBoundaryViolation(
      reports.runtimeNoopShellReleaseGateBoundaryViolationReport
    ),
    runtimeNoopShellReleaseGateReadinessVerificationReport: serializeReadinessVerification(
      reports.runtimeNoopShellReleaseGateReadinessVerificationReport
    ),
    runtimeNoopShellReleaseGateAlignmentReport: serializeAlignmentReport(
      reports.runtimeNoopShellReleaseGateAlignmentReport
    ),
    runtimeNoopShellReleaseGateFinalSafetyGate: serializeFinalSafetyGate(
      reports.runtimeNoopShellReleaseGateFinalSafetyGate
    ),
  };
}
