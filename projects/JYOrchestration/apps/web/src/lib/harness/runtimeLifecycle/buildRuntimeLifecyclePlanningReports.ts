/**
 * H13.5 — lifecycle·freshness·drift·invalidation **planning 보고서** 일괄 산출(H12/H12.5 재사용).
 */

import type { RuntimeGovernancePlanningContext } from "@/lib/harness/runtimeGovernance/buildRuntimeGovernancePlanningContext";
import type { RuntimePriorityPlanningReports } from "@/lib/harness/runtimePriority/buildRuntimePriorityPlanningReports";
import type { RuntimeStabilityPlanningReports } from "@/lib/harness/runtimeStability/buildRuntimeStabilityPlanningReports";
import { evaluateRuntimePlanningFreshness } from "./evaluateRuntimePlanningFreshness";
import { evaluateRuntimePlanningDrift } from "./evaluateRuntimePlanningDrift";
import { evaluateRuntimePlanningInvalidation } from "./evaluateRuntimePlanningInvalidation";
import type {
  RuntimePlanningDriftReport,
  RuntimePlanningFreshnessSummary,
  RuntimePlanningInvalidationSummary,
} from "./runtimeLifecycleTypes";

export type RuntimeLifecyclePlanningReports = Readonly<{
  freshnessSummary: RuntimePlanningFreshnessSummary;
  driftReport: RuntimePlanningDriftReport;
  invalidationSummary: RuntimePlanningInvalidationSummary;
}>;

export function buildRuntimeLifecyclePlanningReports(input: {
  readonly governanceCtx: RuntimeGovernancePlanningContext;
  readonly stabilityReports: RuntimeStabilityPlanningReports;
  readonly priorityReports: RuntimePriorityPlanningReports;
}): RuntimeLifecyclePlanningReports {
  const freshnessSummary = evaluateRuntimePlanningFreshness({
    stabilityReports: input.stabilityReports,
    priorityReports: input.priorityReports,
  });
  const driftReport = evaluateRuntimePlanningDrift({
    governanceCtx: input.governanceCtx,
    stabilityReports: input.stabilityReports,
    priorityReports: input.priorityReports,
  });
  const invalidationSummary = evaluateRuntimePlanningInvalidation({
    stabilityReports: input.stabilityReports,
    priorityReports: input.priorityReports,
    freshnessSummary,
    driftReport,
  });

  return { freshnessSummary, driftReport, invalidationSummary };
}
