/**
 * H26 — adapter sandbox 진단 **직렬화 전용**(report 재빌드 없음).
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type {
  RuntimeAdapterSandboxBlockerReport,
  RuntimeAdapterSandboxInputEnvelope,
  RuntimeAdapterSandboxOutputEnvelope,
  RuntimeAdapterSandboxPolicy,
  RuntimeAdapterSandboxResultMetadata,
  RuntimeAdapterSandboxSummary,
} from "./runtimeAdapterSandboxTypes";

function sortKo(rows: readonly string[]): readonly string[] {
  return [...rows].sort((a, b) => a.localeCompare(b, "ko"));
}

function serializeSummary(s: RuntimeAdapterSandboxSummary): Readonly<Record<string, unknown>> {
  return {
    mode: s.mode,
    actualRuntimeOrchestrationEnabled: s.actualRuntimeOrchestrationEnabled,
    actualRuntimeAdapterInvocationEnabled: s.actualRuntimeAdapterInvocationEnabled,
    actualSandboxInvocationEnabled: s.actualSandboxInvocationEnabled,
    actualExecutionEnabled: s.actualExecutionEnabled,
    actualProviderRoutingEnabled: s.actualProviderRoutingEnabled,
    actualQueueControlEnabled: s.actualQueueControlEnabled,
    actualRollbackExecutionEnabled: s.actualRollbackExecutionEnabled,
    sandboxReadiness: s.sandboxReadiness,
    sandboxMode: s.sandboxMode,
    rationaleKo: s.rationaleKo,
    sandboxBlockers: sortKo(s.sandboxBlockers),
    recommendations: sortKo(s.recommendations),
  };
}

function serializeInput(e: RuntimeAdapterSandboxInputEnvelope): Readonly<Record<string, unknown>> {
  return {
    mode: e.mode,
    actualRuntimeOrchestrationEnabled: e.actualRuntimeOrchestrationEnabled,
    actualRuntimeAdapterInvocationEnabled: e.actualRuntimeAdapterInvocationEnabled,
    actualSandboxInvocationEnabled: e.actualSandboxInvocationEnabled,
    envelopeRows: sortKo(e.envelopeRows),
    recommendations: sortKo(e.recommendations),
  };
}

function serializeOutput(o: RuntimeAdapterSandboxOutputEnvelope): Readonly<Record<string, unknown>> {
  return {
    mode: o.mode,
    actualRuntimeOrchestrationEnabled: o.actualRuntimeOrchestrationEnabled,
    actualRuntimeAdapterInvocationEnabled: o.actualRuntimeAdapterInvocationEnabled,
    actualSandboxInvocationEnabled: o.actualSandboxInvocationEnabled,
    acceptedMetadataRows: sortKo(o.acceptedMetadataRows),
    rejectedMetadataRows: sortKo(o.rejectedMetadataRows),
    safetyEnvelopeRows: sortKo(o.safetyEnvelopeRows),
    recommendations: sortKo(o.recommendations),
  };
}

function serializePolicy(p: RuntimeAdapterSandboxPolicy): Readonly<Record<string, unknown>> {
  return {
    mode: p.mode,
    actualRuntimeOrchestrationEnabled: p.actualRuntimeOrchestrationEnabled,
    actualRuntimeAdapterInvocationEnabled: p.actualRuntimeAdapterInvocationEnabled,
    actualSandboxInvocationEnabled: p.actualSandboxInvocationEnabled,
    allowedSandboxMetadataScopes: sortKo(p.allowedSandboxMetadataScopes),
    forbiddenSandboxOperations: sortKo(p.forbiddenSandboxOperations),
    sandboxActivationConditions: sortKo(p.sandboxActivationConditions),
    sandboxDeactivationConditions: sortKo(p.sandboxDeactivationConditions),
    recommendations: sortKo(p.recommendations),
  };
}

function serializeResult(r: RuntimeAdapterSandboxResultMetadata): Readonly<Record<string, unknown>> {
  return {
    mode: r.mode,
    actualRuntimeOrchestrationEnabled: r.actualRuntimeOrchestrationEnabled,
    actualRuntimeAdapterInvocationEnabled: r.actualRuntimeAdapterInvocationEnabled,
    actualSandboxInvocationEnabled: r.actualSandboxInvocationEnabled,
    actualExecutionEnabled: r.actualExecutionEnabled,
    actualProviderRoutingEnabled: r.actualProviderRoutingEnabled,
    actualQueueControlEnabled: r.actualQueueControlEnabled,
    actualRollbackExecutionEnabled: r.actualRollbackExecutionEnabled,
    sandboxInvoked: r.sandboxInvoked,
    adapterInvoked: r.adapterInvoked,
    executionPerformed: r.executionPerformed,
    providerRoutingPerformed: r.providerRoutingPerformed,
    queueControlPerformed: r.queueControlPerformed,
    rollbackPerformed: r.rollbackPerformed,
    diagnosticOnly: r.diagnosticOnly,
    resultRows: sortKo(r.resultRows),
  };
}

function serializeBlockers(b: RuntimeAdapterSandboxBlockerReport): Readonly<Record<string, unknown>> {
  return {
    mode: b.mode,
    actualRuntimeOrchestrationEnabled: b.actualRuntimeOrchestrationEnabled,
    actualRuntimeAdapterInvocationEnabled: b.actualRuntimeAdapterInvocationEnabled,
    actualSandboxInvocationEnabled: b.actualSandboxInvocationEnabled,
    blockers: sortKo(b.blockers),
    recommendations: sortKo(b.recommendations),
  };
}

export function serializeRuntimeAdapterSandboxDiagnosticBundleFromSemanticReports(
  reports: RuntimeSemanticPlanningReports
): Readonly<{
  runtimeAdapterSandboxSummary: ReturnType<typeof serializeSummary>;
  runtimeAdapterSandboxInputEnvelope: ReturnType<typeof serializeInput>;
  runtimeAdapterSandboxOutputEnvelope: ReturnType<typeof serializeOutput>;
  runtimeAdapterSandboxPolicy: ReturnType<typeof serializePolicy>;
  runtimeAdapterSandboxResultMetadata: ReturnType<typeof serializeResult>;
  runtimeAdapterSandboxBlockerReport: ReturnType<typeof serializeBlockers>;
}> {
  return {
    runtimeAdapterSandboxSummary: serializeSummary(reports.runtimeAdapterSandboxSummary),
    runtimeAdapterSandboxInputEnvelope: serializeInput(reports.runtimeAdapterSandboxInputEnvelope),
    runtimeAdapterSandboxOutputEnvelope: serializeOutput(reports.runtimeAdapterSandboxOutputEnvelope),
    runtimeAdapterSandboxPolicy: serializePolicy(reports.runtimeAdapterSandboxPolicy),
    runtimeAdapterSandboxResultMetadata: serializeResult(reports.runtimeAdapterSandboxResultMetadata),
    runtimeAdapterSandboxBlockerReport: serializeBlockers(reports.runtimeAdapterSandboxBlockerReport),
  };
}
