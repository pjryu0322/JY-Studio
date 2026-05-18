/**
 * H21.5 — AI 멤버별 **allocation planning** 행(read-only; 실제 스케줄 없음).
 */

import type { RuntimeMemberWorkloadEntry } from "@/lib/harness/runtimeResource/runtimeResourceTypes";
import type { RuntimeSemanticPlanningReportsBeforeAllocation } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import type {
  RuntimeAllocationEligibilitySummary,
  RuntimeAllocationMode,
  RuntimeMemberAllocationPlanEntry,
} from "./runtimeResourceAllocationTypes";

const WORKLOAD_RANK: Readonly<Record<RuntimeMemberWorkloadEntry["workloadLevel"], number>> = {
  saturated: 3,
  elevated: 2,
  balanced: 1,
  idle: 0,
};

function memberAllocationMode(
  globalMode: RuntimeAllocationMode,
  workloadLevel: RuntimeMemberWorkloadEntry["workloadLevel"]
): RuntimeAllocationMode {
  if (globalMode === "blocked_by_governance" || globalMode === "not_needed") return globalMode;
  if (globalMode === "planning_only") {
    return workloadLevel === "elevated" || workloadLevel === "saturated" ? "planning_only" : "not_needed";
  }
  if (workloadLevel === "saturated" || workloadLevel === "elevated") return "dry_run_candidate";
  if (workloadLevel === "balanced") return "planning_only";
  return "not_needed";
}

export function buildRuntimeMemberAllocationPlan(
  reports: RuntimeSemanticPlanningReportsBeforeAllocation,
  eligibility: RuntimeAllocationEligibilitySummary
): readonly RuntimeMemberAllocationPlanEntry[] {
  const globalMode = eligibility.effectiveAllocationMode;
  const ordered = [...reports.runtimeMemberWorkload.members].sort((a, b) => {
    const dr = WORKLOAD_RANK[b.workloadLevel] - WORKLOAD_RANK[a.workloadLevel];
    return dr !== 0 ? dr : a.memberId.localeCompare(b.memberId);
  });

  return ordered.map((m, index) => {
    const allocationMode = memberAllocationMode(globalMode, m.workloadLevel);
    return {
      memberId: m.memberId,
      allocationMode,
      priorityRank: index + 1,
      tokenBudgetHintKo: `토큰 예산은 planning proxy — ${m.noteKo}`,
      congestionHintKo: `혼잡 신호: workload=${m.workloadLevel}, saturationRisk=${m.saturationRisk}`,
      timingHintKo:
        allocationMode === "dry_run_candidate"
          ? "dry-run 슬롯 후보(실제 스케줄링·큐 제어 없음)"
          : "실제 타이밍·슬롯 확정 없음(read-only)",
    };
  });
}
