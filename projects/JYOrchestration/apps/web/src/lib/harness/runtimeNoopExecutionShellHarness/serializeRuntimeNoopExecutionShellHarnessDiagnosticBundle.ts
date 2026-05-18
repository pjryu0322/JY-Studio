/**
 * H32 — controlled execution shell harness 진단 **직렬화 전용**(report 재빌드 없음).
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type {
  RuntimeNoopExecutionShellContractBoundary,
  RuntimeNoopExecutionShellHarnessBlockerReport,
  RuntimeNoopExecutionShellHarnessInputEnvelope,
  RuntimeNoopExecutionShellHarnessOutputEnvelope,
  RuntimeNoopExecutionShellHarnessPreflightSummary,
  RuntimeNoopExecutionShellHarnessSafetyGuard,
  RuntimeNoopExecutionShellHarnessSummary,
  RuntimeNoopExecutionShellNoopResultMetadata,
} from "./runtimeNoopExecutionShellHarnessTypes";

function sortKo(rows: readonly string[]): readonly string[] {
  return [...rows].sort((a, b) => a.localeCompare(b, "ko"));
}

function harnessActualFlags(s: {
  actualRuntimeOrchestrationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualIsolatedRunnerInvocationEnabled: false;
  actualIsolatedRunnerExecutionEnabled: false;
  actualDryRunRunnerInvocationEnabled: false;
  actualDryRunRunnerExecutionEnabled: false;
  actualNoopShellExecutionEnabled: false;
  actualExecutionShellExecutionEnabled: false;
  actualRuntimeAdapterInvocationEnabled: false;
  actualExecutionEnabled: false;
  actualProviderRoutingEnabled: false;
  actualQueueControlEnabled: false;
  actualRollbackExecutionEnabled: false;
}): Readonly<Record<string, unknown>> {
  return {
    actualRuntimeOrchestrationEnabled: s.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: s.actualPilotExecutionEnabled,
    actualIsolatedRunnerInvocationEnabled: s.actualIsolatedRunnerInvocationEnabled,
    actualIsolatedRunnerExecutionEnabled: s.actualIsolatedRunnerExecutionEnabled,
    actualDryRunRunnerInvocationEnabled: s.actualDryRunRunnerInvocationEnabled,
    actualDryRunRunnerExecutionEnabled: s.actualDryRunRunnerExecutionEnabled,
    actualNoopShellExecutionEnabled: s.actualNoopShellExecutionEnabled,
    actualExecutionShellExecutionEnabled: s.actualExecutionShellExecutionEnabled,
    actualRuntimeAdapterInvocationEnabled: s.actualRuntimeAdapterInvocationEnabled,
    actualExecutionEnabled: s.actualExecutionEnabled,
    actualProviderRoutingEnabled: s.actualProviderRoutingEnabled,
    actualQueueControlEnabled: s.actualQueueControlEnabled,
    actualRollbackExecutionEnabled: s.actualRollbackExecutionEnabled,
  };
}

function serializeSummary(s: RuntimeNoopExecutionShellHarnessSummary): Readonly<Record<string, unknown>> {
  return {
    mode: s.mode,
    ...harnessActualFlags(s),
    harnessReadiness: s.harnessReadiness,
    harnessMode: s.harnessMode,
    rationaleKo: s.rationaleKo,
    harnessBlockers: sortKo(s.harnessBlockers),
    recommendations: sortKo(s.recommendations),
  };
}

function serializeContractBoundary(b: RuntimeNoopExecutionShellContractBoundary): Readonly<Record<string, unknown>> {
  return {
    mode: b.mode,
    ...harnessActualFlags(b),
    boundarySourceLayer: b.boundarySourceLayer,
    boundaryTargetLayer: b.boundaryTargetLayer,
    allowedContractScopes: sortKo(b.allowedContractScopes),
    requiredContractInputs: sortKo(b.requiredContractInputs),
    expectedContractOutputs: sortKo(b.expectedContractOutputs),
    forbiddenContractOperations: sortKo(b.forbiddenContractOperations),
    recommendations: sortKo(b.recommendations),
  };
}

function serializeInputEnvelope(e: RuntimeNoopExecutionShellHarnessInputEnvelope): Readonly<Record<string, unknown>> {
  return {
    mode: e.mode,
    ...harnessActualFlags(e),
    envelopeRows: sortKo(e.envelopeRows),
    recommendations: sortKo(e.recommendations),
  };
}

function serializeOutputEnvelope(e: RuntimeNoopExecutionShellHarnessOutputEnvelope): Readonly<Record<string, unknown>> {
  return {
    mode: e.mode,
    ...harnessActualFlags(e),
    envelopeRows: sortKo(e.envelopeRows),
    recommendations: sortKo(e.recommendations),
  };
}

function serializeResult(r: RuntimeNoopExecutionShellNoopResultMetadata): Readonly<Record<string, unknown>> {
  return {
    mode: r.mode,
    ...harnessActualFlags(r),
    noopShellExecuted: r.noopShellExecuted,
    executionShellExecuted: r.executionShellExecuted,
    runtimeAdapterInvoked: r.runtimeAdapterInvoked,
    executionPerformed: r.executionPerformed,
    providerRoutingPerformed: r.providerRoutingPerformed,
    queueControlPerformed: r.queueControlPerformed,
    rollbackPerformed: r.rollbackPerformed,
    promptMutated: r.promptMutated,
    tokenEnforced: r.tokenEnforced,
    contextPruned: r.contextPruned,
    diagnosticOnly: r.diagnosticOnly,
    resultRows: sortKo(r.resultRows),
    recommendations: sortKo(r.recommendations),
  };
}

function serializeGuard(g: RuntimeNoopExecutionShellHarnessSafetyGuard): Readonly<Record<string, unknown>> {
  return {
    mode: g.mode,
    ...harnessActualFlags(g),
    actualShellExecutionForbidden: g.actualShellExecutionForbidden,
    actualExecutionForbidden: g.actualExecutionForbidden,
    actualAdapterInvocationForbidden: g.actualAdapterInvocationForbidden,
    actualProviderRoutingForbidden: g.actualProviderRoutingForbidden,
    actualQueueControlForbidden: g.actualQueueControlForbidden,
    actualRollbackForbidden: g.actualRollbackForbidden,
    actualPromptMutationForbidden: g.actualPromptMutationForbidden,
    actualTokenEnforcementForbidden: g.actualTokenEnforcementForbidden,
    actualContextPruningForbidden: g.actualContextPruningForbidden,
    guardRows: sortKo(g.guardRows),
    recommendations: sortKo(g.recommendations),
  };
}

function serializeBlockers(b: RuntimeNoopExecutionShellHarnessBlockerReport): Readonly<Record<string, unknown>> {
  return {
    mode: b.mode,
    actualRuntimeOrchestrationEnabled: b.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: b.actualPilotExecutionEnabled,
    actualIsolatedRunnerInvocationEnabled: b.actualIsolatedRunnerInvocationEnabled,
    actualDryRunRunnerInvocationEnabled: b.actualDryRunRunnerInvocationEnabled,
    blockers: sortKo(b.blockers),
    recommendations: sortKo(b.recommendations),
  };
}

function serializePreflight(p: RuntimeNoopExecutionShellHarnessPreflightSummary): Readonly<Record<string, unknown>> {
  return {
    mode: p.mode,
    actualRuntimeOrchestrationEnabled: p.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: p.actualPilotExecutionEnabled,
    actualNoopShellExecutionEnabled: p.actualNoopShellExecutionEnabled,
    actualExecutionShellExecutionEnabled: p.actualExecutionShellExecutionEnabled,
    preflightReadiness: p.preflightReadiness,
    checklist: sortKo(p.checklist),
    blockers: sortKo(p.blockers),
    recommendations: sortKo(p.recommendations),
  };
}

export function serializeRuntimeNoopExecutionShellHarnessDiagnosticBundleFromSemanticReports(
  reports: RuntimeSemanticPlanningReports
): Readonly<{
  runtimeNoopExecutionShellHarnessSummary: ReturnType<typeof serializeSummary>;
  runtimeNoopExecutionShellContractBoundary: ReturnType<typeof serializeContractBoundary>;
  runtimeNoopExecutionShellHarnessInputEnvelope: ReturnType<typeof serializeInputEnvelope>;
  runtimeNoopExecutionShellHarnessOutputEnvelope: ReturnType<typeof serializeOutputEnvelope>;
  runtimeNoopExecutionShellNoopResultMetadata: ReturnType<typeof serializeResult>;
  runtimeNoopExecutionShellHarnessSafetyGuard: ReturnType<typeof serializeGuard>;
  runtimeNoopExecutionShellHarnessBlockerReport: ReturnType<typeof serializeBlockers>;
  runtimeNoopExecutionShellHarnessPreflightSummary: ReturnType<typeof serializePreflight>;
}> {
  return {
    runtimeNoopExecutionShellHarnessSummary: serializeSummary(reports.runtimeNoopExecutionShellHarnessSummary),
    runtimeNoopExecutionShellContractBoundary: serializeContractBoundary(
      reports.runtimeNoopExecutionShellContractBoundary
    ),
    runtimeNoopExecutionShellHarnessInputEnvelope: serializeInputEnvelope(
      reports.runtimeNoopExecutionShellHarnessInputEnvelope
    ),
    runtimeNoopExecutionShellHarnessOutputEnvelope: serializeOutputEnvelope(
      reports.runtimeNoopExecutionShellHarnessOutputEnvelope
    ),
    runtimeNoopExecutionShellNoopResultMetadata: serializeResult(reports.runtimeNoopExecutionShellNoopResultMetadata),
    runtimeNoopExecutionShellHarnessSafetyGuard: serializeGuard(reports.runtimeNoopExecutionShellHarnessSafetyGuard),
    runtimeNoopExecutionShellHarnessBlockerReport: serializeBlockers(
      reports.runtimeNoopExecutionShellHarnessBlockerReport
    ),
    runtimeNoopExecutionShellHarnessPreflightSummary: serializePreflight(
      reports.runtimeNoopExecutionShellHarnessPreflightSummary
    ),
  };
}
