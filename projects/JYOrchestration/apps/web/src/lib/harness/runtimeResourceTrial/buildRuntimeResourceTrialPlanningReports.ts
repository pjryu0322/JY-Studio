/**
 * H22 — resource allocation **trial planning** reports 일괄 산출(read-only; report 재빌드 없음).
 */

import type { RuntimeSemanticPlanningReportsBeforeTrial } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { compareRuntimeAllocationPlanWithForecast } from "./compareRuntimeAllocationPlanWithForecast";
import { compareRuntimeAllocationPlanWithGovernance } from "./compareRuntimeAllocationPlanWithGovernance";
import { evaluateRuntimeAllocationTrialDrift } from "./evaluateRuntimeAllocationTrialDrift";
import { evaluateRuntimeResourceAllocationTrial } from "./evaluateRuntimeResourceAllocationTrial";
import type { RuntimeResourceTrialPlanningReports } from "./runtimeResourceTrialTypes";

export type { RuntimeResourceTrialPlanningReports } from "./runtimeResourceTrialTypes";

export function buildRuntimeResourceTrialPlanningReports(
  reports: RuntimeSemanticPlanningReportsBeforeTrial
): RuntimeResourceTrialPlanningReports {
  const runtimeAllocationForecastComparison = compareRuntimeAllocationPlanWithForecast(reports);
  const runtimeAllocationGovernanceComparison = compareRuntimeAllocationPlanWithGovernance(reports);
  const runtimeAllocationTrialDriftSummary = evaluateRuntimeAllocationTrialDrift(reports);
  const runtimeResourceAllocationTrialReport = evaluateRuntimeResourceAllocationTrial(reports, {
    forecastComparison: runtimeAllocationForecastComparison,
    governanceComparison: runtimeAllocationGovernanceComparison,
    driftSummary: runtimeAllocationTrialDriftSummary,
  });

  return {
    runtimeResourceAllocationTrialReport,
    runtimeAllocationForecastComparison,
    runtimeAllocationGovernanceComparison,
    runtimeAllocationTrialDriftSummary,
  };
}
