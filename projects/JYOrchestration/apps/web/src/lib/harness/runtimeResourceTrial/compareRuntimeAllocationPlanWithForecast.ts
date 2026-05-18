/**
 * H22 — allocation plan ↔ **forecast** 신호 비교(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeTrial } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import type { RuntimeResourceTrialForecastComparison } from "./runtimeResourceTrialTypes";

export function compareRuntimeAllocationPlanWithForecast(
  reports: RuntimeSemanticPlanningReportsBeforeTrial
): RuntimeResourceTrialForecastComparison {
  const plan = reports.runtimeResourceAllocationPlan;
  const stab = reports.runtimeForecastStability;
  const esc = reports.runtimeForecastEscalation;
  const drift = reports.runtimeForecastGovernanceDrift;

  const observations: string[] = [];
  let aligned = true;

  if (stab.outlook === "critical_candidate" && plan.globalAllocationMode === "dry_run_candidate") {
    observations.push("forecast stability critical_candidate인데 allocation은 dry_run_candidate — trial watch 권고");
    aligned = false;
  }
  if (esc.highRiskFirst.length >= 2 && plan.globalAllocationMode === "dry_run_candidate") {
    observations.push("forecast escalation 고위험 다건과 allocation dry_run 후보가 동시에 존재");
    aligned = false;
  }
  const highDrift = drift.drifts.some((d) => d.severity === "high" || d.severity === "critical_candidate");
  if (highDrift && plan.globalAllocationMode !== "not_needed") {
    observations.push("forecast governance drift 고심각도 — allocation trial 정합성 재검토");
    aligned = false;
  }
  if (observations.length === 0) {
    observations.push("forecast stability·escalation·drift와 allocation 모드 간 명백한 충돌 없음(메타)");
  }
  observations.sort((a, b) => a.localeCompare(b, "ko"));

  return {
    mode: "runtime_allocation_forecast_comparison",
    actualRuntimeOrchestrationEnabled: false,
    actualResourceAllocationEnabled: false,
    actualTrialExecutionEnabled: false,
    stabilityOutlookKo: `outlook=${stab.outlook}`,
    escalationSummaryKo: esc.primaryChainKo,
    governanceDriftSummaryKo: drift.primaryDriftKo,
    allocationModeContextKo: `globalAllocationMode=${plan.globalAllocationMode}`,
    aligned,
    observations,
  };
}
