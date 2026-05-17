/**
 * H38 / H38.5 — governance release-readiness 진단 **직렬화 전용**(report 재빌드 없음).
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type {
  RuntimeExecutionGovernanceForbiddenProof,
  RuntimeGovernanceNoEnforcementProof,
  RuntimeGovernanceReleaseBlockerReport,
  RuntimeGovernanceReleaseInputEnvelope,
  RuntimeGovernanceReleaseOutputEnvelope,
  RuntimeGovernanceReleaseReadinessAlignmentReport,
  RuntimeGovernanceReleaseReadinessBoundary,
  RuntimeGovernanceReleaseReadinessChecklist,
  RuntimeGovernanceReleaseReadinessFinalSafetyGate,
  RuntimeGovernanceReleaseReadinessSummary,
  RuntimeGovernanceReleaseReadinessVerificationReport,
  RuntimeGovernanceReleaseReadinessViolationReport,
} from "./runtimeGovernanceReleaseReadinessTypes";

function sortKo(rows: readonly string[]): readonly string[] {
  return [...rows].sort((a, b) => a.localeCompare(b, "ko"));
}

const SERIALIZED_ACTUAL_FLAGS_DISABLED = {
  actualRuntimeOrchestrationEnabled: false,
  actualPilotExecutionEnabled: false,
  actualNoopShellExecutionEnabled: false,
  actualExecutionShellExecutionEnabled: false,
  actualReleaseEnforcementEnabled: false,
  actualRuntimeAdapterInvocationEnabled: false,
  actualExecutionEnabled: false,
  actualExecutionRoutingEnabled: false,
  actualProviderRoutingEnabled: false,
  actualQueueControlEnabled: false,
  actualRollbackExecutionEnabled: false,
  actualApprovalEnforcementEnabled: false,
} as const;

function serializeSummary(s: RuntimeGovernanceReleaseReadinessSummary): Readonly<Record<string, unknown>> {
  return {
    mode: s.mode,
    ...SERIALIZED_ACTUAL_FLAGS_DISABLED,
    readinessStatus: s.readinessStatus,
    readinessMode: s.readinessMode,
    rationaleKo: s.rationaleKo,
    readinessBlockers: sortKo(s.readinessBlockers),
    recommendations: sortKo(s.recommendations),
  };
}

function serializeBoundary(b: RuntimeGovernanceReleaseReadinessBoundary): Readonly<Record<string, unknown>> {
  return {
    mode: b.mode,
    ...SERIALIZED_ACTUAL_FLAGS_DISABLED,
    boundarySourceLayer: b.boundarySourceLayer,
    boundaryTargetLayer: b.boundaryTargetLayer,
    allowedBoundaryScopes: sortKo(b.allowedBoundaryScopes),
    requiredBoundaryInputs: sortKo(b.requiredBoundaryInputs),
    expectedBoundaryOutputs: sortKo(b.expectedBoundaryOutputs),
    forbiddenBoundaryOperations: sortKo(b.forbiddenBoundaryOperations),
    recommendations: sortKo(b.recommendations),
  };
}

function serializeEnvelope(
  e: RuntimeGovernanceReleaseInputEnvelope | RuntimeGovernanceReleaseOutputEnvelope
): Readonly<Record<string, unknown>> {
  return {
    mode: e.mode,
    ...SERIALIZED_ACTUAL_FLAGS_DISABLED,
    envelopeRows: sortKo(e.envelopeRows),
    recommendations: sortKo(e.recommendations),
  };
}

function serializeNoEnforcementProof(p: RuntimeGovernanceNoEnforcementProof): Readonly<Record<string, unknown>> {
  return {
    mode: p.mode,
    ...SERIALIZED_ACTUAL_FLAGS_DISABLED,
    executionPerformed: p.executionPerformed,
    executionRoutingPerformed: p.executionRoutingPerformed,
    releaseEnforced: p.releaseEnforced,
    approvalEnforced: p.approvalEnforced,
    noopShellExecuted: p.noopShellExecuted,
    executionShellExecuted: p.executionShellExecuted,
    runtimeAdapterInvoked: p.runtimeAdapterInvoked,
    providerRoutingPerformed: p.providerRoutingPerformed,
    queueControlPerformed: p.queueControlPerformed,
    rollbackPerformed: p.rollbackPerformed,
    promptMutated: p.promptMutated,
    tokenEnforced: p.tokenEnforced,
    contextPruned: p.contextPruned,
    mergeBlocked: p.mergeBlocked,
    executionBlocked: p.executionBlocked,
    diagnosticOnly: p.diagnosticOnly,
    proofRows: sortKo(p.proofRows),
    recommendations: sortKo(p.recommendations),
  };
}

function serializeForbiddenProof(p: RuntimeExecutionGovernanceForbiddenProof): Readonly<Record<string, unknown>> {
  return {
    mode: p.mode,
    ...SERIALIZED_ACTUAL_FLAGS_DISABLED,
    actualExecutionForbidden: p.actualExecutionForbidden,
    actualExecutionRoutingForbidden: p.actualExecutionRoutingForbidden,
    actualReleaseEnforcementForbidden: p.actualReleaseEnforcementForbidden,
    actualApprovalEnforcementForbidden: p.actualApprovalEnforcementForbidden,
    actualShellExecutionForbidden: p.actualShellExecutionForbidden,
    actualAdapterInvocationForbidden: p.actualAdapterInvocationForbidden,
    actualProviderRoutingForbidden: p.actualProviderRoutingForbidden,
    actualQueueControlForbidden: p.actualQueueControlForbidden,
    actualRollbackForbidden: p.actualRollbackForbidden,
    actualPromptMutationForbidden: p.actualPromptMutationForbidden,
    actualTokenEnforcementForbidden: p.actualTokenEnforcementForbidden,
    actualContextPruningForbidden: p.actualContextPruningForbidden,
    actualMergeBlockingForbidden: p.actualMergeBlockingForbidden,
    actualExecutionBlockingForbidden: p.actualExecutionBlockingForbidden,
    proofRows: sortKo(p.proofRows),
    recommendations: sortKo(p.recommendations),
  };
}

function serializeBlockerReport(b: RuntimeGovernanceReleaseBlockerReport): Readonly<Record<string, unknown>> {
  return {
    mode: b.mode,
    ...SERIALIZED_ACTUAL_FLAGS_DISABLED,
    blockers: sortKo(b.blockers),
    recommendations: sortKo(b.recommendations),
  };
}

function serializeChecklist(c: RuntimeGovernanceReleaseReadinessChecklist): Readonly<Record<string, unknown>> {
  return {
    mode: c.mode,
    ...SERIALIZED_ACTUAL_FLAGS_DISABLED,
    checklist: sortKo(c.checklist),
    missingRows: sortKo(c.missingRows),
    blockers: sortKo(c.blockers),
    recommendations: sortKo(c.recommendations),
  };
}

function serializeViolationReport(
  v: RuntimeGovernanceReleaseReadinessViolationReport
): Readonly<Record<string, unknown>> {
  return {
    mode: v.mode,
    ...SERIALIZED_ACTUAL_FLAGS_DISABLED,
    actualFlagViolations: sortKo(v.actualFlagViolations),
    proofViolations: sortKo(v.proofViolations),
    wordingRiskFindings: sortKo(v.wordingRiskFindings),
    recommendations: sortKo(v.recommendations),
  };
}

function serializeReadinessVerification(
  r: RuntimeGovernanceReleaseReadinessVerificationReport
): Readonly<Record<string, unknown>> {
  return {
    mode: r.mode,
    ...SERIALIZED_ACTUAL_FLAGS_DISABLED,
    verificationStatus: r.verificationStatus,
    findings: sortKo(r.findings),
    recommendations: sortKo(r.recommendations),
  };
}

function serializeAlignmentReport(
  a: RuntimeGovernanceReleaseReadinessAlignmentReport
): Readonly<Record<string, unknown>> {
  return {
    mode: a.mode,
    ...SERIALIZED_ACTUAL_FLAGS_DISABLED,
    alignmentStatus: a.alignmentStatus,
    findings: sortKo(a.findings),
    recommendations: sortKo(a.recommendations),
  };
}

function serializeFinalSafetyGate(
  g: RuntimeGovernanceReleaseReadinessFinalSafetyGate
): Readonly<Record<string, unknown>> {
  return {
    mode: g.mode,
    ...SERIALIZED_ACTUAL_FLAGS_DISABLED,
    finalGateStatus: g.finalGateStatus,
    h39EntryReadiness: g.h39EntryReadiness,
    checklist: sortKo(g.checklist),
    blockers: sortKo(g.blockers),
    recommendations: sortKo(g.recommendations),
  };
}

export function serializeRuntimeGovernanceReleaseReadinessDiagnosticBundleFromSemanticReports(
  reports: RuntimeSemanticPlanningReports
): Readonly<{
  runtimeGovernanceReleaseReadinessSummary: ReturnType<typeof serializeSummary>;
  runtimeGovernanceReleaseReadinessBoundary: ReturnType<typeof serializeBoundary>;
  runtimeGovernanceReleaseInputEnvelope: ReturnType<typeof serializeEnvelope>;
  runtimeGovernanceReleaseOutputEnvelope: ReturnType<typeof serializeEnvelope>;
  runtimeGovernanceNoEnforcementProof: ReturnType<typeof serializeNoEnforcementProof>;
  runtimeExecutionGovernanceForbiddenProof: ReturnType<typeof serializeForbiddenProof>;
  runtimeGovernanceReleaseBlockerReport: ReturnType<typeof serializeBlockerReport>;
  runtimeGovernanceReleaseReadinessChecklist: ReturnType<typeof serializeChecklist>;
  runtimeGovernanceReleaseReadinessViolationReport: ReturnType<typeof serializeViolationReport>;
  runtimeGovernanceReleaseReadinessVerificationReport: ReturnType<typeof serializeReadinessVerification>;
  runtimeGovernanceReleaseReadinessAlignmentReport: ReturnType<typeof serializeAlignmentReport>;
  runtimeGovernanceReleaseReadinessFinalSafetyGate: ReturnType<typeof serializeFinalSafetyGate>;
}> {
  return {
    runtimeGovernanceReleaseReadinessSummary: serializeSummary(reports.runtimeGovernanceReleaseReadinessSummary),
    runtimeGovernanceReleaseReadinessBoundary: serializeBoundary(reports.runtimeGovernanceReleaseReadinessBoundary),
    runtimeGovernanceReleaseInputEnvelope: serializeEnvelope(reports.runtimeGovernanceReleaseInputEnvelope),
    runtimeGovernanceReleaseOutputEnvelope: serializeEnvelope(reports.runtimeGovernanceReleaseOutputEnvelope),
    runtimeGovernanceNoEnforcementProof: serializeNoEnforcementProof(reports.runtimeGovernanceNoEnforcementProof),
    runtimeExecutionGovernanceForbiddenProof: serializeForbiddenProof(
      reports.runtimeExecutionGovernanceForbiddenProof
    ),
    runtimeGovernanceReleaseBlockerReport: serializeBlockerReport(reports.runtimeGovernanceReleaseBlockerReport),
    runtimeGovernanceReleaseReadinessChecklist: serializeChecklist(reports.runtimeGovernanceReleaseReadinessChecklist),
    runtimeGovernanceReleaseReadinessViolationReport: serializeViolationReport(
      reports.runtimeGovernanceReleaseReadinessViolationReport
    ),
    runtimeGovernanceReleaseReadinessVerificationReport: serializeReadinessVerification(
      reports.runtimeGovernanceReleaseReadinessVerificationReport
    ),
    runtimeGovernanceReleaseReadinessAlignmentReport: serializeAlignmentReport(
      reports.runtimeGovernanceReleaseReadinessAlignmentReport
    ),
    runtimeGovernanceReleaseReadinessFinalSafetyGate: serializeFinalSafetyGate(
      reports.runtimeGovernanceReleaseReadinessFinalSafetyGate
    ),
  };
}
