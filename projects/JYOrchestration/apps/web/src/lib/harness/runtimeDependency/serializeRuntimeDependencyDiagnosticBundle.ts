/**
 * H15 — 진단 API용 runtime dependency wire 묶음.
 */

import type { NormalizedRuntimePlanningContext } from "@/lib/harness/runtimeConsolidation/runtimePlanningConsolidationTypes";
import { buildRuntimeDependencyPlanningReports } from "./buildRuntimeDependencyPlanningReports";
import { serializeRuntimePlanningDependencyGraphForDiagnostic } from "./buildRuntimePlanningDependencyGraph";
import { serializeRuntimePlanningImpactPropagationSummaryForDiagnostic } from "./evaluateRuntimePlanningImpactPropagation";
import { serializeRuntimePlanningDependencyConflictSummaryForDiagnostic } from "./evaluateRuntimePlanningDependencyConflicts";

export function serializeRuntimeDependencyDiagnosticBundleFromContext(
  ctx: NormalizedRuntimePlanningContext
): Readonly<{
  runtimePlanningDependencyGraph: ReturnType<typeof serializeRuntimePlanningDependencyGraphForDiagnostic>;
  runtimePlanningImpactPropagationSummary: ReturnType<
    typeof serializeRuntimePlanningImpactPropagationSummaryForDiagnostic
  >;
  runtimePlanningDependencyConflictSummary: ReturnType<
    typeof serializeRuntimePlanningDependencyConflictSummaryForDiagnostic
  >;
}> {
  const reports = buildRuntimeDependencyPlanningReports(ctx);

  return {
    runtimePlanningDependencyGraph: serializeRuntimePlanningDependencyGraphForDiagnostic(reports.dependencyGraph),
    runtimePlanningImpactPropagationSummary: serializeRuntimePlanningImpactPropagationSummaryForDiagnostic(
      reports.impactPropagationSummary
    ),
    runtimePlanningDependencyConflictSummary: serializeRuntimePlanningDependencyConflictSummaryForDiagnostic(
      reports.dependencyConflictSummary
    ),
  };
}
