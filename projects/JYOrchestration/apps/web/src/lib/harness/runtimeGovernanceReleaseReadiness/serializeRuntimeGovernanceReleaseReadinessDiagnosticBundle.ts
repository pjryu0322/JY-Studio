/**
 * H38 — governance release-readiness 진단 **직렬화 전용**(report 재빌드 없음).
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type {
  RuntimeExecutionGovernanceForbiddenProof,
  RuntimeGovernanceNoEnforcementProof,
  RuntimeGovernanceReleaseBlockerReport,
  RuntimeGovernanceReleaseInputEnvelope,
  RuntimeGovernanceReleaseOutputEnvelope,
  RuntimeGovernanceReleaseReadinessBoundary,
  RuntimeGovernanceReleaseReadinessChecklist,
  RuntimeGovernanceReleaseReadinessSummary,
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
  };
}
