/**
 * H33 — no-op shell hardening 진단 **직렬화 전용**(report 재빌드 없음).
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type {
  RuntimeNoopShellHardeningAlignmentReport,
  RuntimeNoopShellHardeningBoundaryViolationReport,
  RuntimeNoopShellHardeningContract,
  RuntimeNoopShellHardeningContractVerificationReport,
  RuntimeNoopShellHardeningFinalSafetyGate,
  RuntimeNoopShellHardeningInputEnvelope,
  RuntimeNoopShellHardeningOutputEnvelope,
  RuntimeNoopShellHardeningPreflightSummary,
  RuntimeNoopShellHardeningReadinessVerificationReport,
  RuntimeNoopShellHardeningSafetyGuard,
  RuntimeNoopShellHardeningSummary,
  RuntimeNoopShellNoExecutionResultMetadata,
} from "./runtimeNoopShellHardeningTypes";

function sortKo(rows: readonly string[]): readonly string[] {
  return [...rows].sort((a, b) => a.localeCompare(b, "ko"));
}

function shellActualFlags(s: {
  actualRuntimeOrchestrationEnabled: false;
  actualPilotExecutionEnabled: false;
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
    actualNoopShellExecutionEnabled: s.actualNoopShellExecutionEnabled,
    actualExecutionShellExecutionEnabled: s.actualExecutionShellExecutionEnabled,
    actualRuntimeAdapterInvocationEnabled: s.actualRuntimeAdapterInvocationEnabled,
    actualExecutionEnabled: s.actualExecutionEnabled,
    actualProviderRoutingEnabled: s.actualProviderRoutingEnabled,
    actualQueueControlEnabled: s.actualQueueControlEnabled,
    actualRollbackExecutionEnabled: s.actualRollbackExecutionEnabled,
  };
}

function serializeSummary(s: RuntimeNoopShellHardeningSummary): Readonly<Record<string, unknown>> {
  return {
    mode: s.mode,
    ...shellActualFlags(s),
    hardeningReadiness: s.hardeningReadiness,
    hardeningMode: s.hardeningMode,
    rationaleKo: s.rationaleKo,
    hardeningBlockers: sortKo(s.hardeningBlockers),
    recommendations: sortKo(s.recommendations),
  };
}

function serializeContract(c: RuntimeNoopShellHardeningContract): Readonly<Record<string, unknown>> {
  return {
    mode: c.mode,
    ...shellActualFlags(c),
    contractName: c.contractName,
    contractMode: c.contractMode,
    requiredInputMetadata: sortKo(c.requiredInputMetadata),
    expectedOutputMetadata: sortKo(c.expectedOutputMetadata),
    forbiddenHardeningOperations: sortKo(c.forbiddenHardeningOperations),
    noExecutionGuarantees: sortKo(c.noExecutionGuarantees),
    recommendations: sortKo(c.recommendations),
  };
}

function serializeInputEnvelope(e: RuntimeNoopShellHardeningInputEnvelope): Readonly<Record<string, unknown>> {
  return {
    mode: e.mode,
    ...shellActualFlags(e),
    envelopeRows: sortKo(e.envelopeRows),
    recommendations: sortKo(e.recommendations),
  };
}

function serializeOutputEnvelope(e: RuntimeNoopShellHardeningOutputEnvelope): Readonly<Record<string, unknown>> {
  return {
    mode: e.mode,
    ...shellActualFlags(e),
    envelopeRows: sortKo(e.envelopeRows),
    recommendations: sortKo(e.recommendations),
  };
}

function serializeResult(r: RuntimeNoopShellNoExecutionResultMetadata): Readonly<Record<string, unknown>> {
  return {
    mode: r.mode,
    ...shellActualFlags(r),
    noopShellExecuted: r.noopShellExecuted,
    executionShellExecuted: r.executionShellExecuted,
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

function serializeGuard(g: RuntimeNoopShellHardeningSafetyGuard): Readonly<Record<string, unknown>> {
  return {
    mode: g.mode,
    ...shellActualFlags(g),
    actualShellExecutionForbidden: g.actualShellExecutionForbidden,
    actualAdapterInvocationForbidden: g.actualAdapterInvocationForbidden,
    actualExecutionForbidden: g.actualExecutionForbidden,
    actualProviderRoutingForbidden: g.actualProviderRoutingForbidden,
    actualQueueControlForbidden: g.actualQueueControlForbidden,
    actualRollbackForbidden: g.actualRollbackForbidden,
    actualPromptMutationForbidden: g.actualPromptMutationForbidden,
    guardRows: sortKo(g.guardRows),
    recommendations: sortKo(g.recommendations),
  };
}

function serializeContractVerification(
  r: RuntimeNoopShellHardeningContractVerificationReport
): Readonly<Record<string, unknown>> {
  return {
    mode: r.mode,
    actualRuntimeOrchestrationEnabled: r.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: r.actualPilotExecutionEnabled,
    actualNoopShellExecutionEnabled: r.actualNoopShellExecutionEnabled,
    actualExecutionShellExecutionEnabled: r.actualExecutionShellExecutionEnabled,
    verificationStatus: r.verificationStatus,
    findings: sortKo(r.findings),
    recommendations: sortKo(r.recommendations),
  };
}

function serializeBoundary(b: RuntimeNoopShellHardeningBoundaryViolationReport): Readonly<Record<string, unknown>> {
  return {
    mode: b.mode,
    actualRuntimeOrchestrationEnabled: b.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: b.actualPilotExecutionEnabled,
    actualNoopShellExecutionEnabled: b.actualNoopShellExecutionEnabled,
    actualExecutionShellExecutionEnabled: b.actualExecutionShellExecutionEnabled,
    actualFlagViolations: sortKo(b.actualFlagViolations),
    wordingRiskFindings: sortKo(b.wordingRiskFindings),
    recommendations: sortKo(b.recommendations),
  };
}

function serializePreflight(p: RuntimeNoopShellHardeningPreflightSummary): Readonly<Record<string, unknown>> {
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

function serializeReadinessVerification(
  r: RuntimeNoopShellHardeningReadinessVerificationReport
): Readonly<Record<string, unknown>> {
  return {
    mode: r.mode,
    actualRuntimeOrchestrationEnabled: r.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: r.actualPilotExecutionEnabled,
    actualNoopShellExecutionEnabled: r.actualNoopShellExecutionEnabled,
    actualExecutionShellExecutionEnabled: r.actualExecutionShellExecutionEnabled,
    verificationStatus: r.verificationStatus,
    findings: sortKo(r.findings),
    recommendations: sortKo(r.recommendations),
  };
}

function serializeAlignment(a: RuntimeNoopShellHardeningAlignmentReport): Readonly<Record<string, unknown>> {
  return {
    mode: a.mode,
    actualRuntimeOrchestrationEnabled: a.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: a.actualPilotExecutionEnabled,
    actualNoopShellExecutionEnabled: a.actualNoopShellExecutionEnabled,
    actualExecutionShellExecutionEnabled: a.actualExecutionShellExecutionEnabled,
    alignmentStatus: a.alignmentStatus,
    findings: sortKo(a.findings),
    recommendations: sortKo(a.recommendations),
  };
}

function serializeFinalGate(g: RuntimeNoopShellHardeningFinalSafetyGate): Readonly<Record<string, unknown>> {
  return {
    mode: g.mode,
    actualRuntimeOrchestrationEnabled: g.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: g.actualPilotExecutionEnabled,
    actualNoopShellExecutionEnabled: g.actualNoopShellExecutionEnabled,
    actualExecutionShellExecutionEnabled: g.actualExecutionShellExecutionEnabled,
    actualRuntimeAdapterInvocationEnabled: g.actualRuntimeAdapterInvocationEnabled,
    actualExecutionEnabled: g.actualExecutionEnabled,
    actualProviderRoutingEnabled: g.actualProviderRoutingEnabled,
    actualQueueControlEnabled: g.actualQueueControlEnabled,
    actualRollbackExecutionEnabled: g.actualRollbackExecutionEnabled,
    finalGateStatus: g.finalGateStatus,
    h34EntryReadiness: g.h34EntryReadiness,
    checklist: sortKo(g.checklist),
    blockers: sortKo(g.blockers),
    recommendations: sortKo(g.recommendations),
  };
}

export function serializeRuntimeNoopShellHardeningDiagnosticBundleFromSemanticReports(
  reports: RuntimeSemanticPlanningReports
): Readonly<{
  runtimeNoopShellHardeningSummary: ReturnType<typeof serializeSummary>;
  runtimeNoopShellHardeningContract: ReturnType<typeof serializeContract>;
  runtimeNoopShellHardeningInputEnvelope: ReturnType<typeof serializeInputEnvelope>;
  runtimeNoopShellHardeningOutputEnvelope: ReturnType<typeof serializeOutputEnvelope>;
  runtimeNoopShellNoExecutionResultMetadata: ReturnType<typeof serializeResult>;
  runtimeNoopShellHardeningSafetyGuard: ReturnType<typeof serializeGuard>;
  runtimeNoopShellHardeningContractVerificationReport: ReturnType<typeof serializeContractVerification>;
  runtimeNoopShellHardeningBoundaryViolationReport: ReturnType<typeof serializeBoundary>;
  runtimeNoopShellHardeningPreflightSummary: ReturnType<typeof serializePreflight>;
  runtimeNoopShellHardeningReadinessVerificationReport: ReturnType<typeof serializeReadinessVerification>;
  runtimeNoopShellHardeningAlignmentReport: ReturnType<typeof serializeAlignment>;
  runtimeNoopShellHardeningFinalSafetyGate: ReturnType<typeof serializeFinalGate>;
}> {
  return {
    runtimeNoopShellHardeningSummary: serializeSummary(reports.runtimeNoopShellHardeningSummary),
    runtimeNoopShellHardeningContract: serializeContract(reports.runtimeNoopShellHardeningContract),
    runtimeNoopShellHardeningInputEnvelope: serializeInputEnvelope(reports.runtimeNoopShellHardeningInputEnvelope),
    runtimeNoopShellHardeningOutputEnvelope: serializeOutputEnvelope(reports.runtimeNoopShellHardeningOutputEnvelope),
    runtimeNoopShellNoExecutionResultMetadata: serializeResult(reports.runtimeNoopShellNoExecutionResultMetadata),
    runtimeNoopShellHardeningSafetyGuard: serializeGuard(reports.runtimeNoopShellHardeningSafetyGuard),
    runtimeNoopShellHardeningContractVerificationReport: serializeContractVerification(
      reports.runtimeNoopShellHardeningContractVerificationReport
    ),
    runtimeNoopShellHardeningBoundaryViolationReport: serializeBoundary(
      reports.runtimeNoopShellHardeningBoundaryViolationReport
    ),
    runtimeNoopShellHardeningPreflightSummary: serializePreflight(reports.runtimeNoopShellHardeningPreflightSummary),
    runtimeNoopShellHardeningReadinessVerificationReport: serializeReadinessVerification(
      reports.runtimeNoopShellHardeningReadinessVerificationReport
    ),
    runtimeNoopShellHardeningAlignmentReport: serializeAlignment(reports.runtimeNoopShellHardeningAlignmentReport),
    runtimeNoopShellHardeningFinalSafetyGate: serializeFinalGate(reports.runtimeNoopShellHardeningFinalSafetyGate),
  };
}
