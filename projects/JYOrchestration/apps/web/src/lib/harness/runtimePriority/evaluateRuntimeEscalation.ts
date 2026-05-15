/**
 * H12.5 — runtime planning **escalation** 판단(read-only).
 */

import type { RuntimeStabilityPlanningReports } from "@/lib/harness/runtimeStability/buildRuntimeStabilityPlanningReports";
import type { RuntimeEscalationLevel, RuntimeEscalationSummary } from "./runtimePriorityTypes";
import type { RuntimePlanningDependencyReport } from "./runtimePriorityTypes";

export function evaluateRuntimeEscalation(input: {
  readonly stabilityReports: RuntimeStabilityPlanningReports;
  readonly dependencyReport: RuntimePlanningDependencyReport;
  readonly messageExplainabilityAvailable: boolean;
  readonly userVisibleSummaryReady: boolean;
}): RuntimeEscalationSummary {
  const reasons: string[] = [];
  const criticalAreas: string[] = [];
  let level: RuntimeEscalationLevel = "none";

  const bump = (next: RuntimeEscalationLevel) => {
    const order: RuntimeEscalationLevel[] = ["none", "watch", "escalated", "critical"];
    if (order.indexOf(next) > order.indexOf(level)) level = next;
  };

  if (input.stabilityReports.saturationSummary.saturationLevel === "high") {
    reasons.push("Planning saturation이 높습니다.");
    criticalAreas.push("saturation");
    bump("escalated");
  } else if (input.stabilityReports.saturationSummary.saturationLevel === "medium") {
    reasons.push("Planning saturation이 중간 수준입니다.");
    bump("watch");
  }

  if (
    input.stabilityReports.stabilitySummary.stabilityLevel === "unstable" ||
    input.stabilityReports.stabilitySummary.stabilityLevel === "elevated"
  ) {
    reasons.push(`Runtime stability ${input.stabilityReports.stabilitySummary.stabilityLevel}.`);
    criticalAreas.push("stability");
    bump(input.stabilityReports.stabilitySummary.stabilityLevel === "unstable" ? "critical" : "escalated");
  }

  if (input.stabilityReports.controlledGovernance.governanceMode === "planning_only") {
    const govConditions =
      input.stabilityReports.controlledGovernance.requiredGovernanceConditions.length +
      input.stabilityReports.controlledGovernance.requiredRollbackConditions.length;
    if (govConditions >= 8) {
      reasons.push("Governance dependency 조건이 과다합니다.");
      criticalAreas.push("governance_overload");
      bump("escalated");
    }
  }

  if (!input.messageExplainabilityAvailable || !input.userVisibleSummaryReady) {
    reasons.push("Explainability·사용자 요약 경로 불안정.");
    criticalAreas.push("explainability");
    bump("escalated");
  }

  if (input.stabilityReports.conflictReport.severity === "high") {
    reasons.push("후보 충돌 심각도가 높습니다.");
    criticalAreas.push("candidate_conflict");
    bump("critical");
  } else if (input.stabilityReports.conflictReport.severity === "medium") {
    bump("watch");
  }

  if (input.stabilityReports.overlayOverload.overlayOverloadRisk === "high") {
    reasons.push("Overlay 과밀 위험이 높습니다.");
    criticalAreas.push("overlay_overload");
    bump("escalated");
  }

  if (input.dependencyReport.dependencyCycles.length > 0) {
    reasons.push("Dependency ordering 순환 신호.");
    criticalAreas.push("dependency_cycle");
    bump("escalated");
  }

  if (reasons.length === 0) {
    reasons.push("관측 범위에서 escalation 신호는 낮습니다(실제 orchestration 없음).");
  }

  const escalationOrder: RuntimeEscalationLevel[] = ["none", "watch", "escalated", "critical"];
  const operatorAttentionRequired =
    escalationOrder.indexOf(level) >= escalationOrder.indexOf("escalated") ||
    input.dependencyReport.criticalDependencies.length > 0;

  return {
    mode: "runtime_escalation_summary",
    actualRuntimeOrchestrationEnabled: false,
    escalationLevel: level,
    escalationReasons: reasons.slice(0, 10),
    criticalAreas: [...new Set(criticalAreas)].slice(0, 8),
    operatorAttentionRequired,
  };
}

export function serializeRuntimeEscalationSummaryForDiagnostic(
  summary: RuntimeEscalationSummary
): Readonly<Record<string, unknown>> {
  return {
    mode: summary.mode,
    actualRuntimeOrchestrationEnabled: summary.actualRuntimeOrchestrationEnabled,
    escalationLevel: summary.escalationLevel,
    escalationReasons: [...summary.escalationReasons],
    criticalAreas: [...summary.criticalAreas],
    operatorAttentionRequired: summary.operatorAttentionRequired,
  };
}
