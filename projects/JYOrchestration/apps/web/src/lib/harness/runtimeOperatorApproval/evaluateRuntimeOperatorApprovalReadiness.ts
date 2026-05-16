/**
 * H23.5 — Operator **approval readiness** 메타(read-only; 실제 승인 집행 없음).
 */

import type { RuntimeSemanticPlanningReportsBeforeOperatorApproval } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeOperatorApprovalReadiness, RuntimeOperatorApprovalSummary } from "./runtimeOperatorApprovalTypes";

export function evaluateRuntimeOperatorApprovalReadiness(
  reports: RuntimeSemanticPlanningReportsBeforeOperatorApproval
): RuntimeOperatorApprovalSummary {
  const ecs = reports.runtimeExecutionCandidateSummary;
  const gov = reports.runtimeResourceGovernanceSummary;
  const b = reports.runtimeControlBoundarySummary;

  let approvalReadiness: RuntimeOperatorApprovalReadiness;
  if (ecs.candidateStatus === "blocked" || b.boundaryRisk === "blocked") {
    approvalReadiness = "blocked";
  } else if (ecs.candidateStatus === "operator_review_required" || gov.operatorReviewRequirement === "required") {
    approvalReadiness = "review_required";
  } else if (ecs.candidateStatus === "metadata_candidate" || gov.operatorReviewRequirement === "recommended") {
    approvalReadiness = "ready_for_review_metadata";
  } else {
    approvalReadiness = "not_required";
  }

  const govReviewExtras =
    gov.operatorReviewRequirement === "required"
      ? ["resource governance operator review 필수 메타(실제 승인 아님)"]
      : gov.operatorReviewRequirement === "recommended"
        ? ["resource governance operator review 권장 메타(실제 승인 아님)"]
        : [];

  const requiredReviewItems = mergeSortedUniqueKo([...ecs.requiredApprovals, ...govReviewExtras]);

  const approvalBlockers = mergeSortedUniqueKo([
    ...ecs.candidateBlockers,
    ...(b.boundaryRisk === "blocked" ? ["control boundary risk blocked(메타)"] : []),
  ]);

  const recommendations = mergeSortedUniqueKo([
    ...ecs.recommendations,
    ...(approvalReadiness === "blocked"
      ? ["승인 준비 메타 차단 — trial·boundary·governance 메타 재검토"]
      : []),
    ...(approvalReadiness === "review_required"
      ? ["운영자 검토 메타만 — 실제 승인·routing·실행 경로 없음"]
      : []),
  ]);

  return {
    mode: "runtime_operator_approval_summary",
    actualRuntimeOrchestrationEnabled: false,
    actualApprovalEnforcementEnabled: false,
    actualRollbackExecutionEnabled: false,
    approvalReadiness,
    requiredReviewItems,
    approvalBlockers,
    recommendations,
  };
}
