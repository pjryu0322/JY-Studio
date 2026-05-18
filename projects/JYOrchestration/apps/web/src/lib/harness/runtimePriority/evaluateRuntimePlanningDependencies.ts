/**
 * H12.5 — planning **dependency ordering** 분석(read-only).
 */

import type { HarnessMaturityBaselineReport } from "@/lib/harness/maturity/harnessMaturityTypes";
import type { RuntimeGovernancePlanningContext } from "@/lib/harness/runtimeGovernance/buildRuntimeGovernancePlanningContext";
import type { RuntimeStabilityPlanningReports } from "@/lib/harness/runtimeStability/buildRuntimeStabilityPlanningReports";
import { evaluateResourcePressure } from "@/lib/harness/resourceStabilization/evaluateResourcePressure";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import type {
  PlanningDependencyKind,
  PlanningDependencyRow,
  PlanningDependencyStatus,
  RuntimePlanningDependencyReport,
  RuntimePlanningPriority,
} from "./runtimePriorityTypes";

function row(
  kind: PlanningDependencyKind,
  labelKo: string,
  priority: RuntimePlanningPriority,
  status: PlanningDependencyStatus,
  noteKo: string
): PlanningDependencyRow {
  return { kind, labelKo, priority, status, noteKo };
}

export function evaluateRuntimePlanningDependencies(input: {
  readonly baseline: HarnessMaturityBaselineReport;
  readonly governanceCtx: RuntimeGovernancePlanningContext;
  readonly stabilityReports: RuntimeStabilityPlanningReports;
  readonly extract: ExtractedOverlayPromptTraceMetadata | null | undefined;
  readonly messageExplainabilityAvailable: boolean;
}): RuntimePlanningDependencyReport {
  const { governance, rollbackSafety } = input.governanceCtx;
  const pressure = evaluateResourcePressure(input.extract);
  const ordered: PlanningDependencyRow[] = [];
  const blocked: string[] = [];
  const critical: string[] = [];
  const cycles: string[] = [];

  const govPriority: RuntimePlanningPriority =
    governance.governanceRisk === "high"
      ? "critical"
      : governance.governanceRisk === "medium"
        ? "high"
        : "medium";
  ordered.push(
    row(
      "governance",
      "거버넌스 dependency",
      govPriority,
      input.stabilityReports.controlledGovernance.governanceReadinessEligible ? "ordered" : "blocked",
      `승인 ${governance.approvalMode}, 운영 검토 ${governance.operatorReviewReadiness}.`
    )
  );
  if (!input.stabilityReports.controlledGovernance.governanceReadinessEligible) {
    blocked.push("governance:readiness_not_eligible");
  }

  const explainOk = input.messageExplainabilityAvailable && input.baseline.userVisibleSummaryReady;
  ordered.push(
    row(
      "explainability",
      "Explainability dependency",
      explainOk ? "medium" : "high",
      explainOk ? "ordered" : "critical",
      explainOk ? "사용자 explainability 경로 사용 가능." : "Explainability 불안정 — 후보 ordering 신뢰 저하."
    )
  );
  if (!explainOk) critical.push("explainability:unstable");

  const rbPriority: RuntimePlanningPriority =
    rollbackSafety.rollbackRisk === "high" ? "critical" : rollbackSafety.rollbackRisk === "watch" ? "high" : "medium";
  ordered.push(
    row(
      "rollback",
      "롤백 dependency",
      rbPriority,
      rollbackSafety.rollbackRisk === "high" ? "critical" : "ordered",
      `롤백 안전 ${rollbackSafety.rollbackRisk}; readiness ${governance.rollbackReadiness}.`
    )
  );

  const resPriority: RuntimePlanningPriority =
    pressure.pressureSeverity === "critical" || pressure.pressureSeverity === "high"
      ? "critical"
      : pressure.pressureSeverity === "elevated"
        ? "high"
        : "low";
  ordered.push(
    row(
      "resource",
      "자원 dependency",
      resPriority,
      pressure.pressureSeverity === "critical" ? "blocked" : "ordered",
      `자원 압력 ${pressure.pressureSeverity}(planning-only).`
    )
  );

  const reviewCount =
    (input.extract?.reviewSecurityHarnessPlan?.checklist?.length ?? 0) +
    (input.extract?.reviewSecurityIssuePlanningReport?.issues?.length ?? 0);
  ordered.push(
    row(
      "review_security",
      "Review/Security dependency",
      reviewCount >= 10 ? "high" : reviewCount >= 6 ? "medium" : "low",
      reviewCount >= 12 ? "critical" : "ordered",
      `Review/Security planning 블록 ${reviewCount}건.`
    )
  );

  for (const dep of input.stabilityReports.dependencyPlanning.rows) {
    if (dep.rollbackDependency === "required" && rollbackSafety.rollbackRisk === "high") {
      cycles.push(`governance_dependency:${dep.kind}↔rollback_safety:high`);
    }
  }
  if (
    govPriority === "critical" &&
    rbPriority === "critical" &&
    !input.stabilityReports.controlledGovernance.governanceReadinessEligible
  ) {
    cycles.push("governance_critical↔rollback_critical_while_governance_blocked");
  }

  for (const c of input.stabilityReports.stabilitySummary.criticalDependencies) {
    if (!critical.includes(c)) critical.push(c);
  }

  const recommendations: string[] = [
    "H12.5 dependency ordering은 planning 메타만 정의합니다. 실제 orchestration·라우팅 없음.",
    "critical dependency는 governance → rollback → explainability → resource → review 순으로 문서화하세요.",
  ];
  if (cycles.length > 0) {
    recommendations.unshift("의존성 순환 신호가 있습니다 — 후보 동시 활성화를 planning에서 분리하세요.");
  }

  return {
    mode: "runtime_planning_dependency_report",
    actualRuntimeOrchestrationEnabled: false,
    orderedDependencies: ordered,
    blockedDependencies: [...new Set(blocked)].slice(0, 10),
    criticalDependencies: critical.slice(0, 10),
    dependencyCycles: cycles.slice(0, 8),
    recommendations: recommendations.slice(0, 8),
  };
}

export function serializeRuntimePlanningDependencyReportForDiagnostic(
  report: RuntimePlanningDependencyReport
): Readonly<Record<string, unknown>> {
  return {
    mode: report.mode,
    actualRuntimeOrchestrationEnabled: report.actualRuntimeOrchestrationEnabled,
    orderedDependencies: report.orderedDependencies.map((d) => ({
      kind: d.kind,
      labelKo: d.labelKo,
      priority: d.priority,
      status: d.status,
      noteKo: d.noteKo,
    })),
    blockedDependencies: [...report.blockedDependencies],
    criticalDependencies: [...report.criticalDependencies],
    dependencyCycles: [...report.dependencyCycles],
    recommendations: [...report.recommendations],
  };
}
