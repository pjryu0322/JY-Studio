/**
 * H24.5 — pilot contract 진단 **직렬화 전용**(report 재빌드 없음).
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type {
  RuntimeAdapterBoundarySummary,
  RuntimeAdapterForbiddenOperationReport,
  RuntimePilotContractInputSchema,
  RuntimePilotContractOutputSchema,
  RuntimePilotContractSummary,
  RuntimePilotHandoffReadiness,
} from "./runtimePilotContractTypes";

function sortKo(rows: readonly string[]): readonly string[] {
  return [...rows].sort((a, b) => a.localeCompare(b, "ko"));
}

function serializeContractSummary(s: RuntimePilotContractSummary): Readonly<Record<string, unknown>> {
  return {
    mode: s.mode,
    actualRuntimeOrchestrationEnabled: s.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: s.actualPilotExecutionEnabled,
    actualRuntimeAdapterInvocationEnabled: s.actualRuntimeAdapterInvocationEnabled,
    contractReadiness: s.contractReadiness,
    adapterBoundaryMode: s.adapterBoundaryMode,
    contractInputRequirements: sortKo(s.contractInputRequirements),
    contractOutputExpectations: sortKo(s.contractOutputExpectations),
    handoffBlockers: sortKo(s.handoffBlockers),
    recommendations: sortKo(s.recommendations),
  };
}

function serializeInputSchema(i: RuntimePilotContractInputSchema): Readonly<Record<string, unknown>> {
  return {
    mode: i.mode,
    actualRuntimeOrchestrationEnabled: i.actualRuntimeOrchestrationEnabled,
    actualRuntimeAdapterInvocationEnabled: i.actualRuntimeAdapterInvocationEnabled,
    requiredFields: sortKo(i.requiredFields),
    optionalReferences: sortKo(i.optionalReferences),
    notesKo: i.notesKo,
  };
}

function serializeOutputSchema(o: RuntimePilotContractOutputSchema): Readonly<Record<string, unknown>> {
  return {
    mode: o.mode,
    actualRuntimeOrchestrationEnabled: o.actualRuntimeOrchestrationEnabled,
    actualRuntimeAdapterInvocationEnabled: o.actualRuntimeAdapterInvocationEnabled,
    expectedFields: sortKo(o.expectedFields),
    noOpResultMetadata: sortKo(o.noOpResultMetadata),
    notesKo: o.notesKo,
  };
}

function serializeBoundary(b: RuntimeAdapterBoundarySummary): Readonly<Record<string, unknown>> {
  return {
    mode: b.mode,
    actualRuntimeOrchestrationEnabled: b.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: b.actualPilotExecutionEnabled,
    actualRuntimeAdapterInvocationEnabled: b.actualRuntimeAdapterInvocationEnabled,
    boundaryMode: b.boundaryMode,
    rationaleKo: b.rationaleKo,
    noOpGuarantees: sortKo(b.noOpGuarantees),
    recommendations: sortKo(b.recommendations),
  };
}

function serializeForbidden(f: RuntimeAdapterForbiddenOperationReport): Readonly<Record<string, unknown>> {
  return {
    mode: f.mode,
    actualRuntimeOrchestrationEnabled: f.actualRuntimeOrchestrationEnabled,
    actualRuntimeAdapterInvocationEnabled: f.actualRuntimeAdapterInvocationEnabled,
    forbiddenOperations: sortKo(f.forbiddenOperations),
    wordingRiskFindings: sortKo(f.wordingRiskFindings),
    recommendations: sortKo(f.recommendations),
  };
}

function serializeHandoff(h: RuntimePilotHandoffReadiness): Readonly<Record<string, unknown>> {
  return {
    mode: h.mode,
    actualRuntimeOrchestrationEnabled: h.actualRuntimeOrchestrationEnabled,
    actualPilotExecutionEnabled: h.actualPilotExecutionEnabled,
    actualRuntimeAdapterInvocationEnabled: h.actualRuntimeAdapterInvocationEnabled,
    handoffReadiness: h.handoffReadiness,
    contractReadiness: h.contractReadiness,
    adapterBoundaryMode: h.adapterBoundaryMode,
    controlledPilotReadiness: h.controlledPilotReadiness,
    operatorApprovalReadiness: h.operatorApprovalReadiness,
    rollbackReadiness: h.rollbackReadiness,
    auditReadiness: h.auditReadiness,
    handoffBlockers: sortKo(h.handoffBlockers),
    recommendations: sortKo(h.recommendations),
  };
}

export function serializeRuntimePilotContractDiagnosticBundleFromSemanticReports(
  reports: RuntimeSemanticPlanningReports
): Readonly<{
  runtimePilotContractSummary: ReturnType<typeof serializeContractSummary>;
  runtimePilotContractInputSchema: ReturnType<typeof serializeInputSchema>;
  runtimePilotContractOutputSchema: ReturnType<typeof serializeOutputSchema>;
  runtimeAdapterBoundarySummary: ReturnType<typeof serializeBoundary>;
  runtimeAdapterForbiddenOperationReport: ReturnType<typeof serializeForbidden>;
  runtimePilotHandoffReadiness: ReturnType<typeof serializeHandoff>;
}> {
  return {
    runtimePilotContractSummary: serializeContractSummary(reports.runtimePilotContractSummary),
    runtimePilotContractInputSchema: serializeInputSchema(reports.runtimePilotContractInputSchema),
    runtimePilotContractOutputSchema: serializeOutputSchema(reports.runtimePilotContractOutputSchema),
    runtimeAdapterBoundarySummary: serializeBoundary(reports.runtimeAdapterBoundarySummary),
    runtimeAdapterForbiddenOperationReport: serializeForbidden(reports.runtimeAdapterForbiddenOperationReport),
    runtimePilotHandoffReadiness: serializeHandoff(reports.runtimePilotHandoffReadiness),
  };
}
