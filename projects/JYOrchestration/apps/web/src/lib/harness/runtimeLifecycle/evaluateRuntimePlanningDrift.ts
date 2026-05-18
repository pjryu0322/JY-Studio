/**
 * H13.5 — planning **drift** 평가(read-only).
 */

import type { RuntimeGovernancePlanningContext } from "@/lib/harness/runtimeGovernance/buildRuntimeGovernancePlanningContext";
import type { RuntimePriorityPlanningReports } from "@/lib/harness/runtimePriority/buildRuntimePriorityPlanningReports";
import type { RuntimeStabilityPlanningReports } from "@/lib/harness/runtimeStability/buildRuntimeStabilityPlanningReports";
import type { RuntimePlanningDriftReport, RuntimePlanningDriftSeverity } from "./runtimeLifecycleTypes";

export function evaluateRuntimePlanningDrift(input: {
  readonly governanceCtx: RuntimeGovernancePlanningContext;
  readonly stabilityReports: RuntimeStabilityPlanningReports;
  readonly priorityReports: RuntimePriorityPlanningReports;
}): RuntimePlanningDriftReport {
  const driftAreas: string[] = [];
  const driftReasons: string[] = [];
  let driftSeverity: RuntimePlanningDriftSeverity = "low";

  const bump = (next: RuntimePlanningDriftSeverity) => {
    const order: RuntimePlanningDriftSeverity[] = ["low", "medium", "high"];
    if (order.indexOf(next) > order.indexOf(driftSeverity)) driftSeverity = next;
  };

  const { governance } = input.governanceCtx;

  if (governance.governanceRisk === "high" || governance.governanceRisk === "medium") {
    driftAreas.push("governance");
    driftReasons.push(`거버넌스 리스크 ${governance.governanceRisk}와 planning 메타 불일치 가능.`);
    bump(governance.governanceRisk === "high" ? "high" : "medium");
  }

  if (input.stabilityReports.stabilitySummary.stabilityLevel !== "stable") {
    driftAreas.push("stability");
    driftReasons.push(`Stability ${input.stabilityReports.stabilitySummary.stabilityLevel} drift.`);
    bump(
      input.stabilityReports.stabilitySummary.stabilityLevel === "unstable"
        ? "high"
        : "medium"
    );
  }

  if (input.priorityReports.dependencyReport.dependencyCycles.length > 0) {
    driftAreas.push("dependency_ordering");
    driftReasons.push("Dependency ordering 순환 — planning drift 신호.");
    bump("high");
  }

  if (input.priorityReports.escalationSummary.criticalAreas.length >= 2) {
    driftAreas.push("escalation");
    driftReasons.push("다수 critical area escalation.");
    bump("medium");
  }

  if (input.stabilityReports.saturationSummary.saturationLevel === "high") {
    driftAreas.push("saturation");
    driftReasons.push("Planning saturation과 lifecycle freshness drift.");
    bump("high");
  }

  const recommendations: string[] = ["Drift는 planning 문서·메타 정합성 힌트만 제공합니다."];
  if (driftSeverity !== "low") {
    if (driftSeverity === "high") {
      recommendations.push(
        "높은 drift — H10–H12.5 섹션을 재검토하고 stale 후보를 planning_only로 유지하세요."
      );
    } else {
      recommendations.push("중간 drift — dependency·escalation 메타를 확인하세요.");
    }
  } else {
    recommendations.push("주기적으로 freshness·invalidation 메타를 확인하세요.");
  }

  if (driftAreas.length === 0) {
    driftReasons.push("관측 범위에서 planning drift는 낮습니다.");
  }

  return {
    mode: "runtime_planning_drift_report",
    actualRuntimeOrchestrationEnabled: false,
    driftAreas: [...new Set(driftAreas)].slice(0, 8),
    driftSeverity,
    driftReasons: driftReasons.slice(0, 10),
    recommendations: recommendations.slice(0, 6),
  };
}

export function serializeRuntimePlanningDriftReportForDiagnostic(
  report: RuntimePlanningDriftReport
): Readonly<Record<string, unknown>> {
  return {
    mode: report.mode,
    actualRuntimeOrchestrationEnabled: report.actualRuntimeOrchestrationEnabled,
    driftAreas: [...report.driftAreas],
    driftSeverity: report.driftSeverity,
    driftReasons: [...report.driftReasons],
    recommendations: [...report.recommendations],
  };
}
