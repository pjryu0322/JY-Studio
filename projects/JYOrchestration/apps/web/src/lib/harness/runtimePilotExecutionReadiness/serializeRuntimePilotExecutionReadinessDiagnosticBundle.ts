/**
 * H44 — pilot execution readiness 진단 **직렬화 전용**(report 재빌드 없음).
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import { SERIALIZED_RUNTIME_PILOT_EXECUTION_READINESS_ACTUAL_FLAGS } from "./runtimePilotExecutionReadinessConstants";
import type {
  RuntimeFinalPilotExecutionForbiddenProof,
  RuntimeFinalPilotNoExecutionProof,
  RuntimePilotExecutionReadinessBlockerReport,
  RuntimePilotExecutionReadinessBoundary,
  RuntimePilotExecutionReadinessChecklist,
  RuntimePilotExecutionReadinessInputEnvelope,
  RuntimePilotExecutionReadinessOutputEnvelope,
  RuntimePilotExecutionReadinessSummary,
} from "./runtimePilotExecutionReadinessTypes";

function sortKo(rows: readonly string[]): readonly string[] {
  return [...rows].sort((a, b) => a.localeCompare(b, "ko"));
}

function serializeSummary(s: RuntimePilotExecutionReadinessSummary): Readonly<Record<string, unknown>> {
  return {
    mode: s.mode,
    ...SERIALIZED_RUNTIME_PILOT_EXECUTION_READINESS_ACTUAL_FLAGS,
    readinessStatus: s.readinessStatus,
    readinessMode: s.readinessMode,
    rationaleKo: s.rationaleKo,
    readinessBlockers: sortKo(s.readinessBlockers),
    recommendations: sortKo(s.recommendations),
  };
}

function serializeBoundary(b: RuntimePilotExecutionReadinessBoundary): Readonly<Record<string, unknown>> {
  return {
    mode: b.mode,
    ...SERIALIZED_RUNTIME_PILOT_EXECUTION_READINESS_ACTUAL_FLAGS,
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
  e: RuntimePilotExecutionReadinessInputEnvelope | RuntimePilotExecutionReadinessOutputEnvelope
): Readonly<Record<string, unknown>> {
  return {
    mode: e.mode,
    ...SERIALIZED_RUNTIME_PILOT_EXECUTION_READINESS_ACTUAL_FLAGS,
    envelopeRows: sortKo(e.envelopeRows),
    recommendations: sortKo(e.recommendations),
  };
}

function serializeNoExecutionProof(p: RuntimeFinalPilotNoExecutionProof): Readonly<Record<string, unknown>> {
  return {
    mode: p.mode,
    ...SERIALIZED_RUNTIME_PILOT_EXECUTION_READINESS_ACTUAL_FLAGS,
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

function serializeForbiddenProof(p: RuntimeFinalPilotExecutionForbiddenProof): Readonly<Record<string, unknown>> {
  return {
    mode: p.mode,
    ...SERIALIZED_RUNTIME_PILOT_EXECUTION_READINESS_ACTUAL_FLAGS,
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

function serializeBlockerReport(b: RuntimePilotExecutionReadinessBlockerReport): Readonly<Record<string, unknown>> {
  return {
    mode: b.mode,
    ...SERIALIZED_RUNTIME_PILOT_EXECUTION_READINESS_ACTUAL_FLAGS,
    blockers: sortKo(b.blockers),
    recommendations: sortKo(b.recommendations),
  };
}

function serializeChecklist(c: RuntimePilotExecutionReadinessChecklist): Readonly<Record<string, unknown>> {
  return {
    mode: c.mode,
    ...SERIALIZED_RUNTIME_PILOT_EXECUTION_READINESS_ACTUAL_FLAGS,
    checklist: sortKo(c.checklist),
    missingRows: sortKo(c.missingRows),
    blockers: sortKo(c.blockers),
    recommendations: sortKo(c.recommendations),
  };
}

export function serializeRuntimePilotExecutionReadinessDiagnosticBundleFromSemanticReports(
  reports: RuntimeSemanticPlanningReports
): Readonly<{
  runtimePilotExecutionReadinessSummary: ReturnType<typeof serializeSummary>;
  runtimePilotExecutionReadinessBoundary: ReturnType<typeof serializeBoundary>;
  runtimePilotExecutionReadinessInputEnvelope: ReturnType<typeof serializeEnvelope>;
  runtimePilotExecutionReadinessOutputEnvelope: ReturnType<typeof serializeEnvelope>;
  runtimeFinalPilotNoExecutionProof: ReturnType<typeof serializeNoExecutionProof>;
  runtimeFinalPilotExecutionForbiddenProof: ReturnType<typeof serializeForbiddenProof>;
  runtimePilotExecutionReadinessBlockerReport: ReturnType<typeof serializeBlockerReport>;
  runtimePilotExecutionReadinessChecklist: ReturnType<typeof serializeChecklist>;
}> {
  return {
    runtimePilotExecutionReadinessSummary: serializeSummary(reports.runtimePilotExecutionReadinessSummary),
    runtimePilotExecutionReadinessBoundary: serializeBoundary(reports.runtimePilotExecutionReadinessBoundary),
    runtimePilotExecutionReadinessInputEnvelope: serializeEnvelope(reports.runtimePilotExecutionReadinessInputEnvelope),
    runtimePilotExecutionReadinessOutputEnvelope: serializeEnvelope(reports.runtimePilotExecutionReadinessOutputEnvelope),
    runtimeFinalPilotNoExecutionProof: serializeNoExecutionProof(reports.runtimeFinalPilotNoExecutionProof),
    runtimeFinalPilotExecutionForbiddenProof: serializeForbiddenProof(reports.runtimeFinalPilotExecutionForbiddenProof),
    runtimePilotExecutionReadinessBlockerReport: serializeBlockerReport(
      reports.runtimePilotExecutionReadinessBlockerReport
    ),
    runtimePilotExecutionReadinessChecklist: serializeChecklist(reports.runtimePilotExecutionReadinessChecklist),
  };
}

export type SerializedRuntimePilotExecutionReadinessDiag = ReturnType<
  typeof serializeRuntimePilotExecutionReadinessDiagnosticBundleFromSemanticReports
>;
