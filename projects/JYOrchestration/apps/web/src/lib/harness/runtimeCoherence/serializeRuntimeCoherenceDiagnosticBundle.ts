/**
 * H14 — 진단 API용 runtime coherence wire 묶음.
 */

import type { RuntimeLifecyclePlanningReports } from "@/lib/harness/runtimeLifecycle/buildRuntimeLifecyclePlanningReports";
import type { RuntimePriorityPlanningReports } from "@/lib/harness/runtimePriority/buildRuntimePriorityPlanningReports";
import type { RuntimeStabilityPlanningReports } from "@/lib/harness/runtimeStability/buildRuntimeStabilityPlanningReports";
import { buildRuntimeCoherencePlanningReports, type RuntimeCoherencePlanningReports } from "./buildRuntimeCoherencePlanningReports";
import { serializeRuntimePlanningCoherenceSummaryForDiagnostic } from "./evaluateRuntimePlanningCoherence";
import { serializeRuntimePlanningSynchronizationSummaryForDiagnostic } from "./evaluateRuntimePlanningSynchronization";
import { serializeRuntimePlanningDivergenceReportForDiagnostic } from "./evaluateRuntimePlanningDivergence";

export function serializeRuntimeCoherenceDiagnosticBundleFromPlanningReports(input: {
  readonly stabilityReports: RuntimeStabilityPlanningReports;
  readonly priorityReports: RuntimePriorityPlanningReports;
  readonly lifecycleReports: RuntimeLifecyclePlanningReports;
}): Readonly<{
  runtimePlanningCoherenceSummary: ReturnType<typeof serializeRuntimePlanningCoherenceSummaryForDiagnostic>;
  runtimePlanningSynchronizationSummary: ReturnType<typeof serializeRuntimePlanningSynchronizationSummaryForDiagnostic>;
  runtimePlanningDivergenceReport: ReturnType<typeof serializeRuntimePlanningDivergenceReportForDiagnostic>;
}> {
  return serializeRuntimeCoherenceDiagnosticBundleFromReports(buildRuntimeCoherencePlanningReports(input));
}

export function serializeRuntimeCoherenceDiagnosticBundleFromReports(
  reports: RuntimeCoherencePlanningReports
): Readonly<{
  runtimePlanningCoherenceSummary: ReturnType<typeof serializeRuntimePlanningCoherenceSummaryForDiagnostic>;
  runtimePlanningSynchronizationSummary: ReturnType<typeof serializeRuntimePlanningSynchronizationSummaryForDiagnostic>;
  runtimePlanningDivergenceReport: ReturnType<typeof serializeRuntimePlanningDivergenceReportForDiagnostic>;
}> {
  return {
    runtimePlanningCoherenceSummary: serializeRuntimePlanningCoherenceSummaryForDiagnostic(
      reports.coherenceSummary
    ),
    runtimePlanningSynchronizationSummary: serializeRuntimePlanningSynchronizationSummaryForDiagnostic(
      reports.synchronizationSummary
    ),
    runtimePlanningDivergenceReport: serializeRuntimePlanningDivergenceReportForDiagnostic(
      reports.divergenceReport
    ),
  };
}
