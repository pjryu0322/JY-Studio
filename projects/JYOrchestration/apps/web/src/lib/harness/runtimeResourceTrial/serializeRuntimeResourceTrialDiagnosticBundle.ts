/**
 * H22 — resource trial 진단 **직렬화 전용**(report 재빌드 없음).
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type {
  RuntimeAllocationTrialDriftSummary,
  RuntimeResourceAllocationTrialReport,
  RuntimeResourceTrialForecastComparison,
  RuntimeResourceTrialGovernanceComparison,
} from "./runtimeResourceTrialTypes";

function serializeTrialReport(r: RuntimeResourceAllocationTrialReport): Readonly<Record<string, unknown>> {
  return {
    mode: r.mode,
    actualRuntimeOrchestrationEnabled: r.actualRuntimeOrchestrationEnabled,
    actualResourceAllocationEnabled: r.actualResourceAllocationEnabled,
    actualTrialExecutionEnabled: r.actualTrialExecutionEnabled,
    trialMode: r.trialMode,
    consistency: r.consistency,
    readinessKo: r.readinessKo,
    blockedReasons: [...r.blockedReasons].sort((a, b) => a.localeCompare(b, "ko")),
    satisfiedConditions: [...r.satisfiedConditions].sort((a, b) => a.localeCompare(b, "ko")),
    recommendations: [...r.recommendations].sort((a, b) => a.localeCompare(b, "ko")),
  };
}

function serializeForecast(c: RuntimeResourceTrialForecastComparison): Readonly<Record<string, unknown>> {
  return {
    mode: c.mode,
    actualRuntimeOrchestrationEnabled: c.actualRuntimeOrchestrationEnabled,
    actualResourceAllocationEnabled: c.actualResourceAllocationEnabled,
    actualTrialExecutionEnabled: c.actualTrialExecutionEnabled,
    stabilityOutlookKo: c.stabilityOutlookKo,
    escalationSummaryKo: c.escalationSummaryKo,
    governanceDriftSummaryKo: c.governanceDriftSummaryKo,
    allocationModeContextKo: c.allocationModeContextKo,
    aligned: c.aligned,
    observations: [...c.observations].sort((a, b) => a.localeCompare(b, "ko")),
  };
}

function serializeGovernance(c: RuntimeResourceTrialGovernanceComparison): Readonly<Record<string, unknown>> {
  return {
    mode: c.mode,
    actualRuntimeOrchestrationEnabled: c.actualRuntimeOrchestrationEnabled,
    actualResourceAllocationEnabled: c.actualResourceAllocationEnabled,
    actualTrialExecutionEnabled: c.actualTrialExecutionEnabled,
    governanceModeKo: c.governanceModeKo,
    boundaryKo: c.boundaryKo,
    operatorReviewKo: c.operatorReviewKo,
    allocationReadinessKo: c.allocationReadinessKo,
    aligned: c.aligned,
    observations: [...c.observations].sort((a, b) => a.localeCompare(b, "ko")),
  };
}

function serializeDrift(d: RuntimeAllocationTrialDriftSummary): Readonly<Record<string, unknown>> {
  return {
    mode: d.mode,
    actualRuntimeOrchestrationEnabled: d.actualRuntimeOrchestrationEnabled,
    actualResourceAllocationEnabled: d.actualResourceAllocationEnabled,
    actualTrialExecutionEnabled: d.actualTrialExecutionEnabled,
    driftLevel: d.driftLevel,
    driftFindings: [...d.driftFindings].sort((a, b) => a.localeCompare(b, "ko")),
  };
}

export function serializeRuntimeResourceTrialDiagnosticBundleFromSemanticReports(
  reports: RuntimeSemanticPlanningReports
): Readonly<{
  runtimeResourceAllocationTrialReport: ReturnType<typeof serializeTrialReport>;
  runtimeAllocationForecastComparison: ReturnType<typeof serializeForecast>;
  runtimeAllocationGovernanceComparison: ReturnType<typeof serializeGovernance>;
  runtimeAllocationTrialDriftSummary: ReturnType<typeof serializeDrift>;
}> {
  return {
    runtimeResourceAllocationTrialReport: serializeTrialReport(reports.runtimeResourceAllocationTrialReport),
    runtimeAllocationForecastComparison: serializeForecast(reports.runtimeAllocationForecastComparison),
    runtimeAllocationGovernanceComparison: serializeGovernance(reports.runtimeAllocationGovernanceComparison),
    runtimeAllocationTrialDriftSummary: serializeDrift(reports.runtimeAllocationTrialDriftSummary),
  };
}
