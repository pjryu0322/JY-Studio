/**
 * H22.5 — control boundary 진단 **직렬화 전용**(report 재빌드 없음).
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type {
  RuntimeControlBoundarySummary,
  RuntimeControlBoundaryViolationReport,
  RuntimeControlScopeMatrix,
} from "./runtimeControlBoundaryTypes";

function serializeSummary(s: RuntimeControlBoundarySummary): Readonly<Record<string, unknown>> {
  return {
    mode: s.mode,
    actualRuntimeOrchestrationEnabled: s.actualRuntimeOrchestrationEnabled,
    actualControlEnabled: s.actualControlEnabled,
    boundaryLevel: s.boundaryLevel,
    boundaryRisk: s.boundaryRisk,
    rationaleKo: s.rationaleKo,
    blockedReasons: [...s.blockedReasons].sort((a, b) => a.localeCompare(b, "ko")),
    allowedMetadataScopes: [...s.allowedMetadataScopes].sort((a, b) => a.localeCompare(b, "ko")),
    forbiddenControlScopes: [...s.forbiddenControlScopes].sort((a, b) => a.localeCompare(b, "ko")),
    recommendations: [...s.recommendations].sort((a, b) => a.localeCompare(b, "ko")),
  };
}

function serializeViolations(v: RuntimeControlBoundaryViolationReport): Readonly<Record<string, unknown>> {
  return {
    mode: v.mode,
    actualRuntimeOrchestrationEnabled: v.actualRuntimeOrchestrationEnabled,
    actualControlEnabled: v.actualControlEnabled,
    actualFlagViolations: [...v.actualFlagViolations].sort((a, b) => a.localeCompare(b, "ko")),
    wordingRiskFindings: [...v.wordingRiskFindings].sort((a, b) => a.localeCompare(b, "ko")),
  };
}

function serializeMatrix(m: RuntimeControlScopeMatrix): Readonly<Record<string, unknown>> {
  return {
    mode: m.mode,
    actualRuntimeOrchestrationEnabled: m.actualRuntimeOrchestrationEnabled,
    actualControlEnabled: m.actualControlEnabled,
    boundaryLevel: m.boundaryLevel,
    allowedMetadataScopes: [...m.allowedMetadataScopes].sort((a, b) => a.localeCompare(b, "ko")),
    forbiddenControlScopes: [...m.forbiddenControlScopes].sort((a, b) => a.localeCompare(b, "ko")),
    notesKo: [...m.notesKo].sort((a, b) => a.localeCompare(b, "ko")),
  };
}

export function serializeRuntimeControlBoundaryDiagnosticBundleFromSemanticReports(
  reports: RuntimeSemanticPlanningReports
): Readonly<{
  runtimeControlBoundarySummary: ReturnType<typeof serializeSummary>;
  runtimeControlBoundaryViolationReport: ReturnType<typeof serializeViolations>;
  runtimeControlScopeMatrix: ReturnType<typeof serializeMatrix>;
}> {
  return {
    runtimeControlBoundarySummary: serializeSummary(reports.runtimeControlBoundarySummary),
    runtimeControlBoundaryViolationReport: serializeViolations(reports.runtimeControlBoundaryViolationReport),
    runtimeControlScopeMatrix: serializeMatrix(reports.runtimeControlScopeMatrix),
  };
}
