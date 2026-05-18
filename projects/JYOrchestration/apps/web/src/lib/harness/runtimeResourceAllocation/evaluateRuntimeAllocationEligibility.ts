/**
 * H21.5 — governance control boundary → **allocation eligibility** 매핑(read-only).
 */

import type { RuntimeResourceGovernanceMode } from "@/lib/harness/runtimeResourceGovernance/runtimeResourceGovernanceTypes";
import type { RuntimeSemanticPlanningReportsBeforeAllocation } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import type { RuntimeAllocationEligibilitySummary, RuntimeAllocationMode } from "./runtimeResourceAllocationTypes";

function boundaryToEffective(boundary: RuntimeResourceGovernanceMode): RuntimeAllocationMode {
  switch (boundary) {
    case "observe_only":
      return "not_needed";
    case "planning_only":
      return "planning_only";
    case "trial_candidate":
      return "dry_run_candidate";
    case "control_not_allowed":
      return "blocked_by_governance";
    default:
      return "not_needed";
  }
}

export function evaluateRuntimeAllocationEligibility(
  reports: RuntimeSemanticPlanningReportsBeforeAllocation
): RuntimeAllocationEligibilitySummary {
  const boundary = reports.runtimeResourceControlBoundary.boundary;
  const effective = boundaryToEffective(boundary);
  const gov = reports.runtimeResourceGovernanceSummary;

  const executionCandidateKo =
    effective === "blocked_by_governance"
      ? "실행 할당 후보 제외(control boundary; planning 메타만)"
      : effective === "not_needed"
        ? "실행 할당 불필요(observe 전용 신호)"
        : effective === "dry_run_candidate"
          ? "dry-run allocation 후보(실제 할당·토큰 적용 없음)"
          : "read-only allocation 권고 범위";

  const recommendations: string[] = [];
  if (gov.allocationReadiness === "allocation_planning_candidate") {
    recommendations.push("allocation planning candidate — operator review와 readiness를 확인하세요.");
  }
  if (gov.operatorReviewRequirement === "required") {
    recommendations.push("운영자 검토가 필요한 상태입니다. allocation 메타는 참고용으로만 사용하세요.");
  }
  if (gov.governanceRisk === "critical_candidate" || gov.governanceRisk === "elevated") {
    recommendations.push("governance risk가 높습니다. 슬롯·실행 후보는 메타상 보수적으로 유지하세요.");
  }
  recommendations.sort((a, b) => a.localeCompare(b, "ko"));

  return {
    mode: "runtime_allocation_eligibility_summary",
    actualRuntimeOrchestrationEnabled: false,
    actualResourceAllocationEnabled: false,
    effectiveAllocationMode: effective,
    governanceBoundaryLinkKo: `boundary=${boundary} — ${reports.runtimeResourceControlBoundary.rationaleKo}`,
    executionCandidateKo,
    recommendations,
  };
}
