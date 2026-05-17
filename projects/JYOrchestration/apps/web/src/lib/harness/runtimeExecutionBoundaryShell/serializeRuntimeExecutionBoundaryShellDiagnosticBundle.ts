/**
 * H36 — execution boundary shell 진단 **직렬화 전용**(report 재빌드 없음).
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type {
  RuntimeExecutionBoundaryShellAlignmentReport,
  RuntimeExecutionBoundaryShellBlockerReport,
  RuntimeExecutionBoundaryShellBoundaryViolationReport,
  RuntimeExecutionBoundaryShellFinalSafetyGate,
  RuntimeExecutionBoundaryShellPolicy,
  RuntimeExecutionBoundaryShellReadinessChecklist,
  RuntimeExecutionBoundaryShellReadinessVerificationReport,
  RuntimeExecutionBoundaryShellScope,
  RuntimeExecutionBoundaryShellSummary,
} from "./runtimeExecutionBoundaryShellTypes";

function sortKo(rows: readonly string[]): readonly string[] {
  return [...rows].sort((a, b) => a.localeCompare(b, "ko"));
}

function serializeSummary(s: RuntimeExecutionBoundaryShellSummary): Readonly<Record<string, unknown>> {
  return {
    mode: s.mode,
    actualRuntimeOrchestrationEnabled: s.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: s.actualPilotExecutionEnabled,
    actualNoopShellExecutionEnabled: s.actualNoopShellExecutionEnabled,
    actualExecutionShellExecutionEnabled: s.actualExecutionShellExecutionEnabled,
    actualReleaseEnforcementEnabled: s.actualReleaseEnforcementEnabled,
    actualRuntimeAdapterInvocationEnabled: s.actualRuntimeAdapterInvocationEnabled,
    actualExecutionEnabled: s.actualExecutionEnabled,
    actualProviderRoutingEnabled: s.actualProviderRoutingEnabled,
    actualQueueControlEnabled: s.actualQueueControlEnabled,
    actualRollbackExecutionEnabled: s.actualRollbackExecutionEnabled,
    candidateStatus: s.candidateStatus,
    shellMode: s.shellMode,
    rationaleKo: s.rationaleKo,
    shellBlockers: sortKo(s.shellBlockers),
    recommendations: sortKo(s.recommendations),
  };
}

function serializeScope(scope: RuntimeExecutionBoundaryShellScope): Readonly<Record<string, unknown>> {
  return {
    mode: scope.mode,
    actualRuntimeOrchestrationEnabled: scope.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: scope.actualPilotExecutionEnabled,
    actualNoopShellExecutionEnabled: scope.actualNoopShellExecutionEnabled,
    actualExecutionShellExecutionEnabled: scope.actualExecutionShellExecutionEnabled,
    actualReleaseEnforcementEnabled: scope.actualReleaseEnforcementEnabled,
    actualRuntimeAdapterInvocationEnabled: scope.actualRuntimeAdapterInvocationEnabled,
    actualExecutionEnabled: scope.actualExecutionEnabled,
    actualProviderRoutingEnabled: scope.actualProviderRoutingEnabled,
    actualQueueControlEnabled: scope.actualQueueControlEnabled,
    actualRollbackExecutionEnabled: scope.actualRollbackExecutionEnabled,
    candidateSourceLayer: scope.candidateSourceLayer,
    candidateTargetLayer: scope.candidateTargetLayer,
    requiredInputMetadata: sortKo(scope.requiredInputMetadata),
    expectedOutputMetadata: sortKo(scope.expectedOutputMetadata),
    allowedShellMetadataScopes: sortKo(scope.allowedShellMetadataScopes),
    forbiddenShellOperations: sortKo(scope.forbiddenShellOperations),
    recommendations: sortKo(scope.recommendations),
  };
}

function serializePolicy(p: RuntimeExecutionBoundaryShellPolicy): Readonly<Record<string, unknown>> {
  return {
    mode: p.mode,
    actualRuntimeOrchestrationEnabled: p.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: p.actualPilotExecutionEnabled,
    actualNoopShellExecutionEnabled: p.actualNoopShellExecutionEnabled,
    actualExecutionShellExecutionEnabled: p.actualExecutionShellExecutionEnabled,
    actualReleaseEnforcementEnabled: p.actualReleaseEnforcementEnabled,
    actualRuntimeAdapterInvocationEnabled: p.actualRuntimeAdapterInvocationEnabled,
    actualExecutionEnabled: p.actualExecutionEnabled,
    actualProviderRoutingEnabled: p.actualProviderRoutingEnabled,
    actualQueueControlEnabled: p.actualQueueControlEnabled,
    actualRollbackExecutionEnabled: p.actualRollbackExecutionEnabled,
    shellAllowedMode: p.shellAllowedMode,
    operatorReviewBeforeExecutionBoundary: p.operatorReviewBeforeExecutionBoundary,
    rollbackReadinessRequired: p.rollbackReadinessRequired,
    auditTraceRequired: p.auditTraceRequired,
    actualExecutionForbidden: p.actualExecutionForbidden,
    actualExecutionRoutingForbidden: p.actualExecutionRoutingForbidden,
    actualReleaseEnforcementForbidden: p.actualReleaseEnforcementForbidden,
    actualShellExecutionForbidden: p.actualShellExecutionForbidden,
    actualAdapterInvocationForbidden: p.actualAdapterInvocationForbidden,
    actualProviderRoutingForbidden: p.actualProviderRoutingForbidden,
    actualQueueControlForbidden: p.actualQueueControlForbidden,
    actualRollbackForbidden: p.actualRollbackForbidden,
    recommendations: sortKo(p.recommendations),
  };
}

function serializeBlockerReport(b: RuntimeExecutionBoundaryShellBlockerReport): Readonly<Record<string, unknown>> {
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

function serializeChecklist(c: RuntimeExecutionBoundaryShellReadinessChecklist): Readonly<Record<string, unknown>> {
  return {
    mode: c.mode,
    actualRuntimeOrchestrationEnabled: c.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: c.actualPilotExecutionEnabled,
    actualNoopShellExecutionEnabled: c.actualNoopShellExecutionEnabled,
    actualExecutionShellExecutionEnabled: c.actualExecutionShellExecutionEnabled,
    actualReleaseEnforcementEnabled: c.actualReleaseEnforcementEnabled,
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
  v: RuntimeExecutionBoundaryShellBoundaryViolationReport
): Readonly<Record<string, unknown>> {
  return {
    mode: v.mode,
    actualRuntimeOrchestrationEnabled: v.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: v.actualPilotExecutionEnabled,
    actualNoopShellExecutionEnabled: v.actualNoopShellExecutionEnabled,
    actualExecutionShellExecutionEnabled: v.actualExecutionShellExecutionEnabled,
    actualReleaseEnforcementEnabled: v.actualReleaseEnforcementEnabled,
    actualRuntimeAdapterInvocationEnabled: v.actualRuntimeAdapterInvocationEnabled,
    actualExecutionEnabled: v.actualExecutionEnabled,
    actualProviderRoutingEnabled: v.actualProviderRoutingEnabled,
    actualQueueControlEnabled: v.actualQueueControlEnabled,
    actualRollbackExecutionEnabled: v.actualRollbackExecutionEnabled,
    actualFlagViolations: sortKo(v.actualFlagViolations),
    wordingRiskFindings: sortKo(v.wordingRiskFindings),
    recommendations: sortKo(v.recommendations),
  };
}

function serializeReadinessVerification(
  v: RuntimeExecutionBoundaryShellReadinessVerificationReport
): Readonly<Record<string, unknown>> {
  return {
    mode: v.mode,
    actualRuntimeOrchestrationEnabled: v.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: v.actualPilotExecutionEnabled,
    actualNoopShellExecutionEnabled: v.actualNoopShellExecutionEnabled,
    actualExecutionShellExecutionEnabled: v.actualExecutionShellExecutionEnabled,
    actualReleaseEnforcementEnabled: v.actualReleaseEnforcementEnabled,
    verificationStatus: v.verificationStatus,
    findings: sortKo(v.findings),
    recommendations: sortKo(v.recommendations),
  };
}

function serializeAlignment(a: RuntimeExecutionBoundaryShellAlignmentReport): Readonly<Record<string, unknown>> {
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

function serializeFinalSafetyGate(g: RuntimeExecutionBoundaryShellFinalSafetyGate): Readonly<Record<string, unknown>> {
  return {
    mode: g.mode,
    actualRuntimeOrchestrationEnabled: g.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: g.actualPilotExecutionEnabled,
    actualNoopShellExecutionEnabled: g.actualNoopShellExecutionEnabled,
    actualExecutionShellExecutionEnabled: g.actualExecutionShellExecutionEnabled,
    actualReleaseEnforcementEnabled: g.actualReleaseEnforcementEnabled,
    actualRuntimeAdapterInvocationEnabled: g.actualRuntimeAdapterInvocationEnabled,
    actualExecutionEnabled: g.actualExecutionEnabled,
    actualProviderRoutingEnabled: g.actualProviderRoutingEnabled,
    actualQueueControlEnabled: g.actualQueueControlEnabled,
    actualRollbackExecutionEnabled: g.actualRollbackExecutionEnabled,
    finalGateStatus: g.finalGateStatus,
    h37EntryReadiness: g.h37EntryReadiness,
    checklist: sortKo(g.checklist),
    blockers: sortKo(g.blockers),
    recommendations: sortKo(g.recommendations),
  };
}

export function serializeRuntimeExecutionBoundaryShellDiagnosticBundleFromSemanticReports(
  reports: RuntimeSemanticPlanningReports
): Readonly<{
  runtimeExecutionBoundaryShellSummary: ReturnType<typeof serializeSummary>;
  runtimeExecutionBoundaryShellScope: ReturnType<typeof serializeScope>;
  runtimeExecutionBoundaryShellPolicy: ReturnType<typeof serializePolicy>;
  runtimeExecutionBoundaryShellBlockerReport: ReturnType<typeof serializeBlockerReport>;
  runtimeExecutionBoundaryShellReadinessChecklist: ReturnType<typeof serializeChecklist>;
  runtimeExecutionBoundaryShellBoundaryViolationReport: ReturnType<typeof serializeBoundaryViolation>;
  runtimeExecutionBoundaryShellReadinessVerificationReport: ReturnType<typeof serializeReadinessVerification>;
  runtimeExecutionBoundaryShellAlignmentReport: ReturnType<typeof serializeAlignment>;
  runtimeExecutionBoundaryShellFinalSafetyGate: ReturnType<typeof serializeFinalSafetyGate>;
}> {
  return {
    runtimeExecutionBoundaryShellSummary: serializeSummary(reports.runtimeExecutionBoundaryShellSummary),
    runtimeExecutionBoundaryShellScope: serializeScope(reports.runtimeExecutionBoundaryShellScope),
    runtimeExecutionBoundaryShellPolicy: serializePolicy(reports.runtimeExecutionBoundaryShellPolicy),
    runtimeExecutionBoundaryShellBlockerReport: serializeBlockerReport(
      reports.runtimeExecutionBoundaryShellBlockerReport
    ),
    runtimeExecutionBoundaryShellReadinessChecklist: serializeChecklist(
      reports.runtimeExecutionBoundaryShellReadinessChecklist
    ),
    runtimeExecutionBoundaryShellBoundaryViolationReport: serializeBoundaryViolation(
      reports.runtimeExecutionBoundaryShellBoundaryViolationReport
    ),
    runtimeExecutionBoundaryShellReadinessVerificationReport: serializeReadinessVerification(
      reports.runtimeExecutionBoundaryShellReadinessVerificationReport
    ),
    runtimeExecutionBoundaryShellAlignmentReport: serializeAlignment(
      reports.runtimeExecutionBoundaryShellAlignmentReport
    ),
    runtimeExecutionBoundaryShellFinalSafetyGate: serializeFinalSafetyGate(
      reports.runtimeExecutionBoundaryShellFinalSafetyGate
    ),
  };
}
