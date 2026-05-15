/**
 * H13.5 — planning **freshness** 평가(read-only).
 */

import type { RuntimePriorityPlanningReports } from "@/lib/harness/runtimePriority/buildRuntimePriorityPlanningReports";
import type { RuntimeStabilityPlanningReports } from "@/lib/harness/runtimeStability/buildRuntimeStabilityPlanningReports";
import type {
  RuntimePlanningFreshness,
  RuntimePlanningFreshnessSummary,
  RuntimePlanningLifecycleState,
} from "./runtimeLifecycleTypes";

export function evaluateRuntimePlanningFreshness(input: {
  readonly stabilityReports: RuntimeStabilityPlanningReports;
  readonly priorityReports: RuntimePriorityPlanningReports;
}): RuntimePlanningFreshnessSummary {
  const agingFactors: string[] = [];
  const staleFactors: string[] = [];
  let freshnessLevel: RuntimePlanningFreshness = "fresh";

  const { stabilitySummary, saturationSummary, conflictReport } = input.stabilityReports;
  const { escalationSummary, dependencyReport } = input.priorityReports;

  if (saturationSummary.saturationLevel === "medium") {
    agingFactors.push("Planning saturation이 중간 수준입니다.");
    freshnessLevel = "aging";
  }
  if (stabilitySummary.stabilityLevel === "watch" || stabilitySummary.stabilityLevel === "elevated") {
    agingFactors.push(`Stability ${stabilitySummary.stabilityLevel}.`);
    freshnessLevel = "aging";
  }
  if (escalationSummary.escalationLevel === "watch") {
    agingFactors.push("Escalation 주시 단계입니다.");
    if (freshnessLevel === "fresh") freshnessLevel = "aging";
  }

  if (
    saturationSummary.saturationLevel === "high" ||
    stabilitySummary.stabilityLevel === "unstable" ||
    conflictReport.severity === "high"
  ) {
    staleFactors.push("Saturation·stability·충돌 신호가 planning freshness를 저하합니다.");
    freshnessLevel = "stale";
  }
  if (escalationSummary.escalationLevel === "escalated" || escalationSummary.escalationLevel === "critical") {
    staleFactors.push(`Escalation ${escalationSummary.escalationLevel}.`);
    freshnessLevel = "stale";
  }
  if (dependencyReport.dependencyCycles.length > 0) {
    staleFactors.push("Dependency ordering 순환 신호.");
    freshnessLevel = "stale";
  }

  let lifecycleState: RuntimePlanningLifecycleState = "active";
  if (freshnessLevel === "aging") lifecycleState = "watch";
  if (freshnessLevel === "stale") lifecycleState = "stale";

  const recommendations: string[] = [
    "H13.5 freshness는 planning 메타만 갱신합니다. 실제 orchestration·enforcement 없음.",
    freshnessLevel === "fresh"
      ? "현재 planning 메타는 신선하게 유지됩니다."
      : "오래된 planning 후보는 재평가·문서 갱신만 권장합니다.",
  ];

  if (agingFactors.length === 0 && freshnessLevel === "fresh") {
    agingFactors.push("관측 범위에서 aging 신호는 낮습니다.");
  }

  return {
    mode: "runtime_planning_freshness_summary",
    actualRuntimeOrchestrationEnabled: false,
    freshnessLevel,
    lifecycleState,
    agingFactors: agingFactors.slice(0, 8),
    staleFactors: staleFactors.slice(0, 8),
    recommendations: recommendations.slice(0, 6),
  };
}

export function serializeRuntimePlanningFreshnessSummaryForDiagnostic(
  summary: RuntimePlanningFreshnessSummary
): Readonly<Record<string, unknown>> {
  return {
    mode: summary.mode,
    actualRuntimeOrchestrationEnabled: summary.actualRuntimeOrchestrationEnabled,
    freshnessLevel: summary.freshnessLevel,
    lifecycleState: summary.lifecycleState,
    agingFactors: [...summary.agingFactors],
    staleFactors: [...summary.staleFactors],
    recommendations: [...summary.recommendations],
  };
}
