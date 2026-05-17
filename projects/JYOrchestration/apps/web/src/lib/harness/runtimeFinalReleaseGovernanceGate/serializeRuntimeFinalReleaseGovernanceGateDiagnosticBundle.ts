/**
 * H39 — final release governance gate 진단 **직렬화 전용**(report 재빌드 없음).
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type {
  RuntimeFinalReleaseGovernanceGateBlockerReport,
  RuntimeFinalReleaseGovernanceGatePolicy,
  RuntimeFinalReleaseGovernanceGateReadinessChecklist,
  RuntimeFinalReleaseGovernanceGateScope,
  RuntimeFinalReleaseGovernanceGateSummary,
} from "./runtimeFinalReleaseGovernanceGateTypes";

function sortKo(rows: readonly string[]): readonly string[] {
  return [...rows].sort((a, b) => a.localeCompare(b, "ko"));
}

function serializeSummary(s: RuntimeFinalReleaseGovernanceGateSummary): Readonly<Record<string, unknown>> {
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
    actualExecutionBlockingEnabled: s.actualExecutionBlockingEnabled,
    actualMergeBlockingEnabled: s.actualMergeBlockingEnabled,
    candidateStatus: s.candidateStatus,
    gateMode: s.gateMode,
    rationaleKo: s.rationaleKo,
    gateBlockers: sortKo(s.gateBlockers),
    recommendations: sortKo(s.recommendations),
  };
}

function serializeScope(scope: RuntimeFinalReleaseGovernanceGateScope): Readonly<Record<string, unknown>> {
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
    actualExecutionBlockingEnabled: scope.actualExecutionBlockingEnabled,
    actualMergeBlockingEnabled: scope.actualMergeBlockingEnabled,
    candidateSourceLayer: scope.candidateSourceLayer,
    candidateTargetLayer: scope.candidateTargetLayer,
    requiredInputMetadata: sortKo(scope.requiredInputMetadata),
    expectedOutputMetadata: sortKo(scope.expectedOutputMetadata),
    allowedGateMetadataScopes: sortKo(scope.allowedGateMetadataScopes),
    forbiddenGateOperations: sortKo(scope.forbiddenGateOperations),
    recommendations: sortKo(scope.recommendations),
  };
}

function serializePolicy(p: RuntimeFinalReleaseGovernanceGatePolicy): Readonly<Record<string, unknown>> {
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
    actualExecutionBlockingEnabled: p.actualExecutionBlockingEnabled,
    actualMergeBlockingEnabled: p.actualMergeBlockingEnabled,
    gateAllowedMode: p.gateAllowedMode,
    operatorReviewBeforeFinalReleaseGate: p.operatorReviewBeforeFinalReleaseGate,
    rollbackReadinessRequired: p.rollbackReadinessRequired,
    auditTraceRequired: p.auditTraceRequired,
    actualExecutionForbidden: p.actualExecutionForbidden,
    actualExecutionRoutingForbidden: p.actualExecutionRoutingForbidden,
    actualReleaseEnforcementForbidden: p.actualReleaseEnforcementForbidden,
    actualApprovalEnforcementForbidden: p.actualApprovalEnforcementForbidden,
    actualShellExecutionForbidden: p.actualShellExecutionForbidden,
    actualAdapterInvocationForbidden: p.actualAdapterInvocationForbidden,
    actualProviderRoutingForbidden: p.actualProviderRoutingForbidden,
    actualQueueControlForbidden: p.actualQueueControlForbidden,
    actualRollbackForbidden: p.actualRollbackForbidden,
    actualExecutionBlockingForbidden: p.actualExecutionBlockingForbidden,
    actualMergeBlockingForbidden: p.actualMergeBlockingForbidden,
    recommendations: sortKo(p.recommendations),
  };
}

function serializeBlockerReport(b: RuntimeFinalReleaseGovernanceGateBlockerReport): Readonly<Record<string, unknown>> {
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
    actualExecutionBlockingEnabled: b.actualExecutionBlockingEnabled,
    actualMergeBlockingEnabled: b.actualMergeBlockingEnabled,
    blockers: sortKo(b.blockers),
    recommendations: sortKo(b.recommendations),
  };
}

function serializeChecklist(c: RuntimeFinalReleaseGovernanceGateReadinessChecklist): Readonly<Record<string, unknown>> {
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
    actualExecutionBlockingEnabled: c.actualExecutionBlockingEnabled,
    actualMergeBlockingEnabled: c.actualMergeBlockingEnabled,
    checklist: sortKo(c.checklist),
    missingRows: sortKo(c.missingRows),
    blockers: sortKo(c.blockers),
    recommendations: sortKo(c.recommendations),
  };
}

export function serializeRuntimeFinalReleaseGovernanceGateDiagnosticBundleFromSemanticReports(
  reports: RuntimeSemanticPlanningReports
): Readonly<{
  runtimeFinalReleaseGovernanceGateSummary: ReturnType<typeof serializeSummary>;
  runtimeFinalReleaseGovernanceGateScope: ReturnType<typeof serializeScope>;
  runtimeFinalReleaseGovernanceGatePolicy: ReturnType<typeof serializePolicy>;
  runtimeFinalReleaseGovernanceGateBlockerReport: ReturnType<typeof serializeBlockerReport>;
  runtimeFinalReleaseGovernanceGateReadinessChecklist: ReturnType<typeof serializeChecklist>;
}> {
  return {
    runtimeFinalReleaseGovernanceGateSummary: serializeSummary(reports.runtimeFinalReleaseGovernanceGateSummary),
    runtimeFinalReleaseGovernanceGateScope: serializeScope(reports.runtimeFinalReleaseGovernanceGateScope),
    runtimeFinalReleaseGovernanceGatePolicy: serializePolicy(reports.runtimeFinalReleaseGovernanceGatePolicy),
    runtimeFinalReleaseGovernanceGateBlockerReport: serializeBlockerReport(
      reports.runtimeFinalReleaseGovernanceGateBlockerReport
    ),
    runtimeFinalReleaseGovernanceGateReadinessChecklist: serializeChecklist(
      reports.runtimeFinalReleaseGovernanceGateReadinessChecklist
    ),
  };
}
