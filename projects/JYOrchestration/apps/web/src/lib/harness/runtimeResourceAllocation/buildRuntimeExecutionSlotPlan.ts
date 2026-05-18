/**
 * H21.5 — execution **slot·queue** planning 힌트(read-only; 큐·동시성 제어 없음).
 */

import type { RuntimeSemanticPlanningReportsBeforeAllocation } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import type { RuntimeExecutionSlotPlan } from "./runtimeResourceAllocationTypes";

export function buildRuntimeExecutionSlotPlan(
  reports: RuntimeSemanticPlanningReportsBeforeAllocation
): RuntimeExecutionSlotPlan {
  const q = reports.runtimeResourceSummary.queuePressureInsight;
  const bp = reports.runtimeResourceSummary.bottleneckPropagation;
  const cap = reports.runtimeResourceCapacity;
  const recommendations = [
    `queueAmplification=${q.amplificationLevel}`,
    `bottleneckPropagation=${bp.propagationSeverity}`,
    `capacityOutlook=${cap.outlook}`,
  ].sort((a, b) => a.localeCompare(b, "ko"));

  return {
    mode: "runtime_execution_slot_plan",
    actualRuntimeOrchestrationEnabled: false,
    actualResourceAllocationEnabled: false,
    executionSlotHintKo: `${q.summaryKo} — 실행 슬롯·큐 제어 없음`,
    queueAndBottleneckLinkKo: `${bp.bottleneckChainKo} / ${bp.slowdownRiskKo}`,
    recommendations,
  };
}
