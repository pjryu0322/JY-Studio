/**
 * H23.5 — **Pilot precondition** 요약 메타(read-only; pilot 실행 없음).
 */

import type { RuntimeSemanticPlanningReportsBeforeOperatorApproval } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeAuditReadiness,
  RuntimeOperatorApprovalReadiness,
  RuntimePilotPreconditionReadiness,
  RuntimePilotPreconditionSummary,
  RuntimeRollbackReadiness,
} from "./runtimeOperatorApprovalTypes";

export function buildRuntimePilotPreconditionSummary(
  reports: RuntimeSemanticPlanningReportsBeforeOperatorApproval,
  input: Readonly<{
    approvalReadiness: RuntimeOperatorApprovalReadiness;
    rollbackReadiness: RuntimeRollbackReadiness;
    auditReadiness: RuntimeAuditReadiness;
  }>
): RuntimePilotPreconditionSummary {
  const ecs = reports.runtimeExecutionCandidateSummary;
  const b = reports.runtimeControlBoundarySummary;

  const { approvalReadiness, rollbackReadiness, auditReadiness } = input;

  let pilotPreconditionReadiness: RuntimePilotPreconditionReadiness;
  if (
    approvalReadiness === "blocked" ||
    rollbackReadiness === "blocked" ||
    auditReadiness === "blocked"
  ) {
    pilotPreconditionReadiness = "blocked";
  } else if (
    approvalReadiness === "review_required" ||
    rollbackReadiness === "metadata_watch" ||
    auditReadiness === "watch" ||
    ecs.candidateRisk === "elevated"
  ) {
    pilotPreconditionReadiness = "watch";
  } else if (
    (approvalReadiness === "ready_for_review_metadata" || approvalReadiness === "not_required") &&
    (rollbackReadiness === "metadata_ready" || rollbackReadiness === "not_applicable") &&
    (auditReadiness === "sufficient_metadata" || auditReadiness === "minimal")
  ) {
    pilotPreconditionReadiness = "metadata_only";
  } else {
    pilotPreconditionReadiness = "not_ready";
  }

  const actualControlForbiddenMaintained =
    b.boundaryLevel === "actual_control_forbidden" || b.boundaryRisk === "blocked";

  const preconditionNotes = mergeSortedUniqueKo([
    "runtime pilot·actual control·rollback 실행 없음 — 메타 전제만 평가",
    ...(pilotPreconditionReadiness === "watch" ? ["전제 메타 주시 — 승인·rollback·감사 신호 확인"] : []),
  ]);

  const recommendations = mergeSortedUniqueKo([
    ...reports.runtimeExecutionCandidateSummary.recommendations,
    ...(pilotPreconditionReadiness === "not_ready" ? ["파일럿 전제 메타 미충족 — H23 이전 단계 재확인"] : []),
  ]);

  return {
    mode: "runtime_pilot_precondition_summary",
    actualRuntimeOrchestrationEnabled: false,
    actualApprovalEnforcementEnabled: false,
    actualRollbackExecutionEnabled: false,
    pilotPreconditionReadiness,
    approvalReadiness,
    rollbackReadiness,
    auditReadiness,
    executionCandidateStatus: ecs.candidateStatus,
    controlBoundaryLevel: b.boundaryLevel,
    actualControlForbiddenMaintained,
    preconditionNotes,
    recommendations,
  };
}
