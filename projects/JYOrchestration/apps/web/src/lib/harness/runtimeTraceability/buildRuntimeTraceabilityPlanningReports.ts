/**
 * H16 — reasoning chain·dependency/priority trace **planning 보고서** 일괄 산출.
 */

import type { NormalizedRuntimePlanningContext } from "@/lib/harness/runtimeConsolidation/runtimePlanningConsolidationTypes";
import type { RuntimeCriticalityPlanningReports } from "@/lib/harness/runtimeCriticality/buildRuntimeCriticalityPlanningReports";
import type { RuntimeDependencyPlanningReports } from "@/lib/harness/runtimeDependency/buildRuntimeDependencyPlanningReports";
import { buildPlanningReasoningChain } from "./buildPlanningReasoningChain";
import { evaluateDependencyReasoningTrace } from "./evaluateDependencyReasoningTrace";
import { evaluatePriorityReasoningTrace } from "./evaluatePriorityReasoningTrace";
import type {
  RuntimeDependencyReasoningTraceSummary,
  RuntimePlanningReasoningChain,
  RuntimePriorityReasoningTraceSummary,
} from "./runtimeTraceabilityTypes";

export type RuntimeTraceabilityPlanningReports = Readonly<{
  reasoningChain: RuntimePlanningReasoningChain;
  dependencyReasoningTraceSummary: RuntimeDependencyReasoningTraceSummary;
  priorityReasoningTraceSummary: RuntimePriorityReasoningTraceSummary;
}>;

export function buildRuntimeTraceabilityPlanningReports(
  ctx: NormalizedRuntimePlanningContext,
  dependencyReports: RuntimeDependencyPlanningReports,
  criticalityReports: RuntimeCriticalityPlanningReports
): RuntimeTraceabilityPlanningReports {
  const reasoningChain = buildPlanningReasoningChain(ctx, dependencyReports, criticalityReports);
  const dependencyReasoningTraceSummary = evaluateDependencyReasoningTrace(ctx, dependencyReports);
  const priorityReasoningTraceSummary = evaluatePriorityReasoningTrace(criticalityReports);

  return { reasoningChain, dependencyReasoningTraceSummary, priorityReasoningTraceSummary };
}
