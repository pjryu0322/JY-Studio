/**
 * H42 — limited pilot boundary 진단 **직렬화 전용**(report 재빌드 없음).
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import { SERIALIZED_RUNTIME_LIMITED_PILOT_BOUNDARY_ACTUAL_FLAGS } from "./runtimeLimitedPilotBoundaryConstants";
import type {
  RuntimeLimitedPilotBoundaryBlockerReport,
  RuntimeLimitedPilotBoundaryPolicy,
  RuntimeLimitedPilotBoundaryScope,
  RuntimeLimitedPilotBoundarySummary,
  RuntimeLimitedPilotInputContract,
  RuntimeLimitedPilotOutputContract,
  RuntimeLimitedPilotReadinessChecklist,
} from "./runtimeLimitedPilotBoundaryTypes";

function sortKo(rows: readonly string[]): readonly string[] {
  return [...rows].sort((a, b) => a.localeCompare(b, "ko"));
}

function serializeSummary(s: RuntimeLimitedPilotBoundarySummary): Readonly<Record<string, unknown>> {
  return {
    mode: s.mode,
    ...SERIALIZED_RUNTIME_LIMITED_PILOT_BOUNDARY_ACTUAL_FLAGS,
    candidateStatus: s.candidateStatus,
    pilotBoundaryMode: s.pilotBoundaryMode,
    rationaleKo: s.rationaleKo,
    pilotBoundaryBlockers: sortKo(s.pilotBoundaryBlockers),
    recommendations: sortKo(s.recommendations),
  };
}

function serializeScope(scope: RuntimeLimitedPilotBoundaryScope): Readonly<Record<string, unknown>> {
  return {
    mode: scope.mode,
    ...SERIALIZED_RUNTIME_LIMITED_PILOT_BOUNDARY_ACTUAL_FLAGS,
    candidateSourceLayer: scope.candidateSourceLayer,
    candidateTargetLayer: scope.candidateTargetLayer,
    requiredPilotBoundaryInputs: sortKo(scope.requiredPilotBoundaryInputs),
    expectedPilotBoundaryOutputs: sortKo(scope.expectedPilotBoundaryOutputs),
    allowedPilotBoundaryMetadataScopes: sortKo(scope.allowedPilotBoundaryMetadataScopes),
    forbiddenPilotBoundaryOperations: sortKo(scope.forbiddenPilotBoundaryOperations),
    recommendations: sortKo(scope.recommendations),
  };
}

function serializePolicy(p: RuntimeLimitedPilotBoundaryPolicy): Readonly<Record<string, unknown>> {
  return {
    mode: p.mode,
    ...SERIALIZED_RUNTIME_LIMITED_PILOT_BOUNDARY_ACTUAL_FLAGS,
    pilotBoundaryAllowedMode: p.pilotBoundaryAllowedMode,
    operatorReviewBeforeLimitedPilot: p.operatorReviewBeforeLimitedPilot,
    rollbackReadinessRequired: p.rollbackReadinessRequired,
    auditTraceRequired: p.auditTraceRequired,
    actualRuntimeOrchestrationForbidden: p.actualRuntimeOrchestrationForbidden,
    actualControlledActivationForbidden: p.actualControlledActivationForbidden,
    actualPilotActivationForbidden: p.actualPilotActivationForbidden,
    actualPilotExecutionForbidden: p.actualPilotExecutionForbidden,
    actualIsolatedRunnerInvocationForbidden: p.actualIsolatedRunnerInvocationForbidden,
    actualIsolatedRunnerExecutionForbidden: p.actualIsolatedRunnerExecutionForbidden,
    actualDryRunRunnerInvocationForbidden: p.actualDryRunRunnerInvocationForbidden,
    actualNoopShellExecutionForbidden: p.actualNoopShellExecutionForbidden,
    actualExecutionShellExecutionForbidden: p.actualExecutionShellExecutionForbidden,
    actualAdapterInvocationForbidden: p.actualAdapterInvocationForbidden,
    actualSandboxInvocationForbidden: p.actualSandboxInvocationForbidden,
    actualExecutionForbidden: p.actualExecutionForbidden,
    actualExecutionRoutingForbidden: p.actualExecutionRoutingForbidden,
    actualProviderRoutingForbidden: p.actualProviderRoutingForbidden,
    actualQueueControlForbidden: p.actualQueueControlForbidden,
    actualRollbackForbidden: p.actualRollbackForbidden,
    actualReleaseEnforcementForbidden: p.actualReleaseEnforcementForbidden,
    actualApprovalEnforcementForbidden: p.actualApprovalEnforcementForbidden,
    actualExecutionBlockingForbidden: p.actualExecutionBlockingForbidden,
    actualMergeBlockingForbidden: p.actualMergeBlockingForbidden,
    recommendations: sortKo(p.recommendations),
  };
}

function serializeContract(
  c: RuntimeLimitedPilotInputContract | RuntimeLimitedPilotOutputContract
): Readonly<Record<string, unknown>> {
  return {
    mode: c.mode,
    ...SERIALIZED_RUNTIME_LIMITED_PILOT_BOUNDARY_ACTUAL_FLAGS,
    contractRows: sortKo(c.contractRows),
    recommendations: sortKo(c.recommendations),
  };
}

function serializeBlockerReport(
  b: RuntimeLimitedPilotBoundaryBlockerReport
): Readonly<Record<string, unknown>> {
  return {
    mode: b.mode,
    ...SERIALIZED_RUNTIME_LIMITED_PILOT_BOUNDARY_ACTUAL_FLAGS,
    blockers: sortKo(b.blockers),
    recommendations: sortKo(b.recommendations),
  };
}

function serializeChecklist(c: RuntimeLimitedPilotReadinessChecklist): Readonly<Record<string, unknown>> {
  return {
    mode: c.mode,
    ...SERIALIZED_RUNTIME_LIMITED_PILOT_BOUNDARY_ACTUAL_FLAGS,
    checklist: sortKo(c.checklist),
    missingRows: sortKo(c.missingRows),
    blockers: sortKo(c.blockers),
    recommendations: sortKo(c.recommendations),
  };
}

export function serializeRuntimeLimitedPilotBoundaryDiagnosticBundleFromSemanticReports(
  reports: RuntimeSemanticPlanningReports
): Readonly<{
  runtimeLimitedPilotBoundarySummary: ReturnType<typeof serializeSummary>;
  runtimeLimitedPilotBoundaryScope: ReturnType<typeof serializeScope>;
  runtimeLimitedPilotBoundaryPolicy: ReturnType<typeof serializePolicy>;
  runtimeLimitedPilotInputContract: ReturnType<typeof serializeContract>;
  runtimeLimitedPilotOutputContract: ReturnType<typeof serializeContract>;
  runtimeLimitedPilotBoundaryBlockerReport: ReturnType<typeof serializeBlockerReport>;
  runtimeLimitedPilotReadinessChecklist: ReturnType<typeof serializeChecklist>;
}> {
  return {
    runtimeLimitedPilotBoundarySummary: serializeSummary(reports.runtimeLimitedPilotBoundarySummary),
    runtimeLimitedPilotBoundaryScope: serializeScope(reports.runtimeLimitedPilotBoundaryScope),
    runtimeLimitedPilotBoundaryPolicy: serializePolicy(reports.runtimeLimitedPilotBoundaryPolicy),
    runtimeLimitedPilotInputContract: serializeContract(reports.runtimeLimitedPilotInputContract),
    runtimeLimitedPilotOutputContract: serializeContract(reports.runtimeLimitedPilotOutputContract),
    runtimeLimitedPilotBoundaryBlockerReport: serializeBlockerReport(
      reports.runtimeLimitedPilotBoundaryBlockerReport
    ),
    runtimeLimitedPilotReadinessChecklist: serializeChecklist(reports.runtimeLimitedPilotReadinessChecklist),
  };
}

export type SerializedRuntimeLimitedPilotBoundaryDiag = ReturnType<
  typeof serializeRuntimeLimitedPilotBoundaryDiagnosticBundleFromSemanticReports
>;
