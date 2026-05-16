/**
 * H30 — runner no-op harness 진단 **직렬화 전용**(report 재빌드 없음).
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type {
  RuntimeRunnerNoopHarnessAlignmentReport,
  RuntimeRunnerNoopHarnessBoundaryViolationReport,
  RuntimeRunnerNoopHarnessContractVerificationReport,
  RuntimeRunnerNoopHarnessFinalSafetyGate,
  RuntimeRunnerNoopHarnessPreflightSummary,
  RuntimeRunnerNoopHarnessReadinessVerificationReport,
  RuntimeRunnerNoopHarnessSafetyGuard,
  RuntimeRunnerNoopHarnessSummary,
  RuntimeRunnerNoopInvocationEnvelope,
  RuntimeRunnerNoopResultMetadata,
} from "./runtimeRunnerNoopHarnessTypes";

function sortKo(rows: readonly string[]): readonly string[] {
  return [...rows].sort((a, b) => a.localeCompare(b, "ko"));
}

function serializeSummary(s: RuntimeRunnerNoopHarnessSummary): Readonly<Record<string, unknown>> {
  return {
    mode: s.mode,
    actualRuntimeOrchestrationEnabled: s.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: s.actualPilotExecutionEnabled,
    actualIsolatedRunnerInvocationEnabled: s.actualIsolatedRunnerInvocationEnabled,
    actualIsolatedRunnerExecutionEnabled: s.actualIsolatedRunnerExecutionEnabled,
    actualDryRunRunnerInvocationEnabled: s.actualDryRunRunnerInvocationEnabled,
    actualDryRunRunnerExecutionEnabled: s.actualDryRunRunnerExecutionEnabled,
    actualRuntimeAdapterInvocationEnabled: s.actualRuntimeAdapterInvocationEnabled,
    actualExecutionEnabled: s.actualExecutionEnabled,
    actualProviderRoutingEnabled: s.actualProviderRoutingEnabled,
    actualQueueControlEnabled: s.actualQueueControlEnabled,
    actualRollbackExecutionEnabled: s.actualRollbackExecutionEnabled,
    harnessReadiness: s.harnessReadiness,
    harnessMode: s.harnessMode,
    rationaleKo: s.rationaleKo,
    harnessBlockers: sortKo(s.harnessBlockers),
    recommendations: sortKo(s.recommendations),
  };
}

function serializeEnvelope(e: RuntimeRunnerNoopInvocationEnvelope): Readonly<Record<string, unknown>> {
  return {
    mode: e.mode,
    actualRuntimeOrchestrationEnabled: e.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: e.actualPilotExecutionEnabled,
    actualIsolatedRunnerInvocationEnabled: e.actualIsolatedRunnerInvocationEnabled,
    actualIsolatedRunnerExecutionEnabled: e.actualIsolatedRunnerExecutionEnabled,
    actualDryRunRunnerInvocationEnabled: e.actualDryRunRunnerInvocationEnabled,
    actualDryRunRunnerExecutionEnabled: e.actualDryRunRunnerExecutionEnabled,
    actualRuntimeAdapterInvocationEnabled: e.actualRuntimeAdapterInvocationEnabled,
    actualExecutionEnabled: e.actualExecutionEnabled,
    actualProviderRoutingEnabled: e.actualProviderRoutingEnabled,
    actualQueueControlEnabled: e.actualQueueControlEnabled,
    actualRollbackExecutionEnabled: e.actualRollbackExecutionEnabled,
    envelopeRows: sortKo(e.envelopeRows),
    recommendations: sortKo(e.recommendations),
  };
}

function serializeResult(r: RuntimeRunnerNoopResultMetadata): Readonly<Record<string, unknown>> {
  return {
    mode: r.mode,
    actualRuntimeOrchestrationEnabled: r.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: r.actualPilotExecutionEnabled,
    actualIsolatedRunnerInvocationEnabled: r.actualIsolatedRunnerInvocationEnabled,
    actualIsolatedRunnerExecutionEnabled: r.actualIsolatedRunnerExecutionEnabled,
    actualDryRunRunnerInvocationEnabled: r.actualDryRunRunnerInvocationEnabled,
    actualDryRunRunnerExecutionEnabled: r.actualDryRunRunnerExecutionEnabled,
    actualRuntimeAdapterInvocationEnabled: r.actualRuntimeAdapterInvocationEnabled,
    actualExecutionEnabled: r.actualExecutionEnabled,
    actualProviderRoutingEnabled: r.actualProviderRoutingEnabled,
    actualQueueControlEnabled: r.actualQueueControlEnabled,
    actualRollbackExecutionEnabled: r.actualRollbackExecutionEnabled,
    isolatedRunnerInvoked: r.isolatedRunnerInvoked,
    isolatedRunnerExecuted: r.isolatedRunnerExecuted,
    dryRunRunnerInvoked: r.dryRunRunnerInvoked,
    dryRunRunnerExecuted: r.dryRunRunnerExecuted,
    runtimeAdapterInvoked: r.runtimeAdapterInvoked,
    executionPerformed: r.executionPerformed,
    providerRoutingPerformed: r.providerRoutingPerformed,
    queueControlPerformed: r.queueControlPerformed,
    rollbackPerformed: r.rollbackPerformed,
    promptMutated: r.promptMutated,
    diagnosticOnly: r.diagnosticOnly,
    resultRows: sortKo(r.resultRows),
    recommendations: sortKo(r.recommendations),
  };
}

function serializeGuard(g: RuntimeRunnerNoopHarnessSafetyGuard): Readonly<Record<string, unknown>> {
  return {
    mode: g.mode,
    actualRuntimeOrchestrationEnabled: g.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: g.actualPilotExecutionEnabled,
    actualIsolatedRunnerInvocationEnabled: g.actualIsolatedRunnerInvocationEnabled,
    actualIsolatedRunnerExecutionEnabled: g.actualIsolatedRunnerExecutionEnabled,
    actualDryRunRunnerInvocationEnabled: g.actualDryRunRunnerInvocationEnabled,
    actualDryRunRunnerExecutionEnabled: g.actualDryRunRunnerExecutionEnabled,
    actualRuntimeAdapterInvocationEnabled: g.actualRuntimeAdapterInvocationEnabled,
    actualExecutionEnabled: g.actualExecutionEnabled,
    actualProviderRoutingEnabled: g.actualProviderRoutingEnabled,
    actualQueueControlEnabled: g.actualQueueControlEnabled,
    actualRollbackExecutionEnabled: g.actualRollbackExecutionEnabled,
    actualInvocationForbidden: g.actualInvocationForbidden,
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

function serializeContract(
  c: RuntimeRunnerNoopHarnessContractVerificationReport
): Readonly<Record<string, unknown>> {
  return {
    mode: c.mode,
    actualRuntimeOrchestrationEnabled: c.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: c.actualPilotExecutionEnabled,
    actualIsolatedRunnerInvocationEnabled: c.actualIsolatedRunnerInvocationEnabled,
    actualDryRunRunnerInvocationEnabled: c.actualDryRunRunnerInvocationEnabled,
    verificationStatus: c.verificationStatus,
    findings: sortKo(c.findings),
    recommendations: sortKo(c.recommendations),
  };
}

function serializeBoundary(
  b: RuntimeRunnerNoopHarnessBoundaryViolationReport
): Readonly<Record<string, unknown>> {
  return {
    mode: b.mode,
    actualRuntimeOrchestrationEnabled: b.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: b.actualPilotExecutionEnabled,
    actualIsolatedRunnerInvocationEnabled: b.actualIsolatedRunnerInvocationEnabled,
    actualDryRunRunnerInvocationEnabled: b.actualDryRunRunnerInvocationEnabled,
    actualFlagViolations: sortKo(b.actualFlagViolations),
    wordingRiskFindings: sortKo(b.wordingRiskFindings),
    recommendations: sortKo(b.recommendations),
  };
}

function serializeReadinessVerification(
  r: RuntimeRunnerNoopHarnessReadinessVerificationReport
): Readonly<Record<string, unknown>> {
  return {
    mode: r.mode,
    actualRuntimeOrchestrationEnabled: r.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: r.actualPilotExecutionEnabled,
    actualIsolatedRunnerInvocationEnabled: r.actualIsolatedRunnerInvocationEnabled,
    actualDryRunRunnerInvocationEnabled: r.actualDryRunRunnerInvocationEnabled,
    verificationStatus: r.verificationStatus,
    findings: sortKo(r.findings),
    recommendations: sortKo(r.recommendations),
  };
}

function serializeAlignment(a: RuntimeRunnerNoopHarnessAlignmentReport): Readonly<Record<string, unknown>> {
  return {
    mode: a.mode,
    actualRuntimeOrchestrationEnabled: a.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: a.actualPilotExecutionEnabled,
    actualIsolatedRunnerInvocationEnabled: a.actualIsolatedRunnerInvocationEnabled,
    actualDryRunRunnerInvocationEnabled: a.actualDryRunRunnerInvocationEnabled,
    alignmentStatus: a.alignmentStatus,
    findings: sortKo(a.findings),
    recommendations: sortKo(a.recommendations),
  };
}

function serializeFinalGate(g: RuntimeRunnerNoopHarnessFinalSafetyGate): Readonly<Record<string, unknown>> {
  return {
    mode: g.mode,
    actualRuntimeOrchestrationEnabled: g.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: g.actualPilotExecutionEnabled,
    actualIsolatedRunnerInvocationEnabled: g.actualIsolatedRunnerInvocationEnabled,
    actualIsolatedRunnerExecutionEnabled: g.actualIsolatedRunnerExecutionEnabled,
    actualDryRunRunnerInvocationEnabled: g.actualDryRunRunnerInvocationEnabled,
    actualDryRunRunnerExecutionEnabled: g.actualDryRunRunnerExecutionEnabled,
    actualRuntimeAdapterInvocationEnabled: g.actualRuntimeAdapterInvocationEnabled,
    actualExecutionEnabled: g.actualExecutionEnabled,
    actualProviderRoutingEnabled: g.actualProviderRoutingEnabled,
    actualQueueControlEnabled: g.actualQueueControlEnabled,
    actualRollbackExecutionEnabled: g.actualRollbackExecutionEnabled,
    finalGateStatus: g.finalGateStatus,
    h31EntryReadiness: g.h31EntryReadiness,
    checklist: sortKo(g.checklist),
    blockers: sortKo(g.blockers),
    recommendations: sortKo(g.recommendations),
  };
}

function serializePreflight(p: RuntimeRunnerNoopHarnessPreflightSummary): Readonly<Record<string, unknown>> {
  return {
    mode: p.mode,
    actualRuntimeOrchestrationEnabled: p.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: p.actualPilotExecutionEnabled,
    actualIsolatedRunnerInvocationEnabled: p.actualIsolatedRunnerInvocationEnabled,
    actualIsolatedRunnerExecutionEnabled: p.actualIsolatedRunnerExecutionEnabled,
    actualDryRunRunnerInvocationEnabled: p.actualDryRunRunnerInvocationEnabled,
    actualDryRunRunnerExecutionEnabled: p.actualDryRunRunnerExecutionEnabled,
    preflightReadiness: p.preflightReadiness,
    checklist: sortKo(p.checklist),
    blockers: sortKo(p.blockers),
    recommendations: sortKo(p.recommendations),
  };
}

export function serializeRuntimeRunnerNoopHarnessDiagnosticBundleFromSemanticReports(
  reports: RuntimeSemanticPlanningReports
): Readonly<{
  runtimeRunnerNoopHarnessSummary: ReturnType<typeof serializeSummary>;
  runtimeRunnerNoopInvocationEnvelope: ReturnType<typeof serializeEnvelope>;
  runtimeRunnerNoopResultMetadata: ReturnType<typeof serializeResult>;
  runtimeRunnerNoopHarnessSafetyGuard: ReturnType<typeof serializeGuard>;
  runtimeRunnerNoopHarnessContractVerificationReport: ReturnType<typeof serializeContract>;
  runtimeRunnerNoopHarnessBoundaryViolationReport: ReturnType<typeof serializeBoundary>;
  runtimeRunnerNoopHarnessPreflightSummary: ReturnType<typeof serializePreflight>;
  runtimeRunnerNoopHarnessReadinessVerificationReport: ReturnType<typeof serializeReadinessVerification>;
  runtimeRunnerNoopHarnessAlignmentReport: ReturnType<typeof serializeAlignment>;
  runtimeRunnerNoopHarnessFinalSafetyGate: ReturnType<typeof serializeFinalGate>;
}> {
  return {
    runtimeRunnerNoopHarnessSummary: serializeSummary(reports.runtimeRunnerNoopHarnessSummary),
    runtimeRunnerNoopInvocationEnvelope: serializeEnvelope(reports.runtimeRunnerNoopInvocationEnvelope),
    runtimeRunnerNoopResultMetadata: serializeResult(reports.runtimeRunnerNoopResultMetadata),
    runtimeRunnerNoopHarnessSafetyGuard: serializeGuard(reports.runtimeRunnerNoopHarnessSafetyGuard),
    runtimeRunnerNoopHarnessContractVerificationReport: serializeContract(
      reports.runtimeRunnerNoopHarnessContractVerificationReport
    ),
    runtimeRunnerNoopHarnessBoundaryViolationReport: serializeBoundary(
      reports.runtimeRunnerNoopHarnessBoundaryViolationReport
    ),
    runtimeRunnerNoopHarnessPreflightSummary: serializePreflight(reports.runtimeRunnerNoopHarnessPreflightSummary),
    runtimeRunnerNoopHarnessReadinessVerificationReport: serializeReadinessVerification(
      reports.runtimeRunnerNoopHarnessReadinessVerificationReport
    ),
    runtimeRunnerNoopHarnessAlignmentReport: serializeAlignment(reports.runtimeRunnerNoopHarnessAlignmentReport),
    runtimeRunnerNoopHarnessFinalSafetyGate: serializeFinalGate(reports.runtimeRunnerNoopHarnessFinalSafetyGate),
  };
}
