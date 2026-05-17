/**
 * H37 — governance boundary 진단 **직렬화 전용**(report 재빌드 없음).
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type {
  RuntimeExecutionGovernanceBoundaryBlockerReport,
  RuntimeExecutionGovernanceBoundaryPolicy,
  RuntimeExecutionGovernanceBoundaryReadinessChecklist,
  RuntimeExecutionGovernanceBoundaryScope,
  RuntimeExecutionGovernanceBoundarySummary,
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

export function serializeRuntimeExecutionGovernanceBoundaryDiagnosticBundleFromSemanticReports(
  reports: RuntimeSemanticPlanningReports
): Readonly<{
  runtimeExecutionGovernanceBoundarySummary: ReturnType<typeof serializeSummary>;
  runtimeExecutionGovernanceBoundaryScope: ReturnType<typeof serializeScope>;
  runtimeExecutionGovernanceBoundaryPolicy: ReturnType<typeof serializePolicy>;
  runtimeExecutionGovernanceBoundaryBlockerReport: ReturnType<typeof serializeBlockerReport>;
  runtimeExecutionGovernanceBoundaryReadinessChecklist: ReturnType<typeof serializeChecklist>;
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
  };
}
