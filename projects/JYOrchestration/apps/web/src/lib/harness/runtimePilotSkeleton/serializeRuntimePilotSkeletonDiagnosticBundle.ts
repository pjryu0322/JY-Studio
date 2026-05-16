/**
 * H28 — pilot skeleton 진단 **직렬화 전용**(report 재빌드 없음).
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type {
  RuntimeDryRunRunnerContract,
  RuntimePilotRunnerInputEnvelope,
  RuntimePilotRunnerOutputEnvelope,
  RuntimePilotRunnerSafetyGuard,
  RuntimePilotSkeletonBlockerReport,
  RuntimePilotSkeletonSummary,
} from "./runtimePilotSkeletonTypes";

function sortKo(rows: readonly string[]): readonly string[] {
  return [...rows].sort((a, b) => a.localeCompare(b, "ko"));
}

function serializeSummary(s: RuntimePilotSkeletonSummary): Readonly<Record<string, unknown>> {
  return {
    mode: s.mode,
    actualRuntimeOrchestrationEnabled: s.actualRuntimeOrchestrationEnabled,
    actualPilotActivationEnabled: s.actualPilotActivationEnabled,
    actualPilotExecutionEnabled: s.actualPilotExecutionEnabled,
    actualIsolatedRunnerExecutionEnabled: s.actualIsolatedRunnerExecutionEnabled,
    actualDryRunRunnerExecutionEnabled: s.actualDryRunRunnerExecutionEnabled,
    actualRuntimeAdapterInvocationEnabled: s.actualRuntimeAdapterInvocationEnabled,
    actualExecutionEnabled: s.actualExecutionEnabled,
    actualProviderRoutingEnabled: s.actualProviderRoutingEnabled,
    actualQueueControlEnabled: s.actualQueueControlEnabled,
    actualRollbackExecutionEnabled: s.actualRollbackExecutionEnabled,
    skeletonReadiness: s.skeletonReadiness,
    runnerMode: s.runnerMode,
    rationaleKo: s.rationaleKo,
    skeletonBlockers: sortKo(s.skeletonBlockers),
    recommendations: sortKo(s.recommendations),
  };
}

function serializeContract(c: RuntimeDryRunRunnerContract): Readonly<Record<string, unknown>> {
  return {
    mode: c.mode,
    actualRuntimeOrchestrationEnabled: c.actualRuntimeOrchestrationEnabled,
    actualPilotActivationEnabled: c.actualPilotActivationEnabled,
    actualPilotExecutionEnabled: c.actualPilotExecutionEnabled,
    actualIsolatedRunnerExecutionEnabled: c.actualIsolatedRunnerExecutionEnabled,
    actualDryRunRunnerExecutionEnabled: c.actualDryRunRunnerExecutionEnabled,
    runnerName: c.runnerName,
    runnerMode: c.runnerMode,
    requiredInputMetadata: sortKo(c.requiredInputMetadata),
    expectedOutputMetadata: sortKo(c.expectedOutputMetadata),
    forbiddenRunnerOperations: sortKo(c.forbiddenRunnerOperations),
    runnerNoExecutionGuarantees: sortKo(c.runnerNoExecutionGuarantees),
    recommendations: sortKo(c.recommendations),
  };
}

function serializeInput(e: RuntimePilotRunnerInputEnvelope): Readonly<Record<string, unknown>> {
  return {
    mode: e.mode,
    actualRuntimeOrchestrationEnabled: e.actualRuntimeOrchestrationEnabled,
    actualPilotActivationEnabled: e.actualPilotActivationEnabled,
    actualPilotExecutionEnabled: e.actualPilotExecutionEnabled,
    actualIsolatedRunnerExecutionEnabled: e.actualIsolatedRunnerExecutionEnabled,
    actualDryRunRunnerExecutionEnabled: e.actualDryRunRunnerExecutionEnabled,
    envelopeRows: sortKo(e.envelopeRows),
    recommendations: sortKo(e.recommendations),
  };
}

function serializeOutput(o: RuntimePilotRunnerOutputEnvelope): Readonly<Record<string, unknown>> {
  return {
    mode: o.mode,
    actualRuntimeOrchestrationEnabled: o.actualRuntimeOrchestrationEnabled,
    actualPilotActivationEnabled: o.actualPilotActivationEnabled,
    actualPilotExecutionEnabled: o.actualPilotExecutionEnabled,
    actualIsolatedRunnerExecutionEnabled: o.actualIsolatedRunnerExecutionEnabled,
    actualDryRunRunnerExecutionEnabled: o.actualDryRunRunnerExecutionEnabled,
    acceptedMetadataRows: sortKo(o.acceptedMetadataRows),
    rejectedMetadataRows: sortKo(o.rejectedMetadataRows),
    safetyEnvelopeRows: sortKo(o.safetyEnvelopeRows),
    recommendations: sortKo(o.recommendations),
  };
}

function serializeGuard(g: RuntimePilotRunnerSafetyGuard): Readonly<Record<string, unknown>> {
  return {
    mode: g.mode,
    actualRuntimeOrchestrationEnabled: g.actualRuntimeOrchestrationEnabled,
    actualPilotActivationEnabled: g.actualPilotActivationEnabled,
    actualPilotExecutionEnabled: g.actualPilotExecutionEnabled,
    actualIsolatedRunnerExecutionEnabled: g.actualIsolatedRunnerExecutionEnabled,
    actualDryRunRunnerExecutionEnabled: g.actualDryRunRunnerExecutionEnabled,
    actualExecutionForbidden: g.actualExecutionForbidden,
    actualAdapterInvocationForbidden: g.actualAdapterInvocationForbidden,
    actualProviderRoutingForbidden: g.actualProviderRoutingForbidden,
    actualQueueControlForbidden: g.actualQueueControlForbidden,
    actualRollbackForbidden: g.actualRollbackForbidden,
    actualPromptMutationForbidden: g.actualPromptMutationForbidden,
    guardRows: sortKo(g.guardRows),
    recommendations: sortKo(g.recommendations),
  };
}

function serializeBlockers(b: RuntimePilotSkeletonBlockerReport): Readonly<Record<string, unknown>> {
  return {
    mode: b.mode,
    actualRuntimeOrchestrationEnabled: b.actualRuntimeOrchestrationEnabled,
    actualPilotActivationEnabled: b.actualPilotActivationEnabled,
    actualPilotExecutionEnabled: b.actualPilotExecutionEnabled,
    actualIsolatedRunnerExecutionEnabled: b.actualIsolatedRunnerExecutionEnabled,
    actualDryRunRunnerExecutionEnabled: b.actualDryRunRunnerExecutionEnabled,
    blockers: sortKo(b.blockers),
    recommendations: sortKo(b.recommendations),
  };
}

export function serializeRuntimePilotSkeletonDiagnosticBundleFromSemanticReports(
  reports: RuntimeSemanticPlanningReports
): Readonly<{
  runtimePilotSkeletonSummary: ReturnType<typeof serializeSummary>;
  runtimeDryRunRunnerContract: ReturnType<typeof serializeContract>;
  runtimePilotRunnerInputEnvelope: ReturnType<typeof serializeInput>;
  runtimePilotRunnerOutputEnvelope: ReturnType<typeof serializeOutput>;
  runtimePilotRunnerSafetyGuard: ReturnType<typeof serializeGuard>;
  runtimePilotSkeletonBlockerReport: ReturnType<typeof serializeBlockers>;
}> {
  return {
    runtimePilotSkeletonSummary: serializeSummary(reports.runtimePilotSkeletonSummary),
    runtimeDryRunRunnerContract: serializeContract(reports.runtimeDryRunRunnerContract),
    runtimePilotRunnerInputEnvelope: serializeInput(reports.runtimePilotRunnerInputEnvelope),
    runtimePilotRunnerOutputEnvelope: serializeOutput(reports.runtimePilotRunnerOutputEnvelope),
    runtimePilotRunnerSafetyGuard: serializeGuard(reports.runtimePilotRunnerSafetyGuard),
    runtimePilotSkeletonBlockerReport: serializeBlockers(reports.runtimePilotSkeletonBlockerReport),
  };
}
