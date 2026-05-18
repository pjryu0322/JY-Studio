/**
 * H13.5 — 진단 API용 runtime lifecycle wire 묶음.
 */

import type { RuntimeGovernancePlanningContext } from "@/lib/harness/runtimeGovernance/buildRuntimeGovernancePlanningContext";
import type { RuntimePriorityPlanningReports } from "@/lib/harness/runtimePriority/buildRuntimePriorityPlanningReports";
import type { RuntimeStabilityPlanningReports } from "@/lib/harness/runtimeStability/buildRuntimeStabilityPlanningReports";
import { buildRuntimeLifecyclePlanningReports, type RuntimeLifecyclePlanningReports } from "./buildRuntimeLifecyclePlanningReports";
import { serializeRuntimePlanningFreshnessSummaryForDiagnostic } from "./evaluateRuntimePlanningFreshness";
import { serializeRuntimePlanningDriftReportForDiagnostic } from "./evaluateRuntimePlanningDrift";
import { serializeRuntimePlanningInvalidationSummaryForDiagnostic } from "./evaluateRuntimePlanningInvalidation";

export function serializeRuntimeLifecycleDiagnosticBundleFromPlanningReports(input: {
  readonly governanceCtx: RuntimeGovernancePlanningContext;
  readonly stabilityReports: RuntimeStabilityPlanningReports;
  readonly priorityReports: RuntimePriorityPlanningReports;
}): Readonly<{
  runtimePlanningFreshnessSummary: ReturnType<typeof serializeRuntimePlanningFreshnessSummaryForDiagnostic>;
  runtimePlanningDriftReport: ReturnType<typeof serializeRuntimePlanningDriftReportForDiagnostic>;
  runtimePlanningInvalidationSummary: ReturnType<typeof serializeRuntimePlanningInvalidationSummaryForDiagnostic>;
}> {
  return serializeRuntimeLifecycleDiagnosticBundleFromReports(buildRuntimeLifecyclePlanningReports(input));
}

export function serializeRuntimeLifecycleDiagnosticBundleFromReports(
  reports: RuntimeLifecyclePlanningReports
): Readonly<{
  runtimePlanningFreshnessSummary: ReturnType<typeof serializeRuntimePlanningFreshnessSummaryForDiagnostic>;
  runtimePlanningDriftReport: ReturnType<typeof serializeRuntimePlanningDriftReportForDiagnostic>;
  runtimePlanningInvalidationSummary: ReturnType<typeof serializeRuntimePlanningInvalidationSummaryForDiagnostic>;
}> {
  return {
    runtimePlanningFreshnessSummary: serializeRuntimePlanningFreshnessSummaryForDiagnostic(
      reports.freshnessSummary
    ),
    runtimePlanningDriftReport: serializeRuntimePlanningDriftReportForDiagnostic(reports.driftReport),
    runtimePlanningInvalidationSummary: serializeRuntimePlanningInvalidationSummaryForDiagnostic(
      reports.invalidationSummary
    ),
  };
}
