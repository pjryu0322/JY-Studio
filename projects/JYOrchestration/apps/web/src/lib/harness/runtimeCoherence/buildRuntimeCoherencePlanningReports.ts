/**
 * H14 — coherence·synchronization·divergence **planning 보고서** 일괄 산출(H13.5 lifecycle 재사용).
 */

import type { RuntimeLifecyclePlanningReports } from "@/lib/harness/runtimeLifecycle/buildRuntimeLifecyclePlanningReports";
import type { RuntimePriorityPlanningReports } from "@/lib/harness/runtimePriority/buildRuntimePriorityPlanningReports";
import type { RuntimeStabilityPlanningReports } from "@/lib/harness/runtimeStability/buildRuntimeStabilityPlanningReports";
import { evaluateRuntimePlanningCoherence } from "./evaluateRuntimePlanningCoherence";
import { evaluateRuntimePlanningSynchronization } from "./evaluateRuntimePlanningSynchronization";
import { evaluateRuntimePlanningDivergence } from "./evaluateRuntimePlanningDivergence";
import type {
  RuntimePlanningCoherenceSummary,
  RuntimePlanningDivergenceReport,
  RuntimePlanningSynchronizationSummary,
} from "./runtimeCoherenceTypes";

export type RuntimeCoherencePlanningReports = Readonly<{
  coherenceSummary: RuntimePlanningCoherenceSummary;
  synchronizationSummary: RuntimePlanningSynchronizationSummary;
  divergenceReport: RuntimePlanningDivergenceReport;
}>;

export function buildRuntimeCoherencePlanningReports(input: {
  readonly stabilityReports: RuntimeStabilityPlanningReports;
  readonly priorityReports: RuntimePriorityPlanningReports;
  readonly lifecycleReports: RuntimeLifecyclePlanningReports;
}): RuntimeCoherencePlanningReports {
  const coherenceSummary = evaluateRuntimePlanningCoherence(input);
  const synchronizationSummary = evaluateRuntimePlanningSynchronization(input);
  const divergenceReport = evaluateRuntimePlanningDivergence({
    lifecycleReports: input.lifecycleReports,
    coherenceSummary,
    synchronizationSummary,
  });

  return { coherenceSummary, synchronizationSummary, divergenceReport };
}
