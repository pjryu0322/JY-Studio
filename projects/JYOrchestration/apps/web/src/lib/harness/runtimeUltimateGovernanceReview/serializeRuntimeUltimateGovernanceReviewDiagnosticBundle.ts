/**
 * H40 — ultimate governance review 진단 **직렬화 전용**(report 재빌드 없음).
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import { SERIALIZED_RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_ACTUAL_FLAGS } from "./runtimeUltimateGovernanceReviewConstants";
import type {
  RuntimeFinalOrchestrationReadinessBoundary,
  RuntimeFinalOrchestrationReadinessChecklist,
  RuntimeOrchestrationForbiddenProof,
  RuntimeOrchestrationReadinessInputEnvelope,
  RuntimeOrchestrationReadinessOutputEnvelope,
  RuntimeUltimateGovernanceBlockerReport,
  RuntimeUltimateGovernanceReviewSummary,
  RuntimeUltimateNoEnforcementProof,
} from "./runtimeUltimateGovernanceReviewTypes";

function sortKo(rows: readonly string[]): readonly string[] {
  return [...rows].sort((a, b) => a.localeCompare(b, "ko"));
}

function serializeSummary(s: RuntimeUltimateGovernanceReviewSummary): Readonly<Record<string, unknown>> {
  return {
    mode: s.mode,
    ...SERIALIZED_RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_ACTUAL_FLAGS,
    reviewStatus: s.reviewStatus,
    reviewMode: s.reviewMode,
    rationaleKo: s.rationaleKo,
    reviewBlockers: sortKo(s.reviewBlockers),
    recommendations: sortKo(s.recommendations),
  };
}

function serializeBoundary(b: RuntimeFinalOrchestrationReadinessBoundary): Readonly<Record<string, unknown>> {
  return {
    mode: b.mode,
    ...SERIALIZED_RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_ACTUAL_FLAGS,
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
  e: RuntimeOrchestrationReadinessInputEnvelope | RuntimeOrchestrationReadinessOutputEnvelope
): Readonly<Record<string, unknown>> {
  return {
    mode: e.mode,
    ...SERIALIZED_RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_ACTUAL_FLAGS,
    envelopeRows: sortKo(e.envelopeRows),
    recommendations: sortKo(e.recommendations),
  };
}

function serializeNoEnforcementProof(p: RuntimeUltimateNoEnforcementProof): Readonly<Record<string, unknown>> {
  return {
    mode: p.mode,
    ...SERIALIZED_RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_ACTUAL_FLAGS,
    runtimeOrchestrated: p.runtimeOrchestrated,
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
    executionBlocked: p.executionBlocked,
    mergeBlocked: p.mergeBlocked,
    promptMutated: p.promptMutated,
    tokenEnforced: p.tokenEnforced,
    contextPruned: p.contextPruned,
    retrievalOrchestrated: p.retrievalOrchestrated,
    diagnosticOnly: p.diagnosticOnly,
    proofRows: sortKo(p.proofRows),
    recommendations: sortKo(p.recommendations),
  };
}

function serializeForbiddenProof(p: RuntimeOrchestrationForbiddenProof): Readonly<Record<string, unknown>> {
  return {
    mode: p.mode,
    ...SERIALIZED_RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_ACTUAL_FLAGS,
    actualOrchestrationForbidden: p.actualOrchestrationForbidden,
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
    actualPromptMutationForbidden: p.actualPromptMutationForbidden,
    actualTokenEnforcementForbidden: p.actualTokenEnforcementForbidden,
    actualContextPruningForbidden: p.actualContextPruningForbidden,
    actualRetrievalOrchestrationForbidden: p.actualRetrievalOrchestrationForbidden,
    proofRows: sortKo(p.proofRows),
    recommendations: sortKo(p.recommendations),
  };
}

function serializeBlockerReport(b: RuntimeUltimateGovernanceBlockerReport): Readonly<Record<string, unknown>> {
  return {
    mode: b.mode,
    ...SERIALIZED_RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_ACTUAL_FLAGS,
    blockers: sortKo(b.blockers),
    recommendations: sortKo(b.recommendations),
  };
}

function serializeChecklist(c: RuntimeFinalOrchestrationReadinessChecklist): Readonly<Record<string, unknown>> {
  return {
    mode: c.mode,
    ...SERIALIZED_RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_ACTUAL_FLAGS,
    checklist: sortKo(c.checklist),
    missingRows: sortKo(c.missingRows),
    blockers: sortKo(c.blockers),
    recommendations: sortKo(c.recommendations),
  };
}

export function serializeRuntimeUltimateGovernanceReviewDiagnosticBundleFromSemanticReports(
  reports: RuntimeSemanticPlanningReports
) {
  return {
    runtimeUltimateGovernanceReviewSummary: serializeSummary(reports.runtimeUltimateGovernanceReviewSummary),
    runtimeFinalOrchestrationReadinessBoundary: serializeBoundary(
      reports.runtimeFinalOrchestrationReadinessBoundary
    ),
    runtimeOrchestrationReadinessInputEnvelope: serializeEnvelope(reports.runtimeOrchestrationReadinessInputEnvelope),
    runtimeOrchestrationReadinessOutputEnvelope: serializeEnvelope(reports.runtimeOrchestrationReadinessOutputEnvelope),
    runtimeUltimateNoEnforcementProof: serializeNoEnforcementProof(reports.runtimeUltimateNoEnforcementProof),
    runtimeOrchestrationForbiddenProof: serializeForbiddenProof(reports.runtimeOrchestrationForbiddenProof),
    runtimeUltimateGovernanceBlockerReport: serializeBlockerReport(reports.runtimeUltimateGovernanceBlockerReport),
    runtimeFinalOrchestrationReadinessChecklist: serializeChecklist(reports.runtimeFinalOrchestrationReadinessChecklist),
  };
}

export type SerializedRuntimeUltimateGovernanceReviewDiag = ReturnType<
  typeof serializeRuntimeUltimateGovernanceReviewDiagnosticBundleFromSemanticReports
>;
