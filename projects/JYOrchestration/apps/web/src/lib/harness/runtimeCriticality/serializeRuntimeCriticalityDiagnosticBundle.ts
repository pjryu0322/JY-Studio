/**
 * H15.5 — 진단 API용 runtime criticality wire 묶음.
 */

import type { NormalizedRuntimePlanningContext } from "@/lib/harness/runtimeConsolidation/runtimePlanningConsolidationTypes";
import type { RuntimeDependencyPlanningReports } from "@/lib/harness/runtimeDependency/buildRuntimeDependencyPlanningReports";
import { buildRuntimeDependencyPlanningReports } from "@/lib/harness/runtimeDependency/buildRuntimeDependencyPlanningReports";
import {
  buildRuntimeCriticalityPlanningReports,
  type RuntimeCriticalityPlanningReports,
} from "./buildRuntimeCriticalityPlanningReports";
import { serializeRuntimePlanningCriticalitySummaryForDiagnostic } from "./evaluateRuntimePlanningCriticality";
import { serializeRuntimePriorityPropagationSummaryForDiagnostic } from "./evaluatePriorityPropagation";
import { serializeRuntimeEscalationPriorityFlowSummaryForDiagnostic } from "./evaluateEscalationPriorityFlow";

export function serializeRuntimeCriticalityDiagnosticBundleFromReports(
  reports: RuntimeCriticalityPlanningReports
): Readonly<{
  runtimePlanningCriticalitySummary: ReturnType<typeof serializeRuntimePlanningCriticalitySummaryForDiagnostic>;
  runtimePriorityPropagationSummary: ReturnType<typeof serializeRuntimePriorityPropagationSummaryForDiagnostic>;
  runtimeEscalationPriorityFlowSummary: ReturnType<typeof serializeRuntimeEscalationPriorityFlowSummaryForDiagnostic>;
}> {
  return {
    runtimePlanningCriticalitySummary: serializeRuntimePlanningCriticalitySummaryForDiagnostic(
      reports.criticalitySummary
    ),
    runtimePriorityPropagationSummary: serializeRuntimePriorityPropagationSummaryForDiagnostic(
      reports.priorityPropagationSummary
    ),
    runtimeEscalationPriorityFlowSummary: serializeRuntimeEscalationPriorityFlowSummaryForDiagnostic(
      reports.escalationPriorityFlowSummary
    ),
  };
}

export function serializeRuntimeCriticalityDiagnosticBundleFromPlanning(
  ctx: NormalizedRuntimePlanningContext,
  dependencyReports: RuntimeDependencyPlanningReports
): ReturnType<typeof serializeRuntimeCriticalityDiagnosticBundleFromReports> {
  return serializeRuntimeCriticalityDiagnosticBundleFromReports(
    buildRuntimeCriticalityPlanningReports(ctx, dependencyReports)
  );
}

export function serializeRuntimeCriticalityDiagnosticBundleFromContext(
  ctx: NormalizedRuntimePlanningContext
): ReturnType<typeof serializeRuntimeCriticalityDiagnosticBundleFromPlanning> {
  return serializeRuntimeCriticalityDiagnosticBundleFromPlanning(
    ctx,
    buildRuntimeDependencyPlanningReports(ctx)
  );
}
