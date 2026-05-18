/**
 * H14.5 — 분산 planning summary를 **unified** 스냅샷으로 정리(read-only).
 */

import {
  RUNTIME_PLANNING_COHERENCE_LABEL_KO,
  RUNTIME_PLANNING_DIVERGENCE_SEVERITY_LABEL_KO,
  RUNTIME_PLANNING_SYNCHRONIZATION_LABEL_KO,
} from "@/lib/harness/runtimeCoherence/runtimeCoherenceLabelsKo";
import {
  RUNTIME_PLANNING_DRIFT_SEVERITY_LABEL_KO,
  RUNTIME_PLANNING_FRESHNESS_LABEL_KO,
  RUNTIME_PLANNING_LIFECYCLE_STATE_LABEL_KO,
} from "@/lib/harness/runtimeLifecycle/runtimeLifecycleLabelsKo";
import {
  RUNTIME_ESCALATION_LEVEL_LABEL_KO,
  RUNTIME_PLANNING_PRIORITY_LABEL_KO,
} from "@/lib/harness/runtimePriority/runtimePriorityLabelsKo";
import {
  CANDIDATE_CONFLICT_SEVERITY_LABEL_KO,
  CANDIDATE_SATURATION_LEVEL_LABEL_KO,
  RUNTIME_STABILITY_LEVEL_LABEL_KO,
} from "@/lib/harness/runtimeStability/runtimeStabilityLabelsKo";
import type { NormalizedRuntimePlanningContext, UnifiedRuntimePlanningSummary } from "./runtimePlanningConsolidationTypes";

function uniqueStrings(items: readonly string[], max: number): readonly string[] {
  return [...new Set(items)].slice(0, max);
}

export function buildUnifiedRuntimePlanningSummary(
  ctx: NormalizedRuntimePlanningContext
): UnifiedRuntimePlanningSummary {
  const { stabilityReports, priorityReports, lifecycleReports, coherenceReports } = ctx;
  const { stabilitySummary, conflictReport, saturationSummary } = stabilityReports;
  const { bottleneckSummary, escalationSummary, dependencyReport } = priorityReports;
  const { freshnessSummary, driftReport, invalidationSummary } = lifecycleReports;
  const { coherenceSummary, synchronizationSummary, divergenceReport } = coherenceReports;

  const criticalIssues: string[] = [];
  if (stabilitySummary.stabilityLevel === "unstable") {
    criticalIssues.push(`Stability ${stabilitySummary.stabilityLevel}`);
  }
  if (conflictReport.severity === "high") {
    criticalIssues.push("후보 충돌 심각도 높음");
  }
  if (dependencyReport.dependencyCycles.length > 0) {
    criticalIssues.push("Dependency ordering 순환");
  }
  if (freshnessSummary.freshnessLevel === "stale") {
    criticalIssues.push("Planning freshness stale");
  }
  if (coherenceSummary.coherenceLevel === "misaligned") {
    criticalIssues.push("Planning coherence misaligned");
  }
  if (divergenceReport.divergenceSeverity === "high") {
    criticalIssues.push("Planning divergence 높음");
  }

  const recommendations: string[] = [
    "H14.5 unified summary는 planning 메타만 통합합니다. actual orchestration·enforcement 없음.",
    criticalIssues.length > 0
      ? "critical issue가 있으면 H12–H14 세부 섹션을 순서대로 확인하세요."
      : "현재 planning 레이어는 관측 범위에서 정합적으로 유지됩니다.",
  ];

  return {
    mode: "unified_runtime_planning_summary",
    actualRuntimeOrchestrationEnabled: false,
    stability: {
      headline: RUNTIME_STABILITY_LEVEL_LABEL_KO[stabilitySummary.stabilityLevel],
      detail: `충돌 ${CANDIDATE_CONFLICT_SEVERITY_LABEL_KO[conflictReport.severity]} · 포화 ${CANDIDATE_SATURATION_LEVEL_LABEL_KO[saturationSummary.saturationLevel]}`,
    },
    priority: {
      headline: RUNTIME_PLANNING_PRIORITY_LABEL_KO[bottleneckSummary.overallPlanningPriority],
      detail: `Escalation ${RUNTIME_ESCALATION_LEVEL_LABEL_KO[escalationSummary.escalationLevel]}`,
    },
    lifecycle: {
      headline: RUNTIME_PLANNING_FRESHNESS_LABEL_KO[freshnessSummary.freshnessLevel],
      detail: `${RUNTIME_PLANNING_LIFECYCLE_STATE_LABEL_KO[invalidationSummary.lifecycleState]} · drift ${RUNTIME_PLANNING_DRIFT_SEVERITY_LABEL_KO[driftReport.driftSeverity]}`,
    },
    coherence: {
      headline: RUNTIME_PLANNING_COHERENCE_LABEL_KO[coherenceSummary.coherenceLevel],
      detail: `${RUNTIME_PLANNING_SYNCHRONIZATION_LABEL_KO[synchronizationSummary.synchronizationState]} · divergence ${RUNTIME_PLANNING_DIVERGENCE_SEVERITY_LABEL_KO[divergenceReport.divergenceSeverity]}`,
    },
    criticalIssues: uniqueStrings(criticalIssues, 8),
    recommendations: uniqueStrings(recommendations, 6),
  };
}

export function serializeUnifiedRuntimePlanningSummaryForDiagnostic(
  summary: UnifiedRuntimePlanningSummary
): Readonly<Record<string, unknown>> {
  return {
    mode: summary.mode,
    actualRuntimeOrchestrationEnabled: summary.actualRuntimeOrchestrationEnabled,
    stability: { ...summary.stability },
    priority: { ...summary.priority },
    lifecycle: { ...summary.lifecycle },
    coherence: { ...summary.coherence },
    criticalIssues: [...summary.criticalIssues],
    recommendations: [...summary.recommendations],
  };
}
