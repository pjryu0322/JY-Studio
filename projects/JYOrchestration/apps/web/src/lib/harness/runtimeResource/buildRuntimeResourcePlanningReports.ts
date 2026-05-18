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
import { evaluateRuntimeBottleneckPropagation } from "./evaluateRuntimeBottleneckPropagation";
import { evaluateRuntimeMemberWorkload } from "./evaluateRuntimeMemberWorkload";
import { evaluateRuntimeProviderPressure } from "./evaluateRuntimeProviderPressure";
import { evaluateRuntimeQueuePressure } from "./evaluateRuntimeQueuePressure";
import type { RuntimeResourcePlanningReports } from "./runtimeResourceTypes";

export type { RuntimeResourcePlanningReports } from "./runtimeResourceTypes";

export function buildRuntimeResourcePlanningReports(
  reports: RuntimeSemanticPlanningReportsBeforeResource
): RuntimeResourcePlanningReports {
  const pressures = analyzeRuntimeResourcePressure(reports);
  const providerPressure = evaluateRuntimeProviderPressure(pressures);
  const queuePressureInsight = evaluateRuntimeQueuePressure(reports, pressures);
  const bottleneckPropagation = evaluateRuntimeBottleneckPropagation(reports);
  const runtimeResourceSummary = buildRuntimeResourceSummary(pressures, {
    providerPressure,
    queuePressureInsight,
    bottleneckPropagation,
  });
  const runtimeResourceCapacity = forecastRuntimeResourceCapacity(reports);
  const runtimeResourceForecast = buildRuntimeResourceForecastFromCapacity(runtimeResourceCapacity, reports);
  const runtimeMemberWorkload = evaluateRuntimeMemberWorkload(reports);
  const runtimeResourceExplainability = buildRuntimeResourceExplainability(
    pressures,
    runtimeMemberWorkload,
    bottleneckPropagation
  );

  return {
    runtimeResourceSummary,
    runtimeResourceForecast,
    runtimeResourceCapacity,
    runtimeMemberWorkload,
    runtimeResourceExplainability,
  };
}
