/**
 * H14 — planning **synchronization** 평가(read-only).
 */

import type { RuntimeLifecyclePlanningReports } from "@/lib/harness/runtimeLifecycle/buildRuntimeLifecyclePlanningReports";
import type { RuntimePriorityPlanningReports } from "@/lib/harness/runtimePriority/buildRuntimePriorityPlanningReports";
import type { RuntimeStabilityPlanningReports } from "@/lib/harness/runtimeStability/buildRuntimeStabilityPlanningReports";
import type {
  RuntimePlanningSynchronizationState,
  RuntimePlanningSynchronizationSummary,
} from "./runtimeCoherenceTypes";

const SYNC_TARGETS = [
  "governance",
  "stability",
  "priority",
  "escalation",
  "lifecycle",
] as const;

export function evaluateRuntimePlanningSynchronization(input: {
  readonly stabilityReports: RuntimeStabilityPlanningReports;
  readonly priorityReports: RuntimePriorityPlanningReports;
  readonly lifecycleReports: RuntimeLifecyclePlanningReports;
}): RuntimePlanningSynchronizationSummary {
  const staleConsistencyIssues: string[] = [];
  const laggingLayers: string[] = [];
  let synchronizationState: RuntimePlanningSynchronizationState = "synchronized";

  const { freshnessSummary, driftReport, invalidationSummary } = input.lifecycleReports;
  const { stabilitySummary, saturationSummary } = input.stabilityReports;
  const { escalationSummary } = input.priorityReports;

  const lag = (layer: string, note: string) => {
    laggingLayers.push(layer);
    staleConsistencyIssues.push(note);
    if (synchronizationState === "synchronized") synchronizationState = "lagging";
  };

  if (freshnessSummary.freshnessLevel === "stale") {
    lag("lifecycle", "Lifecycle freshness stale — 상위 stability·priority와 동기 지연 가능.");
  }
  if (stabilitySummary.stabilityLevel === "unstable" && freshnessSummary.freshnessLevel === "fresh") {
    lag("stability", "Stability unstable vs lifecycle fresh — stale consistency 불일치.");
  }
  if (
    escalationSummary.escalationLevel === "critical" &&
    invalidationSummary.lifecycleState === "active"
  ) {
    lag("escalation", "Critical escalation vs active lifecycle — synchronization lag.");
  }
  if (saturationSummary.saturationLevel === "high" && driftReport.driftSeverity === "low") {
    lag("saturation", "High saturation vs low drift — planning alignment 재검토.");
  }

  if (driftReport.driftSeverity === "high" || invalidationSummary.lifecycleState === "invalidated") {
    synchronizationState = "desynchronized";
    staleConsistencyIssues.push("Lifecycle drift·invalidation과 planning sync가 어긋납니다.");
  }

  const recommendations: string[] = [
    "Synchronization은 planning 메타 동기 상태만 표시합니다. payload·DB 변경 없음.",
    synchronizationState === "synchronized"
      ? "레이어 간 sync 타깃이 관측 범위에서 일치합니다."
      : "지연 레이어를 H10–H13.5 순서로 재검토하세요.",
  ];

  if (staleConsistencyIssues.length === 0) {
    staleConsistencyIssues.push("Stale consistency 이슈는 관측 범위에서 낮습니다.");
  }

  return {
    mode: "runtime_planning_synchronization_summary",
    actualRuntimeOrchestrationEnabled: false,
    synchronizationState,
    staleConsistencyIssues: staleConsistencyIssues.slice(0, 8),
    syncTargets: [...SYNC_TARGETS],
    laggingLayers: [...new Set(laggingLayers)].slice(0, 6),
    recommendations: recommendations.slice(0, 6),
  };
}

export function serializeRuntimePlanningSynchronizationSummaryForDiagnostic(
  summary: RuntimePlanningSynchronizationSummary
): Readonly<Record<string, unknown>> {
  return {
    mode: summary.mode,
    actualRuntimeOrchestrationEnabled: summary.actualRuntimeOrchestrationEnabled,
    synchronizationState: summary.synchronizationState,
    staleConsistencyIssues: [...summary.staleConsistencyIssues],
    syncTargets: [...summary.syncTargets],
    laggingLayers: [...summary.laggingLayers],
    recommendations: [...summary.recommendations],
  };
}
