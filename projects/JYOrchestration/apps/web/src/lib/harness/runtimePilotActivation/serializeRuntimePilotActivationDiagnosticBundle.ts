/**
 * H27 — pilot activation 진단 **직렬화 전용**(report 재빌드 없음).
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type {
  RuntimePilotActivationBlockerReport,
  RuntimePilotActivationPolicy,
  RuntimePilotActivationReadinessChecklist,
  RuntimePilotActivationScope,
  RuntimePilotActivationSummary,
} from "./runtimePilotActivationTypes";

function sortKo(rows: readonly string[]): readonly string[] {
  return [...rows].sort((a, b) => a.localeCompare(b, "ko"));
}

function serializeSummary(s: RuntimePilotActivationSummary): Readonly<Record<string, unknown>> {
  return {
    mode: s.mode,
    actualRuntimeOrchestrationEnabled: s.actualRuntimeOrchestrationEnabled,
    actualPilotActivationEnabled: s.actualPilotActivationEnabled,
    actualPilotExecutionEnabled: s.actualPilotExecutionEnabled,
    actualRuntimeAdapterInvocationEnabled: s.actualRuntimeAdapterInvocationEnabled,
    actualSandboxInvocationEnabled: s.actualSandboxInvocationEnabled,
    actualExecutionEnabled: s.actualExecutionEnabled,
    actualProviderRoutingEnabled: s.actualProviderRoutingEnabled,
    actualQueueControlEnabled: s.actualQueueControlEnabled,
    actualRollbackExecutionEnabled: s.actualRollbackExecutionEnabled,
    candidateStatus: s.candidateStatus,
    activationMode: s.activationMode,
    rationaleKo: s.rationaleKo,
    activationBlockers: sortKo(s.activationBlockers),
    recommendations: sortKo(s.recommendations),
  };
}

function serializeScope(scope: RuntimePilotActivationScope): Readonly<Record<string, unknown>> {
  return {
    mode: scope.mode,
    actualRuntimeOrchestrationEnabled: scope.actualRuntimeOrchestrationEnabled,
    actualPilotActivationEnabled: scope.actualPilotActivationEnabled,
    actualPilotExecutionEnabled: scope.actualPilotExecutionEnabled,
    candidateSourceLayer: scope.candidateSourceLayer,
    candidateTargetLayer: scope.candidateTargetLayer,
    requiredInputMetadata: sortKo(scope.requiredInputMetadata),
    expectedOutputMetadata: sortKo(scope.expectedOutputMetadata),
    allowedActivationMetadataScopes: sortKo(scope.allowedActivationMetadataScopes),
    forbiddenActivationOperations: sortKo(scope.forbiddenActivationOperations),
    recommendations: sortKo(scope.recommendations),
  };
}

function serializePolicy(p: RuntimePilotActivationPolicy): Readonly<Record<string, unknown>> {
  return {
    mode: p.mode,
    actualRuntimeOrchestrationEnabled: p.actualRuntimeOrchestrationEnabled,
    actualPilotActivationEnabled: p.actualPilotActivationEnabled,
    actualPilotExecutionEnabled: p.actualPilotExecutionEnabled,
    activationAllowedMode: p.activationAllowedMode,
    operatorReviewBeforeActivation: p.operatorReviewBeforeActivation,
    rollbackReadinessRequired: p.rollbackReadinessRequired,
    auditTraceRequired: p.auditTraceRequired,
    sandboxPreflightRequired: p.sandboxPreflightRequired,
    actualActivationForbidden: p.actualActivationForbidden,
    recommendations: sortKo(p.recommendations),
  };
}

function serializeBlockers(b: RuntimePilotActivationBlockerReport): Readonly<Record<string, unknown>> {
  return {
    mode: b.mode,
    actualRuntimeOrchestrationEnabled: b.actualRuntimeOrchestrationEnabled,
    actualPilotActivationEnabled: b.actualPilotActivationEnabled,
    actualPilotExecutionEnabled: b.actualPilotExecutionEnabled,
    blockers: sortKo(b.blockers),
    recommendations: sortKo(b.recommendations),
  };
}

function serializeChecklist(c: RuntimePilotActivationReadinessChecklist): Readonly<Record<string, unknown>> {
  return {
    mode: c.mode,
    actualRuntimeOrchestrationEnabled: c.actualRuntimeOrchestrationEnabled,
    actualPilotActivationEnabled: c.actualPilotActivationEnabled,
    actualPilotExecutionEnabled: c.actualPilotExecutionEnabled,
    checklist: sortKo(c.checklist),
    blockers: sortKo(c.blockers),
    recommendations: sortKo(c.recommendations),
  };
}

export function serializeRuntimePilotActivationDiagnosticBundleFromSemanticReports(
  reports: RuntimeSemanticPlanningReports
): Readonly<{
  runtimePilotActivationSummary: ReturnType<typeof serializeSummary>;
  runtimePilotActivationScope: ReturnType<typeof serializeScope>;
  runtimePilotActivationPolicy: ReturnType<typeof serializePolicy>;
  runtimePilotActivationBlockerReport: ReturnType<typeof serializeBlockers>;
  runtimePilotActivationReadinessChecklist: ReturnType<typeof serializeChecklist>;
}> {
  return {
    runtimePilotActivationSummary: serializeSummary(reports.runtimePilotActivationSummary),
    runtimePilotActivationScope: serializeScope(reports.runtimePilotActivationScope),
    runtimePilotActivationPolicy: serializePolicy(reports.runtimePilotActivationPolicy),
    runtimePilotActivationBlockerReport: serializeBlockers(reports.runtimePilotActivationBlockerReport),
    runtimePilotActivationReadinessChecklist: serializeChecklist(
      reports.runtimePilotActivationReadinessChecklist
    ),
  };
}
