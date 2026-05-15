/**
 * H12.5 — 진단 API용 runtime priority wire 묶음(H12 stability reports 재사용).
 */

import type { HarnessMaturityBaselineReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import type { RuntimeGovernancePlanningContext } from "@/lib/harness/runtimeGovernance/buildRuntimeGovernancePlanningContext";
import type { RuntimeStabilityPlanningReports } from "@/lib/harness/runtimeStability/buildRuntimeStabilityPlanningReports";
import { buildRuntimePriorityPlanningReports } from "./buildRuntimePriorityPlanningReports";
import { serializeRuntimePlanningDependencyReportForDiagnostic } from "./evaluateRuntimePlanningDependencies";
import { serializeRuntimeEscalationSummaryForDiagnostic } from "./evaluateRuntimeEscalation";
import { serializeRuntimePlanningBottleneckSummaryForDiagnostic } from "./evaluateRuntimePlanningBottlenecks";

export function serializeRuntimePriorityDiagnosticBundleFromStabilityReports(input: {
  readonly baseline: HarnessMaturityBaselineReport;
  readonly governanceCtx: RuntimeGovernancePlanningContext;
  readonly stabilityReports: RuntimeStabilityPlanningReports;
  readonly extract: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly messageExplainabilityAvailable: boolean;
}): Readonly<{
  runtimePlanningDependencyReport: ReturnType<typeof serializeRuntimePlanningDependencyReportForDiagnostic>;
  runtimeEscalationSummary: ReturnType<typeof serializeRuntimeEscalationSummaryForDiagnostic>;
  runtimePlanningBottleneckSummary: ReturnType<typeof serializeRuntimePlanningBottleneckSummaryForDiagnostic>;
}> {
  const reports = buildRuntimePriorityPlanningReports(input);

  return {
    runtimePlanningDependencyReport: serializeRuntimePlanningDependencyReportForDiagnostic(reports.dependencyReport),
    runtimeEscalationSummary: serializeRuntimeEscalationSummaryForDiagnostic(reports.escalationSummary),
    runtimePlanningBottleneckSummary: serializeRuntimePlanningBottleneckSummaryForDiagnostic(reports.bottleneckSummary),
  };
}
