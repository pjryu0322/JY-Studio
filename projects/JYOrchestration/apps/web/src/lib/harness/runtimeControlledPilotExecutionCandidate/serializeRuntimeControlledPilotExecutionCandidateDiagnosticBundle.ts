/**
 * H45 / H45.5 — controlled pilot execution candidate 진단 **직렬화 전용**(report 재빌드 없음).
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import { SERIALIZED_RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_ACTUAL_FLAGS } from "./runtimeControlledPilotExecutionCandidateConstants";
import type {
  RuntimeControlledPilotExecutionCandidateAlignmentReport,
  RuntimeControlledPilotExecutionCandidateBlockerReport,
  RuntimeControlledPilotExecutionCandidateFinalSafetyGate,
  RuntimeControlledPilotExecutionCandidatePolicy,
  RuntimeControlledPilotExecutionCandidateScope,
  RuntimeControlledPilotExecutionCandidateSummary,
  RuntimeControlledPilotExecutionCandidateVerificationReport,
  RuntimeControlledPilotExecutionCandidateViolationReport,
  RuntimeControlledPilotExecutionInputContract,
  RuntimeControlledPilotExecutionOutputContract,
  RuntimeControlledPilotExecutionReadinessChecklist,
  RuntimeFinalRuntimeHandoffBoundary,
} from "./runtimeControlledPilotExecutionCandidateTypes";

function sortKo(rows: readonly string[]): readonly string[] {
  return [...rows].sort((a, b) => a.localeCompare(b, "ko"));
}

function serializeSummary(s: RuntimeControlledPilotExecutionCandidateSummary): Readonly<Record<string, unknown>> {
  return {
    mode: s.mode,
    ...SERIALIZED_RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_ACTUAL_FLAGS,
    candidateStatus: s.candidateStatus,
    executionMode: s.executionMode,
    rationaleKo: s.rationaleKo,
    executionBlockers: sortKo(s.executionBlockers),
    recommendations: sortKo(s.recommendations),
  };
}

function serializeHandoffBoundary(b: RuntimeFinalRuntimeHandoffBoundary): Readonly<Record<string, unknown>> {
  return {
    mode: b.mode,
    ...SERIALIZED_RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_ACTUAL_FLAGS,
    boundarySourceLayer: b.boundarySourceLayer,
    boundaryTargetLayer: b.boundaryTargetLayer,
    requiredHandoffInputs: sortKo(b.requiredHandoffInputs),
    expectedHandoffOutputs: sortKo(b.expectedHandoffOutputs),
    allowedHandoffMetadataScopes: sortKo(b.allowedHandoffMetadataScopes),
    forbiddenHandoffOperations: sortKo(b.forbiddenHandoffOperations),
    recommendations: sortKo(b.recommendations),
  };
}

function serializeScope(scope: RuntimeControlledPilotExecutionCandidateScope): Readonly<Record<string, unknown>> {
  return {
    mode: scope.mode,
    ...SERIALIZED_RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_ACTUAL_FLAGS,
    candidateSourceLayer: scope.candidateSourceLayer,
    candidateTargetLayer: scope.candidateTargetLayer,
    requiredCandidateInputs: sortKo(scope.requiredCandidateInputs),
    expectedCandidateOutputs: sortKo(scope.expectedCandidateOutputs),
    allowedCandidateMetadataScopes: sortKo(scope.allowedCandidateMetadataScopes),
    forbiddenCandidateOperations: sortKo(scope.forbiddenCandidateOperations),
    recommendations: sortKo(scope.recommendations),
  };
}

function serializePolicy(p: RuntimeControlledPilotExecutionCandidatePolicy): Readonly<Record<string, unknown>> {
  return {
    mode: p.mode,
    ...SERIALIZED_RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_ACTUAL_FLAGS,
    executionAllowedMode: p.executionAllowedMode,
    operatorReviewBeforeControlledPilotExecution: p.operatorReviewBeforeControlledPilotExecution,
    rollbackReadinessRequired: p.rollbackReadinessRequired,
    auditTraceRequired: p.auditTraceRequired,
    actualRuntimeOrchestrationForbidden: p.actualRuntimeOrchestrationForbidden,
    actualControlledActivationForbidden: p.actualControlledActivationForbidden,
    actualPilotActivationForbidden: p.actualPilotActivationForbidden,
    actualPilotExecutionForbidden: p.actualPilotExecutionForbidden,
    actualIsolatedRunnerInvocationForbidden: p.actualIsolatedRunnerInvocationForbidden,
    actualIsolatedRunnerExecutionForbidden: p.actualIsolatedRunnerExecutionForbidden,
    actualDryRunRunnerInvocationForbidden: p.actualDryRunRunnerInvocationForbidden,
    actualDryRunRunnerExecutionForbidden: p.actualDryRunRunnerExecutionForbidden,
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
  c: RuntimeControlledPilotExecutionInputContract | RuntimeControlledPilotExecutionOutputContract
): Readonly<Record<string, unknown>> {
  return {
    mode: c.mode,
    ...SERIALIZED_RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_ACTUAL_FLAGS,
    contractRows: sortKo(c.contractRows),
    recommendations: sortKo(c.recommendations),
  };
}

function serializeBlockerReport(
  b: RuntimeControlledPilotExecutionCandidateBlockerReport
): Readonly<Record<string, unknown>> {
  return {
    mode: b.mode,
    ...SERIALIZED_RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_ACTUAL_FLAGS,
    blockers: sortKo(b.blockers),
    recommendations: sortKo(b.recommendations),
  };
}

function serializeChecklist(c: RuntimeControlledPilotExecutionReadinessChecklist): Readonly<Record<string, unknown>> {
  return {
    mode: c.mode,
    ...SERIALIZED_RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_ACTUAL_FLAGS,
    checklist: sortKo(c.checklist),
    missingRows: sortKo(c.missingRows),
    blockers: sortKo(c.blockers),
    recommendations: sortKo(c.recommendations),
  };
}

function serializeViolationReport(
  v: RuntimeControlledPilotExecutionCandidateViolationReport
): Readonly<Record<string, unknown>> {
  return {
    mode: v.mode,
    ...SERIALIZED_RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_ACTUAL_FLAGS,
    actualFlagViolations: sortKo(v.actualFlagViolations),
    policyViolations: sortKo(v.policyViolations),
    wordingRiskFindings: sortKo(v.wordingRiskFindings),
    recommendations: sortKo(v.recommendations),
  };
}

function serializeVerificationReport(
  r: RuntimeControlledPilotExecutionCandidateVerificationReport
): Readonly<Record<string, unknown>> {
  return {
    mode: r.mode,
    ...SERIALIZED_RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_ACTUAL_FLAGS,
    verificationStatus: r.verificationStatus,
    findings: sortKo(r.findings),
    recommendations: sortKo(r.recommendations),
  };
}

function serializeAlignmentReport(
  a: RuntimeControlledPilotExecutionCandidateAlignmentReport
): Readonly<Record<string, unknown>> {
  return {
    mode: a.mode,
    ...SERIALIZED_RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_ACTUAL_FLAGS,
    alignmentStatus: a.alignmentStatus,
    findings: sortKo(a.findings),
    recommendations: sortKo(a.recommendations),
  };
}

function serializeFinalSafetyGate(
  g: RuntimeControlledPilotExecutionCandidateFinalSafetyGate
): Readonly<Record<string, unknown>> {
  return {
    mode: g.mode,
    ...SERIALIZED_RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_ACTUAL_FLAGS,
    finalGateStatus: g.finalGateStatus,
    pilotValidationEntryReadiness: g.pilotValidationEntryReadiness,
    checklist: sortKo(g.checklist),
    blockers: sortKo(g.blockers),
    recommendations: sortKo(g.recommendations),
  };
}

export function serializeRuntimeControlledPilotExecutionCandidateDiagnosticBundleFromSemanticReports(
  reports: RuntimeSemanticPlanningReports
): Readonly<{
  runtimeControlledPilotExecutionCandidateSummary: ReturnType<typeof serializeSummary>;
  runtimeFinalRuntimeHandoffBoundary: ReturnType<typeof serializeHandoffBoundary>;
  runtimeControlledPilotExecutionCandidateScope: ReturnType<typeof serializeScope>;
  runtimeControlledPilotExecutionCandidatePolicy: ReturnType<typeof serializePolicy>;
  runtimeControlledPilotExecutionInputContract: ReturnType<typeof serializeContract>;
  runtimeControlledPilotExecutionOutputContract: ReturnType<typeof serializeContract>;
  runtimeControlledPilotExecutionCandidateBlockerReport: ReturnType<typeof serializeBlockerReport>;
  runtimeControlledPilotExecutionReadinessChecklist: ReturnType<typeof serializeChecklist>;
  runtimeControlledPilotExecutionCandidateViolationReport: ReturnType<typeof serializeViolationReport>;
  runtimeControlledPilotExecutionCandidateVerificationReport: ReturnType<typeof serializeVerificationReport>;
  runtimeControlledPilotExecutionCandidateAlignmentReport: ReturnType<typeof serializeAlignmentReport>;
  runtimeControlledPilotExecutionCandidateFinalSafetyGate: ReturnType<typeof serializeFinalSafetyGate>;
}> {
  return {
    runtimeControlledPilotExecutionCandidateSummary: serializeSummary(
      reports.runtimeControlledPilotExecutionCandidateSummary
    ),
    runtimeFinalRuntimeHandoffBoundary: serializeHandoffBoundary(reports.runtimeFinalRuntimeHandoffBoundary),
    runtimeControlledPilotExecutionCandidateScope: serializeScope(
      reports.runtimeControlledPilotExecutionCandidateScope
    ),
    runtimeControlledPilotExecutionCandidatePolicy: serializePolicy(
      reports.runtimeControlledPilotExecutionCandidatePolicy
    ),
    runtimeControlledPilotExecutionInputContract: serializeContract(
      reports.runtimeControlledPilotExecutionInputContract
    ),
    runtimeControlledPilotExecutionOutputContract: serializeContract(
      reports.runtimeControlledPilotExecutionOutputContract
    ),
    runtimeControlledPilotExecutionCandidateBlockerReport: serializeBlockerReport(
      reports.runtimeControlledPilotExecutionCandidateBlockerReport
    ),
    runtimeControlledPilotExecutionReadinessChecklist: serializeChecklist(
      reports.runtimeControlledPilotExecutionReadinessChecklist
    ),
    runtimeControlledPilotExecutionCandidateViolationReport: serializeViolationReport(
      reports.runtimeControlledPilotExecutionCandidateViolationReport
    ),
    runtimeControlledPilotExecutionCandidateVerificationReport: serializeVerificationReport(
      reports.runtimeControlledPilotExecutionCandidateVerificationReport
    ),
    runtimeControlledPilotExecutionCandidateAlignmentReport: serializeAlignmentReport(
      reports.runtimeControlledPilotExecutionCandidateAlignmentReport
    ),
    runtimeControlledPilotExecutionCandidateFinalSafetyGate: serializeFinalSafetyGate(
      reports.runtimeControlledPilotExecutionCandidateFinalSafetyGate
    ),
  };
}

export type SerializedRuntimeControlledPilotExecutionCandidateDiag = ReturnType<
  typeof serializeRuntimeControlledPilotExecutionCandidateDiagnosticBundleFromSemanticReports
>;
