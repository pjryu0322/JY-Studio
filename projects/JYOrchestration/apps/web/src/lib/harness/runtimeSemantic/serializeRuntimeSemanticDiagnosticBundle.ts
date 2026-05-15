/**
 * H17 — 진단 API용 runtime semantic compression wire 묶음.
 */

import type { NormalizedRuntimePlanningContext } from "@/lib/harness/runtimeConsolidation/runtimePlanningConsolidationTypes";
import { buildRuntimeCriticalityPlanningReports } from "@/lib/harness/runtimeCriticality/buildRuntimeCriticalityPlanningReports";
import { buildRuntimeDependencyPlanningReports } from "@/lib/harness/runtimeDependency/buildRuntimeDependencyPlanningReports";
import { buildRuntimeReasoningPlanningReports } from "@/lib/harness/runtimeReasoning/buildRuntimeReasoningPlanningReports";
import type { RuntimeReasoningPlanningReports } from "@/lib/harness/runtimeReasoning/buildRuntimeReasoningPlanningReports";
import { buildRuntimeTraceabilityPlanningReports } from "@/lib/harness/runtimeTraceability/buildRuntimeTraceabilityPlanningReports";
import { buildRuntimeSemanticPlanningReports } from "./buildRuntimeSemanticPlanningReports";
import { serializeRuntimeSemanticGroupsSummaryForDiagnostic } from "./buildRuntimeSemanticGroups";
import { serializeCompressedRuntimeReasoningTraceForDiagnostic } from "./compressRuntimeReasoningTrace";
import { serializeRuntimeSemanticRedundancySummaryForDiagnostic } from "./evaluateRuntimeSemanticRedundancy";
import { serializeStabilizedRuntimeSemanticOrderingForDiagnostic } from "./stabilizeRuntimeSemanticOrdering";

export function serializeRuntimeSemanticDiagnosticBundleFromReports(
  reasoningReports: RuntimeReasoningPlanningReports
): Readonly<{
  runtimeSemanticGroups: ReturnType<typeof serializeRuntimeSemanticGroupsSummaryForDiagnostic>;
  compressedRuntimeReasoningTrace: ReturnType<typeof serializeCompressedRuntimeReasoningTraceForDiagnostic>;
  runtimeSemanticRedundancySummary: ReturnType<typeof serializeRuntimeSemanticRedundancySummaryForDiagnostic>;
  stabilizedRuntimeSemanticOrdering: ReturnType<typeof serializeStabilizedRuntimeSemanticOrderingForDiagnostic>;
}> {
  const reports = buildRuntimeSemanticPlanningReports(reasoningReports);

  return {
    runtimeSemanticGroups: serializeRuntimeSemanticGroupsSummaryForDiagnostic(reports.semanticGroupsSummary),
    compressedRuntimeReasoningTrace: serializeCompressedRuntimeReasoningTraceForDiagnostic(
      reports.compressedReasoningTrace
    ),
    runtimeSemanticRedundancySummary: serializeRuntimeSemanticRedundancySummaryForDiagnostic(
      reports.semanticRedundancySummary
    ),
    stabilizedRuntimeSemanticOrdering: serializeStabilizedRuntimeSemanticOrderingForDiagnostic(
      reports.stabilizedSemanticOrdering
    ),
  };
}

export function serializeRuntimeSemanticDiagnosticBundleFromContext(
  ctx: NormalizedRuntimePlanningContext
): ReturnType<typeof serializeRuntimeSemanticDiagnosticBundleFromReports> {
  const dependencyReports = buildRuntimeDependencyPlanningReports(ctx);
  const criticalityReports = buildRuntimeCriticalityPlanningReports(ctx, dependencyReports);
  const traceabilityReports = buildRuntimeTraceabilityPlanningReports(
    ctx,
    dependencyReports,
    criticalityReports
  );
  const reasoningReports = buildRuntimeReasoningPlanningReports(
    dependencyReports,
    criticalityReports,
    traceabilityReports
  );
  return serializeRuntimeSemanticDiagnosticBundleFromReports(reasoningReports);
}
