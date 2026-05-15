/**
 * H20.5 — resource pressure·workload·capacity·explainability **planning 보고서** 일괄 산출.
 */

import type { RuntimeSemanticPlanningReportsBeforeResource } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import { analyzeRuntimeResourcePressure } from "./analyzeRuntimeResourcePressure";
import { buildRuntimeResourceExplainability } from "./buildRuntimeResourceExplainability";
import { buildRuntimeResourceSummary } from "./buildRuntimeResourceSummary";
import {
  buildRuntimeResourceForecastFromCapacity,
  forecastRuntimeResourceCapacity,
} from "./forecastRuntimeResourceCapacity";
import { evaluateRuntimeMemberWorkload } from "./evaluateRuntimeMemberWorkload";
import type { RuntimeResourcePlanningReports } from "./runtimeResourceTypes";

export type { RuntimeResourcePlanningReports } from "./runtimeResourceTypes";

export function buildRuntimeResourcePlanningReports(
  reports: RuntimeSemanticPlanningReportsBeforeResource
): RuntimeResourcePlanningReports {
  const pressures = analyzeRuntimeResourcePressure(reports);
  const runtimeResourceSummary = buildRuntimeResourceSummary(pressures);
  const runtimeResourceCapacity = forecastRuntimeResourceCapacity(reports);
  const runtimeResourceForecast = buildRuntimeResourceForecastFromCapacity(runtimeResourceCapacity, reports);
  const runtimeMemberWorkload = evaluateRuntimeMemberWorkload(reports);
  const runtimeResourceExplainability = buildRuntimeResourceExplainability(pressures, runtimeMemberWorkload);

  return {
    runtimeResourceSummary,
    runtimeResourceForecast,
    runtimeResourceCapacity,
    runtimeMemberWorkload,
    runtimeResourceExplainability,
  };
}
