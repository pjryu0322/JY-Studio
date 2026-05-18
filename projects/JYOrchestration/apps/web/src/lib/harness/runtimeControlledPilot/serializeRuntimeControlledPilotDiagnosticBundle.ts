/**
 * H24 — controlled pilot 진단 **직렬화 전용**(report 재빌드 없음).
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type {
  RuntimeControlledPilotAbortConditions,
  RuntimeControlledPilotFallbackPlan,
  RuntimeControlledPilotSafetyEnvelope,
  RuntimeControlledPilotSummary,
} from "./runtimeControlledPilotTypes";

function sortKo(rows: readonly string[]): readonly string[] {
  return [...rows].sort((a, b) => a.localeCompare(b, "ko"));
}

function serializeSummary(s: RuntimeControlledPilotSummary): Readonly<Record<string, unknown>> {
  return {
    mode: s.mode,
    actualRuntimeOrchestrationEnabled: s.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: s.actualPilotExecutionEnabled,
    actualExecutionEnabled: s.actualExecutionEnabled,
    actualProviderRoutingEnabled: s.actualProviderRoutingEnabled,
    actualQueueControlEnabled: s.actualQueueControlEnabled,
    actualRollbackExecutionEnabled: s.actualRollbackExecutionEnabled,
    readiness: s.readiness,
    pilotScope: s.pilotScope,
    rationaleKo: s.rationaleKo,
    candidateFlowKo: s.candidateFlowKo,
    safetyBlockers: sortKo(s.safetyBlockers),
    fallbackRequirements: sortKo(s.fallbackRequirements),
    abortConditionMetadata: sortKo(s.abortConditionMetadata),
    recommendations: sortKo(s.recommendations),
  };
}

function serializeEnvelope(e: RuntimeControlledPilotSafetyEnvelope): Readonly<Record<string, unknown>> {
  return {
    mode: e.mode,
    actualRuntimeOrchestrationEnabled: e.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: e.actualPilotExecutionEnabled,
    actualExecutionEnabled: e.actualExecutionEnabled,
    actualProviderRoutingEnabled: e.actualProviderRoutingEnabled,
    actualQueueControlEnabled: e.actualQueueControlEnabled,
    actualRollbackExecutionEnabled: e.actualRollbackExecutionEnabled,
    allowedPilotMetadataScopes: sortKo(e.allowedPilotMetadataScopes),
    forbiddenPilotExecutionScopes: sortKo(e.forbiddenPilotExecutionScopes),
    safetyBlockers: sortKo(e.safetyBlockers),
    safetyWarnings: sortKo(e.safetyWarnings),
  };
}

function serializeFallback(f: RuntimeControlledPilotFallbackPlan): Readonly<Record<string, unknown>> {
  return {
    mode: f.mode,
    actualRuntimeOrchestrationEnabled: f.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: f.actualPilotExecutionEnabled,
    actualRollbackExecutionEnabled: f.actualRollbackExecutionEnabled,
    fallbackPrerequisites: sortKo(f.fallbackPrerequisites),
    recommendations: sortKo(f.recommendations),
  };
}

function serializeAbort(a: RuntimeControlledPilotAbortConditions): Readonly<Record<string, unknown>> {
  return {
    mode: a.mode,
    actualRuntimeOrchestrationEnabled: a.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: a.actualPilotExecutionEnabled,
    abortConditions: sortKo(a.abortConditions),
    recommendations: sortKo(a.recommendations),
  };
}

export function serializeRuntimeControlledPilotDiagnosticBundleFromSemanticReports(
  reports: RuntimeSemanticPlanningReports
): Readonly<{
  runtimeControlledPilotSummary: ReturnType<typeof serializeSummary>;
  runtimeControlledPilotSafetyEnvelope: ReturnType<typeof serializeEnvelope>;
  runtimeControlledPilotFallbackPlan: ReturnType<typeof serializeFallback>;
  runtimeControlledPilotAbortConditions: ReturnType<typeof serializeAbort>;
}> {
  return {
    runtimeControlledPilotSummary: serializeSummary(reports.runtimeControlledPilotSummary),
    runtimeControlledPilotSafetyEnvelope: serializeEnvelope(reports.runtimeControlledPilotSafetyEnvelope),
    runtimeControlledPilotFallbackPlan: serializeFallback(reports.runtimeControlledPilotFallbackPlan),
    runtimeControlledPilotAbortConditions: serializeAbort(reports.runtimeControlledPilotAbortConditions),
  };
}
