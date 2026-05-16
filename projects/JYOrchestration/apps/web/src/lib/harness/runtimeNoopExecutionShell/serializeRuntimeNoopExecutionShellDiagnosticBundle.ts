/**
 * H31 — no-op execution shell 진단 **직렬화 전용**(report 재빌드 없음).
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type {
  RuntimeNoopExecutionShellBlockerReport,
  RuntimeNoopExecutionShellPolicy,
  RuntimeNoopExecutionShellReadinessChecklist,
  RuntimeNoopExecutionShellScope,
  RuntimeNoopExecutionShellSummary,
} from "./runtimeNoopExecutionShellTypes";

function sortKo(rows: readonly string[]): readonly string[] {
  return [...rows].sort((a, b) => a.localeCompare(b, "ko"));
}

function serializeSummary(s: RuntimeNoopExecutionShellSummary): Readonly<Record<string, unknown>> {
  return {
    mode: s.mode,
    actualRuntimeOrchestrationEnabled: s.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: s.actualPilotExecutionEnabled,
    actualIsolatedRunnerInvocationEnabled: s.actualIsolatedRunnerInvocationEnabled,
    actualIsolatedRunnerExecutionEnabled: s.actualIsolatedRunnerExecutionEnabled,
    actualDryRunRunnerInvocationEnabled: s.actualDryRunRunnerInvocationEnabled,
    actualDryRunRunnerExecutionEnabled: s.actualDryRunRunnerExecutionEnabled,
    actualNoopShellExecutionEnabled: s.actualNoopShellExecutionEnabled,
    actualExecutionShellExecutionEnabled: s.actualExecutionShellExecutionEnabled,
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

function serializeScope(scope: RuntimeNoopExecutionShellScope): Readonly<Record<string, unknown>> {
  return {
    mode: scope.mode,
    actualRuntimeOrchestrationEnabled: scope.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: scope.actualPilotExecutionEnabled,
    actualIsolatedRunnerInvocationEnabled: scope.actualIsolatedRunnerInvocationEnabled,
    actualIsolatedRunnerExecutionEnabled: scope.actualIsolatedRunnerExecutionEnabled,
    actualDryRunRunnerInvocationEnabled: scope.actualDryRunRunnerInvocationEnabled,
    actualDryRunRunnerExecutionEnabled: scope.actualDryRunRunnerExecutionEnabled,
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
    allowedShellMetadataScopes: sortKo(scope.allowedShellMetadataScopes),
    forbiddenShellOperations: sortKo(scope.forbiddenShellOperations),
    recommendations: sortKo(scope.recommendations),
  };
}

function serializePolicy(p: RuntimeNoopExecutionShellPolicy): Readonly<Record<string, unknown>> {
  return {
    mode: p.mode,
    actualRuntimeOrchestrationEnabled: p.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: p.actualPilotExecutionEnabled,
    actualIsolatedRunnerInvocationEnabled: p.actualIsolatedRunnerInvocationEnabled,
    actualIsolatedRunnerExecutionEnabled: p.actualIsolatedRunnerExecutionEnabled,
    actualDryRunRunnerInvocationEnabled: p.actualDryRunRunnerInvocationEnabled,
    actualDryRunRunnerExecutionEnabled: p.actualDryRunRunnerExecutionEnabled,
    actualNoopShellExecutionEnabled: p.actualNoopShellExecutionEnabled,
    actualExecutionShellExecutionEnabled: p.actualExecutionShellExecutionEnabled,
    actualRuntimeAdapterInvocationEnabled: p.actualRuntimeAdapterInvocationEnabled,
    actualExecutionEnabled: p.actualExecutionEnabled,
    actualProviderRoutingEnabled: p.actualProviderRoutingEnabled,
    actualQueueControlEnabled: p.actualQueueControlEnabled,
    actualRollbackExecutionEnabled: p.actualRollbackExecutionEnabled,
    shellAllowedMode: p.shellAllowedMode,
    operatorReviewBeforeShell: p.operatorReviewBeforeShell,
    rollbackReadinessRequired: p.rollbackReadinessRequired,
    auditTraceRequired: p.auditTraceRequired,
    actualShellExecutionForbidden: p.actualShellExecutionForbidden,
    actualRunnerInvocationForbidden: p.actualRunnerInvocationForbidden,
    actualAdapterInvocationForbidden: p.actualAdapterInvocationForbidden,
    actualExecutionForbidden: p.actualExecutionForbidden,
    recommendations: sortKo(p.recommendations),
  };
}

function serializeBlockerReport(b: RuntimeNoopExecutionShellBlockerReport): Readonly<Record<string, unknown>> {
  return {
    mode: b.mode,
    actualRuntimeOrchestrationEnabled: b.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: b.actualPilotExecutionEnabled,
    actualIsolatedRunnerInvocationEnabled: b.actualIsolatedRunnerInvocationEnabled,
    actualIsolatedRunnerExecutionEnabled: b.actualIsolatedRunnerExecutionEnabled,
    actualDryRunRunnerInvocationEnabled: b.actualDryRunRunnerInvocationEnabled,
    actualDryRunRunnerExecutionEnabled: b.actualDryRunRunnerExecutionEnabled,
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

function serializeChecklist(c: RuntimeNoopExecutionShellReadinessChecklist): Readonly<Record<string, unknown>> {
  return {
    mode: c.mode,
    actualRuntimeOrchestrationEnabled: c.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: c.actualPilotExecutionEnabled,
    actualIsolatedRunnerInvocationEnabled: c.actualIsolatedRunnerInvocationEnabled,
    actualIsolatedRunnerExecutionEnabled: c.actualIsolatedRunnerExecutionEnabled,
    actualDryRunRunnerInvocationEnabled: c.actualDryRunRunnerInvocationEnabled,
    actualDryRunRunnerExecutionEnabled: c.actualDryRunRunnerExecutionEnabled,
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

export function serializeRuntimeNoopExecutionShellDiagnosticBundleFromSemanticReports(
  reports: RuntimeSemanticPlanningReports
): Readonly<{
  runtimeNoopExecutionShellSummary: ReturnType<typeof serializeSummary>;
  runtimeNoopExecutionShellScope: ReturnType<typeof serializeScope>;
  runtimeNoopExecutionShellPolicy: ReturnType<typeof serializePolicy>;
  runtimeNoopExecutionShellBlockerReport: ReturnType<typeof serializeBlockerReport>;
  runtimeNoopExecutionShellReadinessChecklist: ReturnType<typeof serializeChecklist>;
}> {
  return {
    runtimeNoopExecutionShellSummary: serializeSummary(reports.runtimeNoopExecutionShellSummary),
    runtimeNoopExecutionShellScope: serializeScope(reports.runtimeNoopExecutionShellScope),
    runtimeNoopExecutionShellPolicy: serializePolicy(reports.runtimeNoopExecutionShellPolicy),
    runtimeNoopExecutionShellBlockerReport: serializeBlockerReport(reports.runtimeNoopExecutionShellBlockerReport),
    runtimeNoopExecutionShellReadinessChecklist: serializeChecklist(
      reports.runtimeNoopExecutionShellReadinessChecklist
    ),
  };
}
