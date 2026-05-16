/**
 * H22 — allocation plan ↔ **governance** 신호 비교(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeTrial } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import type { RuntimeResourceTrialGovernanceComparison } from "./runtimeResourceTrialTypes";

export function compareRuntimeAllocationPlanWithGovernance(
  reports: RuntimeSemanticPlanningReportsBeforeTrial
): RuntimeResourceTrialGovernanceComparison {
  const plan = reports.runtimeResourceAllocationPlan;
  const g = reports.runtimeResourceGovernanceSummary;
  const b = reports.runtimeResourceControlBoundary;

  const observations: string[] = [];
  let aligned = true;

  if (plan.globalAllocationMode === "dry_run_candidate" && b.boundary === "control_not_allowed") {
    observations.push("allocation dry_run_candidate인데 control boundary는 control_not_allowed — governance mismatch");
    aligned = false;
  }
  if (g.operatorReviewRequirement === "required" && plan.globalAllocationMode === "dry_run_candidate") {
    observations.push("operator review required — dry_run_candidate allocation은 watch·검토 경로 권장");
    aligned = false;
  }
  if (observations.length === 0) {
    observations.push("governance boundary·mode와 allocation plan 간 명백한 불일치 없음(메타)");
  }
  observations.sort((a, b) => a.localeCompare(b, "ko"));

  return {
    mode: "runtime_allocation_governance_comparison",
    actualRuntimeOrchestrationEnabled: false,
    actualResourceAllocationEnabled: false,
    actualTrialExecutionEnabled: false,
    governanceModeKo: `governanceMode=${g.governanceMode}`,
    boundaryKo: `boundary=${b.boundary}`,
    operatorReviewKo: `operatorReview=${g.operatorReviewRequirement}`,
    allocationReadinessKo: `allocationReadiness=${g.allocationReadiness}`,
    aligned,
    observations,
  };
}
