/**
 * H35 — release-gate final preflight 진단 **직렬화 전용**(report 재빌드 없음).
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type {
  RuntimeReleaseGateExecutionReadinessBoundary,
  RuntimeReleaseGateInputEnvelope,
  RuntimeReleaseGateNoExecutionProof,
  RuntimeReleaseGateOperationForbiddenProof,
  RuntimeReleaseGateOutputEnvelope,
  RuntimeReleaseGatePreflightBlockerReport,
  RuntimeReleaseGatePreflightChecklist,
  RuntimeReleaseGatePreflightSummary,
} from "./runtimeReleaseGatePreflightTypes";

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
  actualProviderRoutingEnabled: false,
  actualQueueControlEnabled: false,
  actualRollbackExecutionEnabled: false,
} as const;

function serializePreflightSummary(s: RuntimeReleaseGatePreflightSummary): Readonly<Record<string, unknown>> {
  return {
    mode: s.mode,
    ...SERIALIZED_ACTUAL_FLAGS_DISABLED,
    preflightReadiness: s.preflightReadiness,
    preflightMode: s.preflightMode,
    rationaleKo: s.rationaleKo,
    preflightBlockers: sortKo(s.preflightBlockers),
    recommendations: sortKo(s.recommendations),
  };
}

function serializeExecutionReadinessBoundary(
  b: RuntimeReleaseGateExecutionReadinessBoundary
): Readonly<Record<string, unknown>> {
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
  e: RuntimeReleaseGateInputEnvelope | RuntimeReleaseGateOutputEnvelope
): Readonly<Record<string, unknown>> {
  return {
    mode: e.mode,
    ...SERIALIZED_ACTUAL_FLAGS_DISABLED,
    envelopeRows: sortKo(e.envelopeRows),
    recommendations: sortKo(e.recommendations),
  };
}

function serializeNoExecutionProof(p: RuntimeReleaseGateNoExecutionProof): Readonly<Record<string, unknown>> {
  return {
    mode: p.mode,
    ...SERIALIZED_ACTUAL_FLAGS_DISABLED,
    releaseEnforced: p.releaseEnforced,
    noopShellExecuted: p.noopShellExecuted,
    executionShellExecuted: p.executionShellExecuted,
    runtimeAdapterInvoked: p.runtimeAdapterInvoked,
    executionPerformed: p.executionPerformed,
    providerRoutingPerformed: p.providerRoutingPerformed,
    queueControlPerformed: p.queueControlPerformed,
    rollbackPerformed: p.rollbackPerformed,
    promptMutated: p.promptMutated,
    tokenEnforced: p.tokenEnforced,
    contextPruned: p.contextPruned,
    mergeBlocked: p.mergeBlocked,
    diagnosticOnly: p.diagnosticOnly,
    proofRows: sortKo(p.proofRows),
    recommendations: sortKo(p.recommendations),
  };
}

function serializeOperationForbiddenProof(
  p: RuntimeReleaseGateOperationForbiddenProof
): Readonly<Record<string, unknown>> {
  return {
    mode: p.mode,
    ...SERIALIZED_ACTUAL_FLAGS_DISABLED,
    actualReleaseEnforcementForbidden: p.actualReleaseEnforcementForbidden,
    actualShellExecutionForbidden: p.actualShellExecutionForbidden,
    actualAdapterInvocationForbidden: p.actualAdapterInvocationForbidden,
    actualExecutionForbidden: p.actualExecutionForbidden,
    actualProviderRoutingForbidden: p.actualProviderRoutingForbidden,
    actualQueueControlForbidden: p.actualQueueControlForbidden,
    actualRollbackForbidden: p.actualRollbackForbidden,
    actualPromptMutationForbidden: p.actualPromptMutationForbidden,
    actualTokenEnforcementForbidden: p.actualTokenEnforcementForbidden,
    actualContextPruningForbidden: p.actualContextPruningForbidden,
    actualMergeBlockingForbidden: p.actualMergeBlockingForbidden,
    proofRows: sortKo(p.proofRows),
    recommendations: sortKo(p.recommendations),
  };
}

function serializeBlockerReport(b: RuntimeReleaseGatePreflightBlockerReport): Readonly<Record<string, unknown>> {
  return {
    mode: b.mode,
    actualRuntimeOrchestrationEnabled: b.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: b.actualPilotExecutionEnabled,
    actualNoopShellExecutionEnabled: b.actualNoopShellExecutionEnabled,
    actualExecutionShellExecutionEnabled: b.actualExecutionShellExecutionEnabled,
    actualReleaseEnforcementEnabled: b.actualReleaseEnforcementEnabled,
    actualRuntimeAdapterInvocationEnabled: b.actualRuntimeAdapterInvocationEnabled,
    actualExecutionEnabled: b.actualExecutionEnabled,
    actualProviderRoutingEnabled: b.actualProviderRoutingEnabled,
    actualQueueControlEnabled: b.actualQueueControlEnabled,
    actualRollbackExecutionEnabled: b.actualRollbackExecutionEnabled,
    blockers: sortKo(b.blockers),
    recommendations: sortKo(b.recommendations),
  };
}

function serializeChecklist(c: RuntimeReleaseGatePreflightChecklist): Readonly<Record<string, unknown>> {
  return {
    mode: c.mode,
    ...SERIALIZED_ACTUAL_FLAGS_DISABLED,
    checklist: sortKo(c.checklist),
    missingRows: sortKo(c.missingRows),
    blockers: sortKo(c.blockers),
    recommendations: sortKo(c.recommendations),
  };
}

export function serializeRuntimeReleaseGatePreflightDiagnosticBundleFromSemanticReports(
  reports: RuntimeSemanticPlanningReports
): Readonly<{
  runtimeReleaseGatePreflightSummary: ReturnType<typeof serializePreflightSummary>;
  runtimeReleaseGateExecutionReadinessBoundary: ReturnType<typeof serializeExecutionReadinessBoundary>;
  runtimeReleaseGateInputEnvelope: ReturnType<typeof serializeEnvelope>;
  runtimeReleaseGateOutputEnvelope: ReturnType<typeof serializeEnvelope>;
  runtimeReleaseGateNoExecutionProof: ReturnType<typeof serializeNoExecutionProof>;
  runtimeReleaseGateOperationForbiddenProof: ReturnType<typeof serializeOperationForbiddenProof>;
  runtimeReleaseGatePreflightBlockerReport: ReturnType<typeof serializeBlockerReport>;
  runtimeReleaseGatePreflightChecklist: ReturnType<typeof serializeChecklist>;
}> {
  return {
    runtimeReleaseGatePreflightSummary: serializePreflightSummary(reports.runtimeReleaseGatePreflightSummary),
    runtimeReleaseGateExecutionReadinessBoundary: serializeExecutionReadinessBoundary(
      reports.runtimeReleaseGateExecutionReadinessBoundary
    ),
    runtimeReleaseGateInputEnvelope: serializeEnvelope(reports.runtimeReleaseGateInputEnvelope),
    runtimeReleaseGateOutputEnvelope: serializeEnvelope(reports.runtimeReleaseGateOutputEnvelope),
    runtimeReleaseGateNoExecutionProof: serializeNoExecutionProof(reports.runtimeReleaseGateNoExecutionProof),
    runtimeReleaseGateOperationForbiddenProof: serializeOperationForbiddenProof(
      reports.runtimeReleaseGateOperationForbiddenProof
    ),
    runtimeReleaseGatePreflightBlockerReport: serializeBlockerReport(
      reports.runtimeReleaseGatePreflightBlockerReport
    ),
    runtimeReleaseGatePreflightChecklist: serializeChecklist(reports.runtimeReleaseGatePreflightChecklist),
  };
}
