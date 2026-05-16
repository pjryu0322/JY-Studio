/**
 * H29 — runner invocation 진단 **직렬화 전용**(report 재빌드 없음).
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type {
  RuntimeRunnerInvocationBlockerReport,
  RuntimeRunnerInvocationPolicy,
  RuntimeRunnerInvocationReadinessChecklist,
  RuntimeRunnerInvocationScope,
  RuntimeRunnerInvocationSummary,
} from "./runtimeRunnerInvocationTypes";

function sortKo(rows: readonly string[]): readonly string[] {
  return [...rows].sort((a, b) => a.localeCompare(b, "ko"));
}

function serializeSummary(s: RuntimeRunnerInvocationSummary): Readonly<Record<string, unknown>> {
  return {
    mode: s.mode,
    actualRuntimeOrchestrationEnabled: s.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: s.actualPilotExecutionEnabled,
    actualIsolatedRunnerInvocationEnabled: s.actualIsolatedRunnerInvocationEnabled,
    actualIsolatedRunnerExecutionEnabled: s.actualIsolatedRunnerExecutionEnabled,
    actualDryRunRunnerInvocationEnabled: s.actualDryRunRunnerInvocationEnabled,
    actualDryRunRunnerExecutionEnabled: s.actualDryRunRunnerExecutionEnabled,
    actualRuntimeAdapterInvocationEnabled: s.actualRuntimeAdapterInvocationEnabled,
    actualExecutionEnabled: s.actualExecutionEnabled,
    actualProviderRoutingEnabled: s.actualProviderRoutingEnabled,
    actualQueueControlEnabled: s.actualQueueControlEnabled,
    actualRollbackExecutionEnabled: s.actualRollbackExecutionEnabled,
    candidateStatus: s.candidateStatus,
    invocationMode: s.invocationMode,
    rationaleKo: s.rationaleKo,
    invocationBlockers: sortKo(s.invocationBlockers),
    recommendations: sortKo(s.recommendations),
  };
}

function serializeScope(scope: RuntimeRunnerInvocationScope): Readonly<Record<string, unknown>> {
  return {
    mode: scope.mode,
    actualRuntimeOrchestrationEnabled: scope.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: scope.actualPilotExecutionEnabled,
    actualIsolatedRunnerInvocationEnabled: scope.actualIsolatedRunnerInvocationEnabled,
    actualIsolatedRunnerExecutionEnabled: scope.actualIsolatedRunnerExecutionEnabled,
    actualDryRunRunnerInvocationEnabled: scope.actualDryRunRunnerInvocationEnabled,
    actualDryRunRunnerExecutionEnabled: scope.actualDryRunRunnerExecutionEnabled,
    actualRuntimeAdapterInvocationEnabled: scope.actualRuntimeAdapterInvocationEnabled,
    actualExecutionEnabled: scope.actualExecutionEnabled,
    actualProviderRoutingEnabled: scope.actualProviderRoutingEnabled,
    actualQueueControlEnabled: scope.actualQueueControlEnabled,
    actualRollbackExecutionEnabled: scope.actualRollbackExecutionEnabled,
    candidateSourceLayer: scope.candidateSourceLayer,
    candidateTargetLayer: scope.candidateTargetLayer,
    requiredInputMetadata: sortKo(scope.requiredInputMetadata),
    expectedOutputMetadata: sortKo(scope.expectedOutputMetadata),
    allowedInvocationMetadataScopes: sortKo(scope.allowedInvocationMetadataScopes),
    forbiddenInvocationOperations: sortKo(scope.forbiddenInvocationOperations),
    recommendations: sortKo(scope.recommendations),
  };
}

function serializePolicy(p: RuntimeRunnerInvocationPolicy): Readonly<Record<string, unknown>> {
  return {
    mode: p.mode,
    actualRuntimeOrchestrationEnabled: p.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: p.actualPilotExecutionEnabled,
    actualIsolatedRunnerInvocationEnabled: p.actualIsolatedRunnerInvocationEnabled,
    actualIsolatedRunnerExecutionEnabled: p.actualIsolatedRunnerExecutionEnabled,
    actualDryRunRunnerInvocationEnabled: p.actualDryRunRunnerInvocationEnabled,
    actualDryRunRunnerExecutionEnabled: p.actualDryRunRunnerExecutionEnabled,
    actualRuntimeAdapterInvocationEnabled: p.actualRuntimeAdapterInvocationEnabled,
    actualExecutionEnabled: p.actualExecutionEnabled,
    actualProviderRoutingEnabled: p.actualProviderRoutingEnabled,
    actualQueueControlEnabled: p.actualQueueControlEnabled,
    actualRollbackExecutionEnabled: p.actualRollbackExecutionEnabled,
    invocationAllowedMode: p.invocationAllowedMode,
    operatorReviewBeforeInvocation: p.operatorReviewBeforeInvocation,
    rollbackReadinessRequired: p.rollbackReadinessRequired,
    auditTraceRequired: p.auditTraceRequired,
    runnerContractRequired: p.runnerContractRequired,
    runnerSafetyGuardRequired: p.runnerSafetyGuardRequired,
    runnerNoExecutionResultRequired: p.runnerNoExecutionResultRequired,
    actualInvocationForbidden: p.actualInvocationForbidden,
    recommendations: sortKo(p.recommendations),
  };
}

function serializeBlockers(b: RuntimeRunnerInvocationBlockerReport): Readonly<Record<string, unknown>> {
  return {
    mode: b.mode,
    actualRuntimeOrchestrationEnabled: b.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: b.actualPilotExecutionEnabled,
    actualIsolatedRunnerInvocationEnabled: b.actualIsolatedRunnerInvocationEnabled,
    actualIsolatedRunnerExecutionEnabled: b.actualIsolatedRunnerExecutionEnabled,
    actualDryRunRunnerInvocationEnabled: b.actualDryRunRunnerInvocationEnabled,
    actualDryRunRunnerExecutionEnabled: b.actualDryRunRunnerExecutionEnabled,
    actualRuntimeAdapterInvocationEnabled: b.actualRuntimeAdapterInvocationEnabled,
    actualExecutionEnabled: b.actualExecutionEnabled,
    actualProviderRoutingEnabled: b.actualProviderRoutingEnabled,
    actualQueueControlEnabled: b.actualQueueControlEnabled,
    actualRollbackExecutionEnabled: b.actualRollbackExecutionEnabled,
    blockers: sortKo(b.blockers),
    recommendations: sortKo(b.recommendations),
  };
}

function serializeChecklist(c: RuntimeRunnerInvocationReadinessChecklist): Readonly<Record<string, unknown>> {
  return {
    mode: c.mode,
    actualRuntimeOrchestrationEnabled: c.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: c.actualPilotExecutionEnabled,
    actualIsolatedRunnerInvocationEnabled: c.actualIsolatedRunnerInvocationEnabled,
    actualIsolatedRunnerExecutionEnabled: c.actualIsolatedRunnerExecutionEnabled,
    actualDryRunRunnerInvocationEnabled: c.actualDryRunRunnerInvocationEnabled,
    actualDryRunRunnerExecutionEnabled: c.actualDryRunRunnerExecutionEnabled,
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

export function serializeRuntimeRunnerInvocationDiagnosticBundleFromSemanticReports(
  reports: RuntimeSemanticPlanningReports
): Readonly<{
  runtimeRunnerInvocationSummary: ReturnType<typeof serializeSummary>;
  runtimeRunnerInvocationScope: ReturnType<typeof serializeScope>;
  runtimeRunnerInvocationPolicy: ReturnType<typeof serializePolicy>;
  runtimeRunnerInvocationBlockerReport: ReturnType<typeof serializeBlockers>;
  runtimeRunnerInvocationReadinessChecklist: ReturnType<typeof serializeChecklist>;
}> {
  return {
    runtimeRunnerInvocationSummary: serializeSummary(reports.runtimeRunnerInvocationSummary),
    runtimeRunnerInvocationScope: serializeScope(reports.runtimeRunnerInvocationScope),
    runtimeRunnerInvocationPolicy: serializePolicy(reports.runtimeRunnerInvocationPolicy),
    runtimeRunnerInvocationBlockerReport: serializeBlockers(reports.runtimeRunnerInvocationBlockerReport),
    runtimeRunnerInvocationReadinessChecklist: serializeChecklist(
      reports.runtimeRunnerInvocationReadinessChecklist
    ),
  };
}
