/**
 * H21.5 — resource allocation planning reports **일괄 산출**(resource·governance 재계산 없음).
 */

import type { RuntimeSemanticPlanningReportsBeforeAllocation } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { buildRuntimeExecutionSlotPlan } from "./buildRuntimeExecutionSlotPlan";
import { buildRuntimeMemberAllocationPlan } from "./buildRuntimeMemberAllocationPlan";
import { buildRuntimeProviderSlotPlan } from "./buildRuntimeProviderSlotPlan";
import { evaluateRuntimeAllocationEligibility } from "./evaluateRuntimeAllocationEligibility";
import type { RuntimeResourceAllocationPlanningReports } from "./runtimeResourceAllocationTypes";

export type { RuntimeResourceAllocationPlanningReports } from "./runtimeResourceAllocationTypes";

function mergeSortedUnique(rows: readonly string[]): readonly string[] {
  const next = rows
    .map((s) => String(s ?? "").trim())
    .filter((s) => s.length > 0);
  return [...new Set(next)].sort((a, b) => a.localeCompare(b, "ko"));
}

export function buildRuntimeResourceAllocationPlanningReports(
  reports: RuntimeSemanticPlanningReportsBeforeAllocation
): RuntimeResourceAllocationPlanningReports {
  const runtimeAllocationEligibilitySummary = evaluateRuntimeAllocationEligibility(reports);
  const memberPlans = buildRuntimeMemberAllocationPlan(reports, runtimeAllocationEligibilitySummary);
  const runtimeProviderSlotPlan = buildRuntimeProviderSlotPlan(reports);
  const runtimeExecutionSlotPlan = buildRuntimeExecutionSlotPlan(reports);

  const memberRecs = memberPlans
    .filter((m) => m.allocationMode !== "not_needed")
    .map((m) => `${m.memberId}: ${m.allocationMode}`);

  const recommendationRows = mergeSortedUnique([
    ...runtimeAllocationEligibilitySummary.recommendations,
    ...memberRecs,
    ...runtimeProviderSlotPlan.recommendations,
    ...runtimeExecutionSlotPlan.recommendations,
    ...reports.runtimeResourceGovernanceSummary.recommendations,
  ]);

  const runtimeResourceAllocationPlan = {
    mode: "runtime_resource_allocation_plan" as const,
    actualRuntimeOrchestrationEnabled: false as const,
    actualResourceAllocationEnabled: false as const,
    globalAllocationMode: runtimeAllocationEligibilitySummary.effectiveAllocationMode,
    memberPlans,
    recommendationRows,
  };

  return {
    runtimeResourceAllocationPlan,
    runtimeAllocationEligibilitySummary,
    runtimeProviderSlotPlan,
    runtimeExecutionSlotPlan,
  };
}
