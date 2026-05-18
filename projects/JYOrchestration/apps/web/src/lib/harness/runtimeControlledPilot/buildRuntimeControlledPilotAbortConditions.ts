/**
 * H24 — Pilot **abort condition** 메타(read-only; 실제 중단 실행 없음).
 */

import type { RuntimeSemanticPlanningReportsBeforeControlledPilot } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeControlledPilotAbortConditions } from "./runtimeControlledPilotTypes";

export function buildRuntimeControlledPilotAbortConditions(
  reports: RuntimeSemanticPlanningReportsBeforeControlledPilot
): RuntimeControlledPilotAbortConditions {
  const ecs = reports.runtimeExecutionCandidateSummary;
  const b = reports.runtimeControlBoundarySummary;
  const v = reports.runtimeControlBoundaryViolationReport;
  const a = reports.runtimeOperatorApprovalSummary;
  const r = reports.runtimeRollbackReadinessSummary;
  const u = reports.runtimeAuditReadinessSummary;

  const abortConditions: string[] = [];

  if (b.boundaryRisk === "violation_candidate" || b.boundaryRisk === "blocked") {
    abortConditions.push("boundary violation·blocked 후보 감지 시 pilot 메타 중단(실행 아님)");
  }
  if (v.actualFlagViolations.length > 0) {
    abortConditions.push("actual* 플래그 true 위반 후보 시 pilot 메타 중단(실행 아님)");
  }
  if (ecs.candidateStatus === "blocked") {
    abortConditions.push("execution candidate blocked 시 pilot 후보 메타 중단(실행 아님)");
  }
  if (a.approvalReadiness === "blocked") {
    abortConditions.push("approval readiness blocked 시 pilot 후보 메타 중단(실행 아님)");
  }
  if (r.rollbackReadiness === "blocked") {
    abortConditions.push("rollback readiness blocked 시 pilot 후보 메타 중단(실행 아님)");
  }
  if (u.auditReadiness === "blocked") {
    abortConditions.push("audit readiness blocked 시 pilot 후보 메타 중단(실행 아님)");
  }
  if (abortConditions.length === 0) {
    abortConditions.push("현재 abort 메타 트리거 없음 — 여전히 actual pilot 실행 없음");
  }

  const recommendations = mergeSortedUniqueKo([
    ...ecs.recommendations,
    "abort 조건은 메타 설명만 — 런타임 kill·merge 차단 없음",
  ]);

  return {
    mode: "runtime_controlled_pilot_abort_conditions",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    abortConditions: mergeSortedUniqueKo(abortConditions),
    recommendations,
  };
}
