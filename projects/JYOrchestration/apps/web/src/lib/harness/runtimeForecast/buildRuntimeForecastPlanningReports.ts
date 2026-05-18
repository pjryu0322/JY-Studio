/**
 * H20 — forecast trend·escalation·drift·stability **planning 보고서** 일괄 산출.
 */

import type { RuntimeSemanticPlanningReportsBeforeForecast } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import { analyzeRuntimeForecastTrends } from "./analyzeRuntimeForecastTrends";
import { buildRuntimeForecastSummary } from "./buildRuntimeForecastSummary";
import { evaluateRuntimeForecastStability } from "./evaluateRuntimeForecastStability";
import { predictRuntimeEscalationChains } from "./predictRuntimeEscalationChains";
import { predictRuntimeGovernanceDrift } from "./predictRuntimeGovernanceDrift";
import type { RuntimeForecastPlanningReports } from "./runtimeForecastTypes";

export type { RuntimeForecastPlanningReports } from "./runtimeForecastTypes";

export function buildRuntimeForecastPlanningReports(
  reports: RuntimeSemanticPlanningReportsBeforeForecast
): RuntimeForecastPlanningReports {
  const trends = analyzeRuntimeForecastTrends(reports);
  const runtimeForecastEscalation = predictRuntimeEscalationChains(reports);
  const runtimeForecastGovernanceDrift = predictRuntimeGovernanceDrift(reports);
  const runtimeForecastStability = evaluateRuntimeForecastStability(reports);
  const runtimeForecastSummary = buildRuntimeForecastSummary(
    trends,
    runtimeForecastEscalation,
    runtimeForecastGovernanceDrift,
    runtimeForecastStability
  );

  return {
    runtimeForecastSummary,
    runtimeForecastEscalation,
    runtimeForecastGovernanceDrift,
    runtimeForecastStability,
  };
}
