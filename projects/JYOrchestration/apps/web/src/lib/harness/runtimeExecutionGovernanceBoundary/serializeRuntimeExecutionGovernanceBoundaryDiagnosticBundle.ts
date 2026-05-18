/**
 * H37 — governance boundary 진단 **직렬화 전용**(report 재빌드 없음).
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type {
  RuntimeExecutionGovernanceBoundaryAlignmentReport,
  RuntimeExecutionGovernanceBoundaryBlockerReport,
  RuntimeExecutionGovernanceBoundaryFinalSafetyGate,
  RuntimeExecutionGovernanceBoundaryPolicy,
  RuntimeExecutionGovernanceBoundaryReadinessChecklist,
  RuntimeExecutionGovernanceBoundaryReadinessVerificationReport,
  RuntimeExecutionGovernanceBoundaryScope,
  RuntimeExecutionGovernanceBoundarySummary,
  RuntimeExecutionGovernanceBoundaryViolationReport,
} from "./runtimeExecutionGovernanceBoundaryTypes";

function sortKo(rows: readonly string[]): readonly string[] {
  return [...rows].sort((a, b) => a.localeCompare(b, "ko"));
}

function serializeSummary(s: RuntimeExecutionGovernanceBoundarySummary): Readonly<Record<string, unknown>> {
  return {
    mode: s.mode,
    actualRuntimeOrchestrationEnabled: s.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: s.actualPilotExecutionEnabled,
    actualNoopShellExecutionEnabled: s.actualNoopShellExecutionEnabled,
    actualExecutionShellExecutionEnabled: s.actualExecutionShellExecutionEnabled,
    actualReleaseEnforcementEnabled: s.actualReleaseEnforcementEnabled,
    actualRuntimeAdapterInvocationEnabled: s.actualRuntimeAdapterInvocationEnabled,
    actualExecutionEnabled: s.actualExecutionEnabled,
    actualExecutionRoutingEnabled: s.actualExecutionRoutingEnabled,
    actualProviderRoutingEnabled: s.actualProviderRoutingEnabled,
    actualQueueControlEnabled: s.actualQueueControlEnabled,
    actualRollbackExecutionEnabled: s.actualRollbackExecutionEnabled,
    actualApprovalEnforcementEnabled: s.actualApprovalEnforcementEnabled,
    candidateStatus: s.candidateStatus,
    governanceMode: s.governanceMode,
    hardeningReadiness: s.hardeningReadiness,
    rationaleKo: s.rationaleKo,
    governanceBlockers: sortKo(s.governanceBlockers),
    recommendations: sortKo(s.recommendations),
  };
}

function serializeScope(scope: RuntimeExecutionGovernanceBoundaryScope): Readonly<Record<string, unknown>> {
  return {
    mode: scope.mode,
    actualRuntimeOrchestrationEnabled: scope.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: scope.actualPilotExecutionEnabled,
    actualNoopShellExecutionEnabled: scope.actualNoopShellExecutionEnabled,
    actualExecutionShellExecutionEnabled: scope.actualExecutionShellExecutionEnabled,
    actualReleaseEnforcementEnabled: scope.actualReleaseEnforcementEnabled,
    actualRuntimeAdapterInvocationEnabled: scope.actualRuntimeAdapterInvocationEnabled,
    actualExecutionEnabled: scope.actualExecutionEnabled,
    actualExecutionRoutingEnabled: scope.actualExecutionRoutingEnabled,
    actualProviderRoutingEnabled: scope.actualProviderRoutingEnabled,
    actualQueueControlEnabled: scope.actualQueueControlEnabled,
    actualRollbackExecutionEnabled: scope.actualRollbackExecutionEnabled,
    actualApprovalEnforcementEnabled: scope.actualApprovalEnforcementEnabled,
    candidateSourceLayer: scope.candidateSourceLayer,
    candidateTargetLayer: scope.candidateTargetLayer,
    requiredInputMetadata: sortKo(scope.requiredInputMetadata),
    expectedOutputMetadata: sortKo(scope.expectedOutputMetadata),
    allowedGovernanceMetadataScopes: sortKo(scope.allowedGovernanceMetadataScopes),
    forbiddenGovernanceOperations: sortKo(scope.forbiddenGovernanceOperations),
    recommendations: sortKo(scope.recommendations),
  };
}

function serializePolicy(p: RuntimeExecutionGovernanceBoundaryPolicy): Readonly<Record<string, unknown>> {
  return {
    mode: p.mode,
    actualRuntimeOrchestrationEnabled: p.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: p.actualPilotExecutionEnabled,
    actualNoopShellExecutionEnabled: p.actualNoopShellExecutionEnabled,
    actualExecutionShellExecutionEnabled: p.actualExecutionShellExecutionEnabled,
    actualReleaseEnforcementEnabled: p.actualReleaseEnforcementEnabled,
    actualRuntimeAdapterInvocationEnabled: p.actualRuntimeAdapterInvocationEnabled,
    actualExecutionEnabled: p.actualExecutionEnabled,
    actualExecutionRoutingEnabled: p.actualExecutionRoutingEnabled,
    actualProviderRoutingEnabled: p.actualProviderRoutingEnabled,
    actualQueueControlEnabled: p.actualQueueControlEnabled,
    actualRollbackExecutionEnabled: p.actualRollbackExecutionEnabled,
    actualApprovalEnforcementEnabled: p.actualApprovalEnforcementEnabled,
    governanceAllowedMode: p.governanceAllowedMode,
    operatorReviewBeforeGovernanceBoundary: p.operatorReviewBeforeGovernanceBoundary,
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
    actualApprovalEnforcementForbidden: p.actualApprovalEnforcementForbidden,
    recommendations: sortKo(p.recommendations),
  };
}

function serializeBlockerReport(b: RuntimeExecutionGovernanceBoundaryBlockerReport): Readonly<Record<string, unknown>> {
  return {
    mode: b.mode,
    actualRuntimeOrchestrationEnabled: b.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: b.actualPilotExecutionEnabled,
    actualNoopShellExecutionEnabled: b.actualNoopShellExecutionEnabled,
    actualExecutionShellExecutionEnabled: b.actualExecutionShellExecutionEnabled,
    actualReleaseEnforcementEnabled: b.actualReleaseEnforcementEnabled,
    actualRuntimeAdapterInvocationEnabled: b.actualRuntimeAdapterInvocationEnabled,
    actualExecutionEnabled: b.actualExecutionEnabled,
    actualExecutionRoutingEnabled: b.actualExecutionRoutingEnabled,
    actualProviderRoutingEnabled: b.actualProviderRoutingEnabled,
    actualQueueControlEnabled: b.actualQueueControlEnabled,
    actualRollbackExecutionEnabled: b.actualRollbackExecutionEnabled,
    actualApprovalEnforcementEnabled: b.actualApprovalEnforcementEnabled,
    blockers: sortKo(b.blockers),
    recommendations: sortKo(b.recommendations),
  };
}

function serializeChecklist(c: RuntimeExecutionGovernanceBoundaryReadinessChecklist): Readonly<Record<string, unknown>> {
  return {
    mode: c.mode,
    actualRuntimeOrchestrationEnabled: c.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: c.actualPilotExecutionEnabled,
    actualNoopShellExecutionEnabled: c.actualNoopShellExecutionEnabled,
    actualExecutionShellExecutionEnabled: c.actualExecutionShellExecutionEnabled,
    actualReleaseEnforcementEnabled: c.actualReleaseEnforcementEnabled,
    actualRuntimeAdapterInvocationEnabled: c.actualRuntimeAdapterInvocationEnabled,
    actualExecutionEnabled: c.actualExecutionEnabled,
    actualExecutionRoutingEnabled: c.actualExecutionRoutingEnabled,
    actualProviderRoutingEnabled: c.actualProviderRoutingEnabled,
    actualQueueControlEnabled: c.actualQueueControlEnabled,
    actualRollbackExecutionEnabled: c.actualRollbackExecutionEnabled,
    actualApprovalEnforcementEnabled: c.actualApprovalEnforcementEnabled,
    checklist: sortKo(c.checklist),
    missingRows: sortKo(c.missingRows),
    blockers: sortKo(c.blockers),
    recommendations: sortKo(c.recommendations),
  };
}

function serializeViolationReport(
  v: RuntimeExecutionGovernanceBoundaryViolationReport
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
    actualExecutionRoutingEnabled: v.actualExecutionRoutingEnabled,
    actualProviderRoutingEnabled: v.actualProviderRoutingEnabled,
    actualQueueControlEnabled: v.actualQueueControlEnabled,
    actualRollbackExecutionEnabled: v.actualRollbackExecutionEnabled,
    actualApprovalEnforcementEnabled: v.actualApprovalEnforcementEnabled,
    actualFlagViolations: sortKo(v.actualFlagViolations),
    wordingRiskFindings: sortKo(v.wordingRiskFindings),
    recommendations: sortKo(v.recommendations),
  };
}

function serializeReadinessVerification(
  r: RuntimeExecutionGovernanceBoundaryReadinessVerificationReport
): Readonly<Record<string, unknown>> {
  return {
    mode: r.mode,
    actualRuntimeOrchestrationEnabled: r.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: r.actualPilotExecutionEnabled,
    actualExecutionEnabled: r.actualExecutionEnabled,
    actualExecutionRoutingEnabled: r.actualExecutionRoutingEnabled,
    actualReleaseEnforcementEnabled: r.actualReleaseEnforcementEnabled,
    actualApprovalEnforcementEnabled: r.actualApprovalEnforcementEnabled,
    verificationStatus: r.verificationStatus,
    findings: sortKo(r.findings),
    recommendations: sortKo(r.recommendations),
  };
}

function serializeAlignmentReport(
  a: RuntimeExecutionGovernanceBoundaryAlignmentReport
): Readonly<Record<string, unknown>> {
  return {
    mode: a.mode,
    actualRuntimeOrchestrationEnabled: a.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: a.actualPilotExecutionEnabled,
    actualExecutionEnabled: a.actualExecutionEnabled,
    actualExecutionRoutingEnabled: a.actualExecutionRoutingEnabled,
    actualReleaseEnforcementEnabled: a.actualReleaseEnforcementEnabled,
    actualApprovalEnforcementEnabled: a.actualApprovalEnforcementEnabled,
    alignmentStatus: a.alignmentStatus,
    findings: sortKo(a.findings),
    recommendations: sortKo(a.recommendations),
  };
}

function serializeFinalSafetyGate(
  g: RuntimeExecutionGovernanceBoundaryFinalSafetyGate
): Readonly<Record<string, unknown>> {
  return {
    mode: g.mode,
    actualRuntimeOrchestrationEnabled: g.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: g.actualPilotExecutionEnabled,
    actualNoopShellExecutionEnabled: g.actualNoopShellExecutionEnabled,
    actualExecutionShellExecutionEnabled: g.actualExecutionShellExecutionEnabled,
    actualReleaseEnforcementEnabled: g.actualReleaseEnforcementEnabled,
    actualRuntimeAdapterInvocationEnabled: g.actualRuntimeAdapterInvocationEnabled,
    actualExecutionEnabled: g.actualExecutionEnabled,
    actualExecutionRoutingEnabled: g.actualExecutionRoutingEnabled,
    actualProviderRoutingEnabled: g.actualProviderRoutingEnabled,
    actualQueueControlEnabled: g.actualQueueControlEnabled,
    actualRollbackExecutionEnabled: g.actualRollbackExecutionEnabled,
    actualApprovalEnforcementEnabled: g.actualApprovalEnforcementEnabled,
    finalGateStatus: g.finalGateStatus,
    h38EntryReadiness: g.h38EntryReadiness,
    checklist: sortKo(g.checklist),
    blockers: sortKo(g.blockers),
    recommendations: sortKo(g.recommendations),
  };
}

export function serializeRuntimeExecutionGovernanceBoundaryDiagnosticBundleFromSemanticReports(
  reports: RuntimeSemanticPlanningReports
): Readonly<{
  runtimeExecutionGovernanceBoundarySummary: ReturnType<typeof serializeSummary>;
  runtimeExecutionGovernanceBoundaryScope: ReturnType<typeof serializeScope>;
  runtimeExecutionGovernanceBoundaryPolicy: ReturnType<typeof serializePolicy>;
  runtimeExecutionGovernanceBoundaryBlockerReport: ReturnType<typeof serializeBlockerReport>;
  runtimeExecutionGovernanceBoundaryReadinessChecklist: ReturnType<typeof serializeChecklist>;
  runtimeExecutionGovernanceBoundaryViolationReport: ReturnType<typeof serializeViolationReport>;
  runtimeExecutionGovernanceBoundaryReadinessVerificationReport: ReturnType<typeof serializeReadinessVerification>;
  runtimeExecutionGovernanceBoundaryAlignmentReport: ReturnType<typeof serializeAlignmentReport>;
  runtimeExecutionGovernanceBoundaryFinalSafetyGate: ReturnType<typeof serializeFinalSafetyGate>;
}> {
  return {
    runtimeExecutionGovernanceBoundarySummary: serializeSummary(reports.runtimeExecutionGovernanceBoundarySummary),
    runtimeExecutionGovernanceBoundaryScope: serializeScope(reports.runtimeExecutionGovernanceBoundaryScope),
    runtimeExecutionGovernanceBoundaryPolicy: serializePolicy(reports.runtimeExecutionGovernanceBoundaryPolicy),
    runtimeExecutionGovernanceBoundaryBlockerReport: serializeBlockerReport(
      reports.runtimeExecutionGovernanceBoundaryBlockerReport
    ),
    runtimeExecutionGovernanceBoundaryReadinessChecklist: serializeChecklist(
      reports.runtimeExecutionGovernanceBoundaryReadinessChecklist
    ),
    runtimeExecutionGovernanceBoundaryViolationReport: serializeViolationReport(
      reports.runtimeExecutionGovernanceBoundaryViolationReport
    ),
    runtimeExecutionGovernanceBoundaryReadinessVerificationReport: serializeReadinessVerification(
      reports.runtimeExecutionGovernanceBoundaryReadinessVerificationReport
    ),
    runtimeExecutionGovernanceBoundaryAlignmentReport: serializeAlignmentReport(
      reports.runtimeExecutionGovernanceBoundaryAlignmentReport
    ),
    runtimeExecutionGovernanceBoundaryFinalSafetyGate: serializeFinalSafetyGate(
      reports.runtimeExecutionGovernanceBoundaryFinalSafetyGate
    ),
  };
}
