/**
 * H40 — ultimate governance review **blocker** 탐지(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeUltimateGovernanceReview } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_ACTUAL_FLAGS_DISABLED } from "./runtimeUltimateGovernanceReviewConstants";
import { readUltimateGovernanceUpstreamContext } from "./runtimeUltimateGovernanceReviewCheckHelpers";
import type { RuntimeUltimateGovernanceBlockerReport } from "./runtimeUltimateGovernanceReviewTypes";

export function detectRuntimeUltimateGovernanceBlockers(
  reports: RuntimeSemanticPlanningReportsBeforeUltimateGovernanceReview
): RuntimeUltimateGovernanceBlockerReport {
  const upstream = readUltimateGovernanceUpstreamContext(reports);
  const {
    finalGate,
    finalVerification,
    finalAlignment,
    finalViolation,
    finalBlockers,
    finalSummary,
    releaseFinalGate,
    governanceFinalGate,
    approval,
    rollback,
    audit,
    control,
  } = upstream;

  const blockers: string[] = [];

  if (finalGate.finalGateStatus === "blocked") {
    blockers.push("final release governance gate final safety gate blocked");
  }
  if (finalGate.h40EntryReadiness === "blocked") {
    blockers.push("h40 entry readiness blocked");
  }
  if (finalVerification.verificationStatus === "failed") {
    blockers.push("final release governance gate verification failed");
  }
  if (finalAlignment.alignmentStatus === "failed") {
    blockers.push("final release governance gate alignment failed");
  }
  if (finalViolation.actualFlagViolations.length > 0) {
    blockers.push(...finalViolation.actualFlagViolations.slice(0, 3));
  }
  if (finalBlockers.blockers.length > 0) {
    blockers.push(...finalBlockers.blockers.slice(0, 2));
  }
  if (finalSummary.gateBlockers.length > 0) {
    blockers.push(...finalSummary.gateBlockers.slice(0, 2));
  }
  if (releaseFinalGate.finalGateStatus === "blocked") {
    blockers.push("governance release-readiness final gate blocked");
  }
  if (governanceFinalGate.finalGateStatus === "blocked") {
    blockers.push("execution governance boundary final gate blocked");
  }
  if (approval.approvalReadiness === "blocked") {
    blockers.push("operator approval blocked");
  }
  if (rollback.rollbackReadiness === "blocked") {
    blockers.push("rollback readiness blocked");
  }
  if (audit.auditReadiness === "blocked") {
    blockers.push("audit readiness blocked");
  }
  if (control.boundaryRisk === "blocked") {
    blockers.push("control boundary blocked");
  }

  return {
    mode: "runtime_ultimate_governance_blocker_report",
    ...RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_ACTUAL_FLAGS_DISABLED,
    blockers: mergeSortedUniqueKo(blockers),
    recommendations: mergeSortedUniqueKo([
      ...(blockers.length > 0
        ? ["H40: ultimate governance blocker — final gate·approval 정렬(orchestration 없음)"]
        : []),
    ]),
  };
}
