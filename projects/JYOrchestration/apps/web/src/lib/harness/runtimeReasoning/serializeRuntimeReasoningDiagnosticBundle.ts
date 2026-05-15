/**
 * H16.5 — 진단 API용 runtime reasoning consolidation wire 묶음.
 */

import type { NormalizedRuntimePlanningContext } from "@/lib/harness/runtimeConsolidation/runtimePlanningConsolidationTypes";
import { buildRuntimeCriticalityPlanningReports } from "@/lib/harness/runtimeCriticality/buildRuntimeCriticalityPlanningReports";
import { buildRuntimeDependencyPlanningReports } from "@/lib/harness/runtimeDependency/buildRuntimeDependencyPlanningReports";
import { buildRuntimeTraceabilityPlanningReports } from "@/lib/harness/runtimeTraceability/buildRuntimeTraceabilityPlanningReports";
import { buildRuntimeReasoningPlanningReports } from "./buildRuntimeReasoningPlanningReports";
import { serializeUnifiedRuntimeReasoningChainForDiagnostic } from "./buildUnifiedRuntimeReasoningChain";
import { serializeNormalizedRuntimeReasoningTraceForDiagnostic } from "./normalizeRuntimeReasoningTrace";
import { serializeRuntimeReasoningRedundancySummaryForDiagnostic } from "./evaluateRuntimeReasoningRedundancy";

export function serializeRuntimeReasoningDiagnosticBundleFromPlanning(
  dependencyReports: ReturnType<typeof buildRuntimeDependencyPlanningReports>,
  criticalityReports: ReturnType<typeof buildRuntimeCriticalityPlanningReports>,
  traceabilityReports: ReturnType<typeof buildRuntimeTraceabilityPlanningReports>
): Readonly<{
  unifiedRuntimeReasoningChain: ReturnType<typeof serializeUnifiedRuntimeReasoningChainForDiagnostic>;
  runtimeReasoningRedundancySummary: ReturnType<typeof serializeRuntimeReasoningRedundancySummaryForDiagnostic>;
  normalizedRuntimeReasoningTrace: ReturnType<typeof serializeNormalizedRuntimeReasoningTraceForDiagnostic>;
}> {
  const reports = buildRuntimeReasoningPlanningReports(
    dependencyReports,
    criticalityReports,
    traceabilityReports
  );

  return {
    unifiedRuntimeReasoningChain: serializeUnifiedRuntimeReasoningChainForDiagnostic(
      reports.unifiedReasoningChain
    ),
    runtimeReasoningRedundancySummary: serializeRuntimeReasoningRedundancySummaryForDiagnostic(
      reports.reasoningRedundancySummary
    ),
    normalizedRuntimeReasoningTrace: serializeNormalizedRuntimeReasoningTraceForDiagnostic(
      reports.normalizedReasoningTrace
    ),
  };
}

export function serializeRuntimeReasoningDiagnosticBundleFromContext(
  ctx: NormalizedRuntimePlanningContext
): ReturnType<typeof serializeRuntimeReasoningDiagnosticBundleFromPlanning> {
  const dependencyReports = buildRuntimeDependencyPlanningReports(ctx);
  const criticalityReports = buildRuntimeCriticalityPlanningReports(ctx, dependencyReports);
  const traceabilityReports = buildRuntimeTraceabilityPlanningReports(
    ctx,
    dependencyReports,
    criticalityReports
  );
  return serializeRuntimeReasoningDiagnosticBundleFromPlanning(
    dependencyReports,
    criticalityReports,
    traceabilityReports
  );
}
