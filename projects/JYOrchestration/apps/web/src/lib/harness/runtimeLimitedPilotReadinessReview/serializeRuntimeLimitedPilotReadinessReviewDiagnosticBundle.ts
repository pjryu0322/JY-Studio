/**
 * H43 — limited pilot readiness review 진단 **직렬화 전용**(report 재빌드 없음).
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import { SERIALIZED_RUNTIME_LIMITED_PILOT_READINESS_REVIEW_ACTUAL_FLAGS } from "./runtimeLimitedPilotReadinessReviewConstants";
import type {
  RuntimeLimitedPilotReadinessReviewSummary,
  RuntimePilotContractHardeningBoundary,
  RuntimePilotContractReadinessChecklist,
  RuntimePilotExecutionForbiddenProof,
  RuntimePilotNoExecutionProof,
  RuntimePilotReadinessBlockerReport,
  RuntimePilotReadinessInputEnvelope,
  RuntimePilotReadinessOutputEnvelope,
} from "./runtimeLimitedPilotReadinessReviewTypes";

function sortKo(rows: readonly string[]): readonly string[] {
  return [...rows].sort((a, b) => a.localeCompare(b, "ko"));
}

function serializeSummary(s: RuntimeLimitedPilotReadinessReviewSummary): Readonly<Record<string, unknown>> {
  return {
    mode: s.mode,
    ...SERIALIZED_RUNTIME_LIMITED_PILOT_READINESS_REVIEW_ACTUAL_FLAGS,
    reviewStatus: s.reviewStatus,
    reviewMode: s.reviewMode,
    rationaleKo: s.rationaleKo,
    reviewBlockers: sortKo(s.reviewBlockers),
    recommendations: sortKo(s.recommendations),
  };
}

function serializeBoundary(b: RuntimePilotContractHardeningBoundary): Readonly<Record<string, unknown>> {
  return {
    mode: b.mode,
    ...SERIALIZED_RUNTIME_LIMITED_PILOT_READINESS_REVIEW_ACTUAL_FLAGS,
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
  e: RuntimePilotReadinessInputEnvelope | RuntimePilotReadinessOutputEnvelope
): Readonly<Record<string, unknown>> {
  return {
    mode: e.mode,
    ...SERIALIZED_RUNTIME_LIMITED_PILOT_READINESS_REVIEW_ACTUAL_FLAGS,
    envelopeRows: sortKo(e.envelopeRows),
    recommendations: sortKo(e.recommendations),
  };
}

function serializeNoExecutionProof(p: RuntimePilotNoExecutionProof): Readonly<Record<string, unknown>> {
  return {
    mode: p.mode,
    ...SERIALIZED_RUNTIME_LIMITED_PILOT_READINESS_REVIEW_ACTUAL_FLAGS,
    pilotActivated: p.pilotActivated,
    pilotExecuted: p.pilotExecuted,
    isolatedRunnerInvoked: p.isolatedRunnerInvoked,
    isolatedRunnerExecuted: p.isolatedRunnerExecuted,
    dryRunRunnerInvoked: p.dryRunRunnerInvoked,
    dryRunRunnerExecuted: p.dryRunRunnerExecuted,
    noopShellExecuted: p.noopShellExecuted,
    executionShellExecuted: p.executionShellExecuted,
    runtimeAdapterInvoked: p.runtimeAdapterInvoked,
    sandboxInvoked: p.sandboxInvoked,
    executionPerformed: p.executionPerformed,
    executionRoutingPerformed: p.executionRoutingPerformed,
    providerRoutingPerformed: p.providerRoutingPerformed,
    queueControlPerformed: p.queueControlPerformed,
    rollbackPerformed: p.rollbackPerformed,
    releaseEnforced: p.releaseEnforced,
    approvalEnforced: p.approvalEnforced,
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

function serializeForbiddenProof(p: RuntimePilotExecutionForbiddenProof): Readonly<Record<string, unknown>> {
  return {
    mode: p.mode,
    ...SERIALIZED_RUNTIME_LIMITED_PILOT_READINESS_REVIEW_ACTUAL_FLAGS,
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
    actualPromptMutationForbidden: p.actualPromptMutationForbidden,
    actualTokenEnforcementForbidden: p.actualTokenEnforcementForbidden,
    actualContextPruningForbidden: p.actualContextPruningForbidden,
    actualRetrievalOrchestrationForbidden: p.actualRetrievalOrchestrationForbidden,
    proofRows: sortKo(p.proofRows),
    recommendations: sortKo(p.recommendations),
  };
}

function serializeBlockerReport(b: RuntimePilotReadinessBlockerReport): Readonly<Record<string, unknown>> {
  return {
    mode: b.mode,
    ...SERIALIZED_RUNTIME_LIMITED_PILOT_READINESS_REVIEW_ACTUAL_FLAGS,
    blockers: sortKo(b.blockers),
    recommendations: sortKo(b.recommendations),
  };
}

function serializeChecklist(c: RuntimePilotContractReadinessChecklist): Readonly<Record<string, unknown>> {
  return {
    mode: c.mode,
    ...SERIALIZED_RUNTIME_LIMITED_PILOT_READINESS_REVIEW_ACTUAL_FLAGS,
    checklist: sortKo(c.checklist),
    missingRows: sortKo(c.missingRows),
    blockers: sortKo(c.blockers),
    recommendations: sortKo(c.recommendations),
  };
}

export function serializeRuntimeLimitedPilotReadinessReviewDiagnosticBundleFromSemanticReports(
  reports: RuntimeSemanticPlanningReports
): Readonly<{
  runtimeLimitedPilotReadinessReviewSummary: ReturnType<typeof serializeSummary>;
  runtimePilotContractHardeningBoundary: ReturnType<typeof serializeBoundary>;
  runtimePilotReadinessInputEnvelope: ReturnType<typeof serializeEnvelope>;
  runtimePilotReadinessOutputEnvelope: ReturnType<typeof serializeEnvelope>;
  runtimePilotNoExecutionProof: ReturnType<typeof serializeNoExecutionProof>;
  runtimePilotExecutionForbiddenProof: ReturnType<typeof serializeForbiddenProof>;
  runtimePilotReadinessBlockerReport: ReturnType<typeof serializeBlockerReport>;
  runtimePilotContractReadinessChecklist: ReturnType<typeof serializeChecklist>;
}> {
  return {
    runtimeLimitedPilotReadinessReviewSummary: serializeSummary(
      reports.runtimeLimitedPilotReadinessReviewSummary
    ),
    runtimePilotContractHardeningBoundary: serializeBoundary(reports.runtimePilotContractHardeningBoundary),
    runtimePilotReadinessInputEnvelope: serializeEnvelope(reports.runtimePilotReadinessInputEnvelope),
    runtimePilotReadinessOutputEnvelope: serializeEnvelope(reports.runtimePilotReadinessOutputEnvelope),
    runtimePilotNoExecutionProof: serializeNoExecutionProof(reports.runtimePilotNoExecutionProof),
    runtimePilotExecutionForbiddenProof: serializeForbiddenProof(reports.runtimePilotExecutionForbiddenProof),
    runtimePilotReadinessBlockerReport: serializeBlockerReport(reports.runtimePilotReadinessBlockerReport),
    runtimePilotContractReadinessChecklist: serializeChecklist(reports.runtimePilotContractReadinessChecklist),
  };
}

export type SerializedRuntimeLimitedPilotReadinessReviewDiag = ReturnType<
  typeof serializeRuntimeLimitedPilotReadinessReviewDiagnosticBundleFromSemanticReports
>;
