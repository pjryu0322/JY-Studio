/**
 * H42 / H42.5 — limited pilot boundary 진단 **직렬화 전용**(report 재빌드 없음).
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import { SERIALIZED_RUNTIME_LIMITED_PILOT_BOUNDARY_ACTUAL_FLAGS } from "./runtimeLimitedPilotBoundaryConstants";
import type {
  RuntimeLimitedPilotBoundaryAlignmentReport,
  RuntimeLimitedPilotBoundaryBlockerReport,
  RuntimeLimitedPilotBoundaryFinalSafetyGate,
  RuntimeLimitedPilotBoundaryPolicy,
  RuntimeLimitedPilotBoundaryScope,
  RuntimeLimitedPilotBoundarySummary,
  RuntimeLimitedPilotBoundaryVerificationReport,
  RuntimeLimitedPilotBoundaryViolationReport,
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

function serializeViolationReport(
  v: RuntimeLimitedPilotBoundaryViolationReport
): Readonly<Record<string, unknown>> {
  return {
    mode: v.mode,
    ...SERIALIZED_RUNTIME_LIMITED_PILOT_BOUNDARY_ACTUAL_FLAGS,
    actualFlagViolations: sortKo(v.actualFlagViolations),
    policyViolations: sortKo(v.policyViolations),
    wordingRiskFindings: sortKo(v.wordingRiskFindings),
    recommendations: sortKo(v.recommendations),
  };
}

function serializeVerificationReport(
  r: RuntimeLimitedPilotBoundaryVerificationReport
): Readonly<Record<string, unknown>> {
  return {
    mode: r.mode,
    ...SERIALIZED_RUNTIME_LIMITED_PILOT_BOUNDARY_ACTUAL_FLAGS,
    verificationStatus: r.verificationStatus,
    findings: sortKo(r.findings),
    recommendations: sortKo(r.recommendations),
  };
}

function serializeAlignmentReport(
  a: RuntimeLimitedPilotBoundaryAlignmentReport
): Readonly<Record<string, unknown>> {
  return {
    mode: a.mode,
    ...SERIALIZED_RUNTIME_LIMITED_PILOT_BOUNDARY_ACTUAL_FLAGS,
    alignmentStatus: a.alignmentStatus,
    findings: sortKo(a.findings),
    recommendations: sortKo(a.recommendations),
  };
}

function serializeFinalSafetyGate(
  g: RuntimeLimitedPilotBoundaryFinalSafetyGate
): Readonly<Record<string, unknown>> {
  return {
    mode: g.mode,
    ...SERIALIZED_RUNTIME_LIMITED_PILOT_BOUNDARY_ACTUAL_FLAGS,
    finalGateStatus: g.finalGateStatus,
    h43EntryReadiness: g.h43EntryReadiness,
    checklist: sortKo(g.checklist),
    blockers: sortKo(g.blockers),
    recommendations: sortKo(g.recommendations),
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
  runtimeLimitedPilotBoundaryViolationReport: ReturnType<typeof serializeViolationReport>;
  runtimeLimitedPilotBoundaryVerificationReport: ReturnType<typeof serializeVerificationReport>;
  runtimeLimitedPilotBoundaryAlignmentReport: ReturnType<typeof serializeAlignmentReport>;
  runtimeLimitedPilotBoundaryFinalSafetyGate: ReturnType<typeof serializeFinalSafetyGate>;
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
    runtimeLimitedPilotBoundaryViolationReport: serializeViolationReport(
      reports.runtimeLimitedPilotBoundaryViolationReport
    ),
    runtimeLimitedPilotBoundaryVerificationReport: serializeVerificationReport(
      reports.runtimeLimitedPilotBoundaryVerificationReport
    ),
    runtimeLimitedPilotBoundaryAlignmentReport: serializeAlignmentReport(
      reports.runtimeLimitedPilotBoundaryAlignmentReport
    ),
    runtimeLimitedPilotBoundaryFinalSafetyGate: serializeFinalSafetyGate(
      reports.runtimeLimitedPilotBoundaryFinalSafetyGate
    ),
  };
}

export type SerializedRuntimeLimitedPilotBoundaryDiag = ReturnType<
  typeof serializeRuntimeLimitedPilotBoundaryDiagnosticBundleFromSemanticReports
>;
