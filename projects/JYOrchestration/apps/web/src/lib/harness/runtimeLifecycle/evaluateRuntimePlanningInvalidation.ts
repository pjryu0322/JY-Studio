/**
 * H13.5 — planning **invalidation** 후보 평가(read-only).
 */

import type { RuntimePlanningFreshnessSummary } from "./runtimeLifecycleTypes";
import type { RuntimePlanningDriftReport } from "./runtimeLifecycleTypes";
import type { RuntimePriorityPlanningReports } from "@/lib/harness/runtimePriority/buildRuntimePriorityPlanningReports";
import type { RuntimeStabilityPlanningReports } from "@/lib/harness/runtimeStability/buildRuntimeStabilityPlanningReports";
import type {
  RuntimePlanningInvalidationSummary,
  RuntimePlanningLifecycleState,
} from "./runtimeLifecycleTypes";

export function evaluateRuntimePlanningInvalidation(input: {
  readonly stabilityReports: RuntimeStabilityPlanningReports;
  readonly priorityReports: RuntimePriorityPlanningReports;
  readonly freshnessSummary: RuntimePlanningFreshnessSummary;
  readonly driftReport: RuntimePlanningDriftReport;
}): RuntimePlanningInvalidationSummary {
  const invalidationCandidates: string[] = [];
  const staleDependencies: string[] = [];
  const stalePlanningAreas: string[] = [];

  for (const blocked of input.priorityReports.dependencyReport.blockedDependencies) {
    staleDependencies.push(blocked);
  }
  for (const dep of input.stabilityReports.stabilitySummary.criticalDependencies) {
    if (!staleDependencies.includes(dep)) staleDependencies.push(dep);
  }

  if (input.freshnessSummary.freshnessLevel === "stale") {
    invalidationCandidates.push("enforcement_candidate_metadata:stale");
    stalePlanningAreas.push("runtime_enforcement_planning");
  }
  if (input.driftReport.driftSeverity === "high") {
    invalidationCandidates.push("planning_dependency_ordering:drift_high");
    stalePlanningAreas.push("dependency_ordering");
  }
  if (input.priorityReports.escalationSummary.operatorAttentionRequired) {
    invalidationCandidates.push("operator_attention_planning:review");
  }
  if (input.stabilityReports.conflictReport.blockedCandidates.length > 0) {
    invalidationCandidates.push("blocked_enforcement_candidates:refresh");
  }

  let lifecycleState: RuntimePlanningLifecycleState = input.freshnessSummary.lifecycleState;
  if (
    invalidationCandidates.length >= 2 &&
    (input.freshnessSummary.freshnessLevel === "stale" || input.driftReport.driftSeverity === "high")
  ) {
    lifecycleState = "invalidated";
  }

  const recommendations: string[] = [
    "Invalidation은 planning 메타 무효화 **후보**만 표시합니다. 실제 삭제·전환 없음.",
    lifecycleState === "invalidated"
      ? "무효화 후보 다수 — planning_only로 되돌리고 freshness 재평가를 권장합니다."
      : "현재 lifecycle은 무효화 후보 수준이 낮습니다.",
  ];

  return {
    mode: "runtime_planning_invalidation_summary",
    actualRuntimeOrchestrationEnabled: false,
    lifecycleState,
    invalidationCandidates: invalidationCandidates.slice(0, 10),
    staleDependencies: staleDependencies.slice(0, 10),
    stalePlanningAreas: [...new Set(stalePlanningAreas)].slice(0, 8),
    recommendations: recommendations.slice(0, 6),
  };
}

export function serializeRuntimePlanningInvalidationSummaryForDiagnostic(
  summary: RuntimePlanningInvalidationSummary
): Readonly<Record<string, unknown>> {
  return {
    mode: summary.mode,
    actualRuntimeOrchestrationEnabled: summary.actualRuntimeOrchestrationEnabled,
    lifecycleState: summary.lifecycleState,
    invalidationCandidates: [...summary.invalidationCandidates],
    staleDependencies: [...summary.staleDependencies],
    stalePlanningAreas: [...summary.stalePlanningAreas],
    recommendations: [...summary.recommendations],
  };
}
