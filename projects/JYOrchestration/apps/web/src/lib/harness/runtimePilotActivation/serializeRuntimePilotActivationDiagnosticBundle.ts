/**
 * H27 / H27.5 — pilot activation 진단 **직렬화 전용**(report 재빌드 없음).
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type {
  RuntimePilotActivationBlockerReport,
  RuntimePilotActivationBoundaryViolationReport,
  RuntimePilotActivationFinalSafetyGate,
  RuntimePilotActivationPolicy,
  RuntimePilotActivationReadinessChecklist,
  RuntimePilotActivationReadinessVerificationReport,
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

function serializeFinalGate(g: RuntimePilotActivationFinalSafetyGate): Readonly<Record<string, unknown>> {
  return {
    mode: g.mode,
    actualRuntimeOrchestrationEnabled: g.actualRuntimeOrchestrationEnabled,
    actualPilotActivationEnabled: g.actualPilotActivationEnabled,
    actualPilotExecutionEnabled: g.actualPilotExecutionEnabled,
    actualRuntimeAdapterInvocationEnabled: g.actualRuntimeAdapterInvocationEnabled,
    actualSandboxInvocationEnabled: g.actualSandboxInvocationEnabled,
    actualExecutionEnabled: g.actualExecutionEnabled,
    actualProviderRoutingEnabled: g.actualProviderRoutingEnabled,
    actualQueueControlEnabled: g.actualQueueControlEnabled,
    actualRollbackExecutionEnabled: g.actualRollbackExecutionEnabled,
    finalGateStatus: g.finalGateStatus,
    h28EntryReadiness: g.h28EntryReadiness,
    checklist: sortKo(g.checklist),
    blockers: sortKo(g.blockers),
    recommendations: sortKo(g.recommendations),
  };
}

function serializeBoundaryViolations(
  v: RuntimePilotActivationBoundaryViolationReport
): Readonly<Record<string, unknown>> {
  return {
    mode: v.mode,
    actualRuntimeOrchestrationEnabled: v.actualRuntimeOrchestrationEnabled,
    actualPilotActivationEnabled: v.actualPilotActivationEnabled,
    actualPilotExecutionEnabled: v.actualPilotExecutionEnabled,
    actualFlagViolations: sortKo(v.actualFlagViolations),
    wordingRiskFindings: sortKo(v.wordingRiskFindings),
    recommendations: sortKo(v.recommendations),
  };
}

function serializeReadinessVerification(
  v: RuntimePilotActivationReadinessVerificationReport
): Readonly<Record<string, unknown>> {
  return {
    mode: v.mode,
    actualRuntimeOrchestrationEnabled: v.actualRuntimeOrchestrationEnabled,
    actualPilotActivationEnabled: v.actualPilotActivationEnabled,
    actualPilotExecutionEnabled: v.actualPilotExecutionEnabled,
    verificationStatus: v.verificationStatus,
    findings: sortKo(v.findings),
    recommendations: sortKo(v.recommendations),
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
  runtimePilotActivationFinalSafetyGate: ReturnType<typeof serializeFinalGate>;
  runtimePilotActivationBoundaryViolationReport: ReturnType<typeof serializeBoundaryViolations>;
  runtimePilotActivationReadinessVerificationReport: ReturnType<typeof serializeReadinessVerification>;
}> {
  return {
    runtimePilotActivationSummary: serializeSummary(reports.runtimePilotActivationSummary),
    runtimePilotActivationScope: serializeScope(reports.runtimePilotActivationScope),
    runtimePilotActivationPolicy: serializePolicy(reports.runtimePilotActivationPolicy),
    runtimePilotActivationBlockerReport: serializeBlockers(reports.runtimePilotActivationBlockerReport),
    runtimePilotActivationReadinessChecklist: serializeChecklist(
      reports.runtimePilotActivationReadinessChecklist
    ),
    runtimePilotActivationFinalSafetyGate: serializeFinalGate(reports.runtimePilotActivationFinalSafetyGate),
    runtimePilotActivationBoundaryViolationReport: serializeBoundaryViolations(
      reports.runtimePilotActivationBoundaryViolationReport
    ),
    runtimePilotActivationReadinessVerificationReport: serializeReadinessVerification(
      reports.runtimePilotActivationReadinessVerificationReport
    ),
  };
}
