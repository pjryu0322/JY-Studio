/**
 * H15 — 진단 API용 runtime dependency wire 묶음.
 */

import type { NormalizedRuntimePlanningContext } from "@/lib/harness/runtimeConsolidation/runtimePlanningConsolidationTypes";
import {
  buildRuntimeDependencyPlanningReports,
  type RuntimeDependencyPlanningReports,
} from "./buildRuntimeDependencyPlanningReports";
import { serializeRuntimePlanningDependencyGraphForDiagnostic } from "./buildRuntimePlanningDependencyGraph";
import { serializeRuntimePlanningImpactPropagationSummaryForDiagnostic } from "./evaluateRuntimePlanningImpactPropagation";
import { serializeRuntimePlanningDependencyConflictSummaryForDiagnostic } from "./evaluateRuntimePlanningDependencyConflicts";

export function serializeRuntimeDependencyDiagnosticBundleFromReports(
  reports: RuntimeDependencyPlanningReports
): Readonly<{
  runtimePlanningDependencyGraph: ReturnType<typeof serializeRuntimePlanningDependencyGraphForDiagnostic>;
  runtimePlanningImpactPropagationSummary: ReturnType<
    typeof serializeRuntimePlanningImpactPropagationSummaryForDiagnostic
  >;
  runtimePlanningDependencyConflictSummary: ReturnType<
    typeof serializeRuntimePlanningDependencyConflictSummaryForDiagnostic
  >;
}> {
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

export function serializeRuntimeDependencyDiagnosticBundleFromContext(
  ctx: NormalizedRuntimePlanningContext
): ReturnType<typeof serializeRuntimeDependencyDiagnosticBundleFromReports> {
  return serializeRuntimeDependencyDiagnosticBundleFromReports(buildRuntimeDependencyPlanningReports(ctx));
}
