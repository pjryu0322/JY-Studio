/**
 * H14 — planning **coherence** 평가(read-only; H13.5 lifecycle reports 재사용).
 */

import type { RuntimeLifecyclePlanningReports } from "@/lib/harness/runtimeLifecycle/buildRuntimeLifecyclePlanningReports";
import type { RuntimePriorityPlanningReports } from "@/lib/harness/runtimePriority/buildRuntimePriorityPlanningReports";
import type { RuntimeStabilityPlanningReports } from "@/lib/harness/runtimeStability/buildRuntimeStabilityPlanningReports";
import type { RuntimePlanningCoherenceLevel, RuntimePlanningCoherenceSummary } from "./runtimeCoherenceTypes";

export function evaluateRuntimePlanningCoherence(input: {
  readonly stabilityReports: RuntimeStabilityPlanningReports;
  readonly priorityReports: RuntimePriorityPlanningReports;
  readonly lifecycleReports: RuntimeLifecyclePlanningReports;
}): RuntimePlanningCoherenceSummary {
  const misalignedAreas: string[] = [];
  const alignmentFactors: string[] = [];
  let coherenceLevel: RuntimePlanningCoherenceLevel = "aligned";
  let alignmentScore = 100;

  const { freshnessSummary, driftReport, invalidationSummary } = input.lifecycleReports;
  const { stabilitySummary, conflictReport } = input.stabilityReports;
  const { escalationSummary, dependencyReport } = input.priorityReports;

  const markPartial = (area: string, delta: number) => {
    misalignedAreas.push(area);
    alignmentScore = Math.max(0, alignmentScore - delta);
    if (coherenceLevel === "aligned") coherenceLevel = "partial";
  };

  const markMisaligned = (area: string, delta: number) => {
    if (!misalignedAreas.includes(area)) misalignedAreas.push(area);
    alignmentScore = Math.max(0, alignmentScore - delta);
    coherenceLevel = "misaligned";
  };

  if (stabilitySummary.stabilityLevel === "stable" && freshnessSummary.freshnessLevel === "fresh") {
    alignmentFactors.push("Stability·freshness 신호가 정합합니다.");
  }

  if (stabilitySummary.stabilityLevel !== "stable") {
    markPartial(`stability:${stabilitySummary.stabilityLevel}`, 15);
  }
  if (freshnessSummary.freshnessLevel !== "fresh") {
    markPartial(`freshness:${freshnessSummary.freshnessLevel}`, 12);
  }
  if (escalationSummary.escalationLevel === "escalated" || escalationSummary.escalationLevel === "critical") {
    markPartial(`escalation:${escalationSummary.escalationLevel}`, 18);
  }
  if (dependencyReport.dependencyCycles.length > 0) {
    markMisaligned("dependency_ordering", 25);
  }
  if (driftReport.driftSeverity === "high") {
    markMisaligned("lifecycle_drift", 22);
  } else if (driftReport.driftSeverity === "medium") {
    markPartial("lifecycle_drift", 10);
  }
  if (invalidationSummary.lifecycleState === "invalidated") {
    markMisaligned("lifecycle_invalidation", 20);
  }
  if (conflictReport.severity === "high") {
    markMisaligned("candidate_conflict", 20);
  }

  const recommendations: string[] = [
    "H14 coherence는 planning 메타 정합성 힌트만 제공합니다. 실제 orchestration·enforcement 없음.",
    coherenceLevel === "aligned"
      ? "Planning 레이어 간 coherence는 관측 범위에서 정합합니다."
      : "불일치 영역을 H12–H13.5 섹션에서 교차 확인하세요.",
  ];

  if (alignmentFactors.length === 0 && coherenceLevel === "aligned") {
    alignmentFactors.push("교차 레이어 신호가 낮은 불일치로 관측됩니다.");
  }

  return {
    mode: "runtime_planning_coherence_summary",
    actualRuntimeOrchestrationEnabled: false,
    coherenceLevel,
    alignmentScore,
    misalignedAreas: [...new Set(misalignedAreas)].slice(0, 8),
    alignmentFactors: alignmentFactors.slice(0, 8),
    recommendations: recommendations.slice(0, 6),
  };
}

export function serializeRuntimePlanningCoherenceSummaryForDiagnostic(
  summary: RuntimePlanningCoherenceSummary
): Readonly<Record<string, unknown>> {
  return {
    mode: summary.mode,
    actualRuntimeOrchestrationEnabled: summary.actualRuntimeOrchestrationEnabled,
    coherenceLevel: summary.coherenceLevel,
    alignmentScore: summary.alignmentScore,
    misalignedAreas: [...summary.misalignedAreas],
    alignmentFactors: [...summary.alignmentFactors],
    recommendations: [...summary.recommendations],
  };
}
