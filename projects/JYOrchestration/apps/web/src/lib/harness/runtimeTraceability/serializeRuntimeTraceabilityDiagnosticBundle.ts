/**
 * H16 — 진단 API용 runtime traceability wire 묶음.
 */

import type { NormalizedRuntimePlanningContext } from "@/lib/harness/runtimeConsolidation/runtimePlanningConsolidationTypes";
import { buildRuntimeCriticalityPlanningReports } from "@/lib/harness/runtimeCriticality/buildRuntimeCriticalityPlanningReports";
import type { RuntimeCriticalityPlanningReports } from "@/lib/harness/runtimeCriticality/buildRuntimeCriticalityPlanningReports";
import { buildRuntimeDependencyPlanningReports } from "@/lib/harness/runtimeDependency/buildRuntimeDependencyPlanningReports";
import type { RuntimeDependencyPlanningReports } from "@/lib/harness/runtimeDependency/buildRuntimeDependencyPlanningReports";
import { buildRuntimeTraceabilityPlanningReports } from "./buildRuntimeTraceabilityPlanningReports";
import { serializeRuntimePlanningReasoningChainForDiagnostic } from "./buildPlanningReasoningChain";
import { serializeRuntimeDependencyReasoningTraceSummaryForDiagnostic } from "./evaluateDependencyReasoningTrace";
import { serializeRuntimePriorityReasoningTraceSummaryForDiagnostic } from "./evaluatePriorityReasoningTrace";

export function serializeRuntimeTraceabilityDiagnosticBundleFromPlanning(
  ctx: NormalizedRuntimePlanningContext,
  dependencyReports: RuntimeDependencyPlanningReports,
  criticalityReports: RuntimeCriticalityPlanningReports
): Readonly<{
  runtimePlanningReasoningChain: ReturnType<typeof serializeRuntimePlanningReasoningChainForDiagnostic>;
  runtimeDependencyReasoningTraceSummary: ReturnType<
    typeof serializeRuntimeDependencyReasoningTraceSummaryForDiagnostic
  >;
  runtimePriorityReasoningTraceSummary: ReturnType<
    typeof serializeRuntimePriorityReasoningTraceSummaryForDiagnostic
  >;
}> {
  const reports = buildRuntimeTraceabilityPlanningReports(ctx, dependencyReports, criticalityReports);

  return {
    runtimePlanningReasoningChain: serializeRuntimePlanningReasoningChainForDiagnostic(
      reports.reasoningChain
    ),
    runtimeDependencyReasoningTraceSummary: serializeRuntimeDependencyReasoningTraceSummaryForDiagnostic(
      reports.dependencyReasoningTraceSummary
    ),
    runtimePriorityReasoningTraceSummary: serializeRuntimePriorityReasoningTraceSummaryForDiagnostic(
      reports.priorityReasoningTraceSummary
    ),
  };
}

export function serializeRuntimeTraceabilityDiagnosticBundleFromContext(
  ctx: NormalizedRuntimePlanningContext
): ReturnType<typeof serializeRuntimeTraceabilityDiagnosticBundleFromPlanning> {
  const dependencyReports = buildRuntimeDependencyPlanningReports(ctx);
  const criticalityReports = buildRuntimeCriticalityPlanningReports(ctx, dependencyReports);
  return serializeRuntimeTraceabilityDiagnosticBundleFromPlanning(ctx, dependencyReports, criticalityReports);
}
