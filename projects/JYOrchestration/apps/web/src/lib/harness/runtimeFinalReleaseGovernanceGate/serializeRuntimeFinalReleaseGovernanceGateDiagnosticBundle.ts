/**
 * H39 / H39.5 — final release governance gate 진단 **직렬화 전용**(report 재빌드 없음).
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import { SERIALIZED_RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_ACTUAL_FLAGS } from "./runtimeFinalReleaseGovernanceGateConstants";
import type {
  RuntimeFinalReleaseGovernanceGateAlignmentReport,
  RuntimeFinalReleaseGovernanceGateBlockerReport,
  RuntimeFinalReleaseGovernanceGateFinalSafetyGate,
  RuntimeFinalReleaseGovernanceGatePolicy,
  RuntimeFinalReleaseGovernanceGateReadinessChecklist,
  RuntimeFinalReleaseGovernanceGateScope,
  RuntimeFinalReleaseGovernanceGateSummary,
  RuntimeFinalReleaseGovernanceGateVerificationReport,
  RuntimeFinalReleaseGovernanceGateViolationReport,
} from "./runtimeFinalReleaseGovernanceGateTypes";

function sortKo(rows: readonly string[]): readonly string[] {
  return [...rows].sort((a, b) => a.localeCompare(b, "ko"));
}

function serializeSummary(s: RuntimeFinalReleaseGovernanceGateSummary): Readonly<Record<string, unknown>> {
  return {
    mode: s.mode,
    ...SERIALIZED_RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_ACTUAL_FLAGS,
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
    ...SERIALIZED_RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_ACTUAL_FLAGS,
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
    ...SERIALIZED_RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_ACTUAL_FLAGS,
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
    ...SERIALIZED_RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_ACTUAL_FLAGS,
    blockers: sortKo(b.blockers),
    recommendations: sortKo(b.recommendations),
  };
}

function serializeChecklist(c: RuntimeFinalReleaseGovernanceGateReadinessChecklist): Readonly<Record<string, unknown>> {
  return {
    mode: c.mode,
    ...SERIALIZED_RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_ACTUAL_FLAGS,
    checklist: sortKo(c.checklist),
    missingRows: sortKo(c.missingRows),
    blockers: sortKo(c.blockers),
    recommendations: sortKo(c.recommendations),
  };
}

function serializeViolationReport(v: RuntimeFinalReleaseGovernanceGateViolationReport): Readonly<Record<string, unknown>> {
  return {
    mode: v.mode,
    ...SERIALIZED_RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_ACTUAL_FLAGS,
    actualFlagViolations: sortKo(v.actualFlagViolations),
    wordingRiskFindings: sortKo(v.wordingRiskFindings),
    recommendations: sortKo(v.recommendations),
  };
}

function serializeReadinessVerification(
  r: RuntimeFinalReleaseGovernanceGateVerificationReport
): Readonly<Record<string, unknown>> {
  return {
    mode: r.mode,
    ...SERIALIZED_RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_ACTUAL_FLAGS,
    verificationStatus: r.verificationStatus,
    findings: sortKo(r.findings),
    recommendations: sortKo(r.recommendations),
  };
}

function serializeAlignmentReport(a: RuntimeFinalReleaseGovernanceGateAlignmentReport): Readonly<Record<string, unknown>> {
  return {
    mode: a.mode,
    ...SERIALIZED_RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_ACTUAL_FLAGS,
    alignmentStatus: a.alignmentStatus,
    findings: sortKo(a.findings),
    recommendations: sortKo(a.recommendations),
  };
}

function serializeFinalSafetyGate(g: RuntimeFinalReleaseGovernanceGateFinalSafetyGate): Readonly<Record<string, unknown>> {
  return {
    mode: g.mode,
    ...SERIALIZED_RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_ACTUAL_FLAGS,
    finalGateStatus: g.finalGateStatus,
    h40EntryReadiness: g.h40EntryReadiness,
    checklist: sortKo(g.checklist),
    blockers: sortKo(g.blockers),
    recommendations: sortKo(g.recommendations),
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
  runtimeFinalReleaseGovernanceGateViolationReport: ReturnType<typeof serializeViolationReport>;
  runtimeFinalReleaseGovernanceGateVerificationReport: ReturnType<typeof serializeReadinessVerification>;
  runtimeFinalReleaseGovernanceGateAlignmentReport: ReturnType<typeof serializeAlignmentReport>;
  runtimeFinalReleaseGovernanceGateFinalSafetyGate: ReturnType<typeof serializeFinalSafetyGate>;
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
    runtimeFinalReleaseGovernanceGateViolationReport: serializeViolationReport(
      reports.runtimeFinalReleaseGovernanceGateViolationReport
    ),
    runtimeFinalReleaseGovernanceGateVerificationReport: serializeReadinessVerification(
      reports.runtimeFinalReleaseGovernanceGateVerificationReport
    ),
    runtimeFinalReleaseGovernanceGateAlignmentReport: serializeAlignmentReport(
      reports.runtimeFinalReleaseGovernanceGateAlignmentReport
    ),
    runtimeFinalReleaseGovernanceGateFinalSafetyGate: serializeFinalSafetyGate(
      reports.runtimeFinalReleaseGovernanceGateFinalSafetyGate
    ),
  };
}
