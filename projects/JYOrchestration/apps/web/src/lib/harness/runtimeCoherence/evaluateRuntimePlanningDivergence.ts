/**
 * H14 — planning **divergence** 평가(read-only; lifecycle drift와 중복 계산 없음).
 */

import type { RuntimeLifecyclePlanningReports } from "@/lib/harness/runtimeLifecycle/buildRuntimeLifecyclePlanningReports";
import type { RuntimePlanningCoherenceSummary } from "./runtimeCoherenceTypes";
import type { RuntimePlanningSynchronizationSummary } from "./runtimeCoherenceTypes";
import type { RuntimePlanningDivergenceReport, RuntimePlanningDivergenceSeverity } from "./runtimeCoherenceTypes";

export function evaluateRuntimePlanningDivergence(input: {
  readonly lifecycleReports: RuntimeLifecyclePlanningReports;
  readonly coherenceSummary: RuntimePlanningCoherenceSummary;
  readonly synchronizationSummary: RuntimePlanningSynchronizationSummary;
}): RuntimePlanningDivergenceReport {
  const divergenceAreas: string[] = [];
  const divergenceReasons: string[] = [];
  let divergenceSeverity: RuntimePlanningDivergenceSeverity = "low";

  const bump = (next: RuntimePlanningDivergenceSeverity) => {
    const order: RuntimePlanningDivergenceSeverity[] = ["low", "medium", "high"];
    if (order.indexOf(next) > order.indexOf(divergenceSeverity)) divergenceSeverity = next;
  };

  const { driftReport, invalidationSummary } = input.lifecycleReports;

  if (input.coherenceSummary.coherenceLevel === "misaligned") {
    divergenceAreas.push("coherence");
    divergenceReasons.push("Planning coherence misaligned — 교차 레이어 불일치.");
    bump("high");
  } else if (input.coherenceSummary.coherenceLevel === "partial") {
    divergenceAreas.push("coherence");
    divergenceReasons.push("Partial coherence — 일부 planning 영역 불일치.");
    bump("medium");
  }

  if (input.synchronizationSummary.synchronizationState === "desynchronized") {
    divergenceAreas.push("synchronization");
    divergenceReasons.push("Planning synchronization desynchronized.");
    bump("high");
  } else if (input.synchronizationSummary.synchronizationState === "lagging") {
    divergenceAreas.push("synchronization");
    divergenceReasons.push("Synchronization lag — stale consistency 가능.");
    bump("medium");
  }

  for (const area of driftReport.driftAreas) {
    if (!divergenceAreas.includes(area)) divergenceAreas.push(area);
  }
  if (driftReport.driftSeverity === "high") {
    divergenceReasons.push("Lifecycle drift high — divergence 신호.");
    bump("high");
  }

  if (invalidationSummary.lifecycleState === "invalidated") {
    divergenceAreas.push("invalidation");
    divergenceReasons.push("Invalidation 후보 — planning divergence 상승.");
    bump("high");
  }

  const recommendations: string[] = ["Divergence는 planning 정렬 힌트만 제공합니다."];
  if (divergenceSeverity !== "low") {
    if (divergenceSeverity === "high") {
      recommendations.push(
        "높은 divergence — H12–H14 섹션을 재검토하고 planning_only 후보를 유지하세요."
      );
    } else {
      recommendations.push("중간 divergence — sync 타깃·lagging layer를 확인하세요.");
    }
  } else {
    recommendations.push("주기적으로 coherence·synchronization 메타를 확인하세요.");
  }

  if (divergenceReasons.length === 0) {
    divergenceReasons.push("관측 범위에서 planning divergence는 낮습니다.");
  }

  return {
    mode: "runtime_planning_divergence_report",
    actualRuntimeOrchestrationEnabled: false,
    divergenceAreas: [...new Set(divergenceAreas)].slice(0, 8),
    divergenceSeverity,
    divergenceReasons: divergenceReasons.slice(0, 10),
    recommendations: recommendations.slice(0, 6),
  };
}

export function serializeRuntimePlanningDivergenceReportForDiagnostic(
  report: RuntimePlanningDivergenceReport
): Readonly<Record<string, unknown>> {
  return {
    mode: report.mode,
    actualRuntimeOrchestrationEnabled: report.actualRuntimeOrchestrationEnabled,
    divergenceAreas: [...report.divergenceAreas],
    divergenceSeverity: report.divergenceSeverity,
    divergenceReasons: [...report.divergenceReasons],
    recommendations: [...report.recommendations],
  };
}
