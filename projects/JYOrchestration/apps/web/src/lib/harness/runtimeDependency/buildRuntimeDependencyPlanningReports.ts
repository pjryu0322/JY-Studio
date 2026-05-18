/**
 * H15 — dependency graph·propagation·conflict **planning 보고서** 일괄 산출.
 */

import type { NormalizedRuntimePlanningContext } from "@/lib/harness/runtimeConsolidation/runtimePlanningConsolidationTypes";
import { buildRuntimePlanningDependencyGraph } from "./buildRuntimePlanningDependencyGraph";
import { evaluateRuntimePlanningImpactPropagation } from "./evaluateRuntimePlanningImpactPropagation";
import { evaluateRuntimePlanningDependencyConflicts } from "./evaluateRuntimePlanningDependencyConflicts";
import type {
  RuntimePlanningDependencyConflictSummary,
  RuntimePlanningDependencyGraph,
  RuntimePlanningImpactPropagationSummary,
} from "./runtimeDependencyTypes";

export type RuntimeDependencyPlanningReports = Readonly<{
  dependencyGraph: RuntimePlanningDependencyGraph;
  impactPropagationSummary: RuntimePlanningImpactPropagationSummary;
  dependencyConflictSummary: RuntimePlanningDependencyConflictSummary;
}>;

export function buildRuntimeDependencyPlanningReports(
  ctx: NormalizedRuntimePlanningContext
): RuntimeDependencyPlanningReports {
  const dependencyGraph = buildRuntimePlanningDependencyGraph(ctx);
  const impactPropagationSummary = evaluateRuntimePlanningImpactPropagation(ctx);
  const dependencyConflictSummary = evaluateRuntimePlanningDependencyConflicts(ctx);

  return { dependencyGraph, impactPropagationSummary, dependencyConflictSummary };
}
