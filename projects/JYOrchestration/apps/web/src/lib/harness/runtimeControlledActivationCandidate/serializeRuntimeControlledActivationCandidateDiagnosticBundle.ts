/**
 * H41 / H41.5 — controlled activation candidate 진단 **직렬화 전용**(report 재빌드 없음).
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import { SERIALIZED_RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_ACTUAL_FLAGS } from "./runtimeControlledActivationCandidateConstants";
import type {
  RuntimeControlledActivationCandidateAlignmentReport,
  RuntimeControlledActivationCandidateBlockerReport,
  RuntimeControlledActivationCandidateFinalSafetyGate,
  RuntimeControlledActivationCandidatePolicy,
  RuntimeControlledActivationCandidateScope,
  RuntimeControlledActivationCandidateSummary,
  RuntimeControlledActivationCandidateVerificationReport,
  RuntimeControlledActivationCandidateViolationReport,
  RuntimeControlledActivationReadinessChecklist,
  RuntimeControlHandoffBoundary,
} from "./runtimeControlledActivationCandidateTypes";

function sortKo(rows: readonly string[]): readonly string[] {
  return [...rows].sort((a, b) => a.localeCompare(b, "ko"));
}

function serializeSummary(s: RuntimeControlledActivationCandidateSummary): Readonly<Record<string, unknown>> {
  return {
    mode: s.mode,
    ...SERIALIZED_RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_ACTUAL_FLAGS,
    candidateStatus: s.candidateStatus,
    activationMode: s.activationMode,
    rationaleKo: s.rationaleKo,
    activationBlockers: sortKo(s.activationBlockers),
    recommendations: sortKo(s.recommendations),
  };
}

function serializeHandoffBoundary(b: RuntimeControlHandoffBoundary): Readonly<Record<string, unknown>> {
  return {
    mode: b.mode,
    ...SERIALIZED_RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_ACTUAL_FLAGS,
    boundarySourceLayer: b.boundarySourceLayer,
    boundaryTargetLayer: b.boundaryTargetLayer,
    requiredInputMetadata: sortKo(b.requiredInputMetadata),
    expectedOutputMetadata: sortKo(b.expectedOutputMetadata),
    allowedHandoffMetadataScopes: sortKo(b.allowedHandoffMetadataScopes),
    forbiddenHandoffOperations: sortKo(b.forbiddenHandoffOperations),
    recommendations: sortKo(b.recommendations),
  };
}

function serializeScope(scope: RuntimeControlledActivationCandidateScope): Readonly<Record<string, unknown>> {
  return {
    mode: scope.mode,
    ...SERIALIZED_RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_ACTUAL_FLAGS,
    candidateSourceLayer: scope.candidateSourceLayer,
    candidateTargetLayer: scope.candidateTargetLayer,
    requiredCandidateInputs: sortKo(scope.requiredCandidateInputs),
    expectedCandidateOutputs: sortKo(scope.expectedCandidateOutputs),
    allowedCandidateMetadataScopes: sortKo(scope.allowedCandidateMetadataScopes),
    forbiddenCandidateOperations: sortKo(scope.forbiddenCandidateOperations),
    recommendations: sortKo(scope.recommendations),
  };
}

function serializePolicy(p: RuntimeControlledActivationCandidatePolicy): Readonly<Record<string, unknown>> {
  return {
    mode: p.mode,
    ...SERIALIZED_RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_ACTUAL_FLAGS,
    activationAllowedMode: p.activationAllowedMode,
    operatorReviewBeforeControlledActivation: p.operatorReviewBeforeControlledActivation,
    rollbackReadinessRequired: p.rollbackReadinessRequired,
    auditTraceRequired: p.auditTraceRequired,
    actualRuntimeOrchestrationForbidden: p.actualRuntimeOrchestrationForbidden,
    actualControlledActivationForbidden: p.actualControlledActivationForbidden,
    actualPilotActivationForbidden: p.actualPilotActivationForbidden,
    actualPilotExecutionForbidden: p.actualPilotExecutionForbidden,
    actualExecutionForbidden: p.actualExecutionForbidden,
    actualExecutionRoutingForbidden: p.actualExecutionRoutingForbidden,
    actualReleaseEnforcementForbidden: p.actualReleaseEnforcementForbidden,
    actualApprovalEnforcementForbidden: p.actualApprovalEnforcementForbidden,
    actualAdapterInvocationForbidden: p.actualAdapterInvocationForbidden,
    actualProviderRoutingForbidden: p.actualProviderRoutingForbidden,
    actualQueueControlForbidden: p.actualQueueControlForbidden,
    actualRollbackForbidden: p.actualRollbackForbidden,
    actualExecutionBlockingForbidden: p.actualExecutionBlockingForbidden,
    actualMergeBlockingForbidden: p.actualMergeBlockingForbidden,
    recommendations: sortKo(p.recommendations),
  };
}

function serializeBlockerReport(
  b: RuntimeControlledActivationCandidateBlockerReport
): Readonly<Record<string, unknown>> {
  return {
    mode: b.mode,
    ...SERIALIZED_RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_ACTUAL_FLAGS,
    blockers: sortKo(b.blockers),
    recommendations: sortKo(b.recommendations),
  };
}

function serializeChecklist(c: RuntimeControlledActivationReadinessChecklist): Readonly<Record<string, unknown>> {
  return {
    mode: c.mode,
    ...SERIALIZED_RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_ACTUAL_FLAGS,
    checklist: sortKo(c.checklist),
    missingRows: sortKo(c.missingRows),
    blockers: sortKo(c.blockers),
    recommendations: sortKo(c.recommendations),
  };
}

function serializeViolationReport(
  v: RuntimeControlledActivationCandidateViolationReport
): Readonly<Record<string, unknown>> {
  return {
    mode: v.mode,
    ...SERIALIZED_RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_ACTUAL_FLAGS,
    actualFlagViolations: sortKo(v.actualFlagViolations),
    policyViolations: sortKo(v.policyViolations),
    wordingRiskFindings: sortKo(v.wordingRiskFindings),
    recommendations: sortKo(v.recommendations),
  };
}

function serializeVerificationReport(
  r: RuntimeControlledActivationCandidateVerificationReport
): Readonly<Record<string, unknown>> {
  return {
    mode: r.mode,
    ...SERIALIZED_RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_ACTUAL_FLAGS,
    verificationStatus: r.verificationStatus,
    findings: sortKo(r.findings),
    recommendations: sortKo(r.recommendations),
  };
}

function serializeAlignmentReport(
  a: RuntimeControlledActivationCandidateAlignmentReport
): Readonly<Record<string, unknown>> {
  return {
    mode: a.mode,
    ...SERIALIZED_RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_ACTUAL_FLAGS,
    alignmentStatus: a.alignmentStatus,
    findings: sortKo(a.findings),
    recommendations: sortKo(a.recommendations),
  };
}

function serializeFinalSafetyGate(
  g: RuntimeControlledActivationCandidateFinalSafetyGate
): Readonly<Record<string, unknown>> {
  return {
    mode: g.mode,
    ...SERIALIZED_RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_ACTUAL_FLAGS,
    finalGateStatus: g.finalGateStatus,
    h42EntryReadiness: g.h42EntryReadiness,
    checklist: sortKo(g.checklist),
    blockers: sortKo(g.blockers),
    recommendations: sortKo(g.recommendations),
  };
}

export function serializeRuntimeControlledActivationCandidateDiagnosticBundleFromSemanticReports(
  reports: RuntimeSemanticPlanningReports
): Readonly<{
  runtimeControlledActivationCandidateSummary: ReturnType<typeof serializeSummary>;
  runtimeControlHandoffBoundary: ReturnType<typeof serializeHandoffBoundary>;
  runtimeControlledActivationCandidateScope: ReturnType<typeof serializeScope>;
  runtimeControlledActivationCandidatePolicy: ReturnType<typeof serializePolicy>;
  runtimeControlledActivationCandidateBlockerReport: ReturnType<typeof serializeBlockerReport>;
  runtimeControlledActivationReadinessChecklist: ReturnType<typeof serializeChecklist>;
  runtimeControlledActivationCandidateViolationReport: ReturnType<typeof serializeViolationReport>;
  runtimeControlledActivationCandidateVerificationReport: ReturnType<typeof serializeVerificationReport>;
  runtimeControlledActivationCandidateAlignmentReport: ReturnType<typeof serializeAlignmentReport>;
  runtimeControlledActivationCandidateFinalSafetyGate: ReturnType<typeof serializeFinalSafetyGate>;
}> {
  return {
    runtimeControlledActivationCandidateSummary: serializeSummary(
      reports.runtimeControlledActivationCandidateSummary
    ),
    runtimeControlHandoffBoundary: serializeHandoffBoundary(reports.runtimeControlHandoffBoundary),
    runtimeControlledActivationCandidateScope: serializeScope(reports.runtimeControlledActivationCandidateScope),
    runtimeControlledActivationCandidatePolicy: serializePolicy(reports.runtimeControlledActivationCandidatePolicy),
    runtimeControlledActivationCandidateBlockerReport: serializeBlockerReport(
      reports.runtimeControlledActivationCandidateBlockerReport
    ),
    runtimeControlledActivationReadinessChecklist: serializeChecklist(
      reports.runtimeControlledActivationReadinessChecklist
    ),
    runtimeControlledActivationCandidateViolationReport: serializeViolationReport(
      reports.runtimeControlledActivationCandidateViolationReport
    ),
    runtimeControlledActivationCandidateVerificationReport: serializeVerificationReport(
      reports.runtimeControlledActivationCandidateVerificationReport
    ),
    runtimeControlledActivationCandidateAlignmentReport: serializeAlignmentReport(
      reports.runtimeControlledActivationCandidateAlignmentReport
    ),
    runtimeControlledActivationCandidateFinalSafetyGate: serializeFinalSafetyGate(
      reports.runtimeControlledActivationCandidateFinalSafetyGate
    ),
  };
}

export type SerializedRuntimeControlledActivationCandidateDiag = ReturnType<
  typeof serializeRuntimeControlledActivationCandidateDiagnosticBundleFromSemanticReports
>;
