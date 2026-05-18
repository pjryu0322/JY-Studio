/**
 * H15.5 — criticality·priority propagation·escalation flow **planning 보고서** 일괄 산출.
 */

import type { NormalizedRuntimePlanningContext } from "@/lib/harness/runtimeConsolidation/runtimePlanningConsolidationTypes";
import type { RuntimeDependencyPlanningReports } from "@/lib/harness/runtimeDependency/buildRuntimeDependencyPlanningReports";
import { evaluateRuntimePlanningCriticality } from "./evaluateRuntimePlanningCriticality";
import { evaluatePriorityPropagation } from "./evaluatePriorityPropagation";
import { evaluateEscalationPriorityFlow } from "./evaluateEscalationPriorityFlow";
import type {
  RuntimeEscalationPriorityFlowSummary,
  RuntimePlanningCriticalitySummary,
  RuntimePriorityPropagationSummary,
} from "./runtimeCriticalityTypes";

export type RuntimeCriticalityPlanningReports = Readonly<{
  criticalitySummary: RuntimePlanningCriticalitySummary;
  priorityPropagationSummary: RuntimePriorityPropagationSummary;
  escalationPriorityFlowSummary: RuntimeEscalationPriorityFlowSummary;
}>;

export function buildRuntimeCriticalityPlanningReports(
  ctx: NormalizedRuntimePlanningContext,
  dependencyReports: RuntimeDependencyPlanningReports
): RuntimeCriticalityPlanningReports {
  const criticalitySummary = evaluateRuntimePlanningCriticality(ctx, dependencyReports);
  const priorityPropagationSummary = evaluatePriorityPropagation(ctx, dependencyReports);
  const escalationPriorityFlowSummary = evaluateEscalationPriorityFlow(ctx, dependencyReports);

  return { criticalitySummary, priorityPropagationSummary, escalationPriorityFlowSummary };
}
