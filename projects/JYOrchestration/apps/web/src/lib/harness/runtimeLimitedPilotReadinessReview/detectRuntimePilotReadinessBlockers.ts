/**
 * H43 — pilot readiness review **blocker** 탐지(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeLimitedPilotReadinessReview } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { RUNTIME_LIMITED_PILOT_READINESS_REVIEW_ACTUAL_FLAGS_DISABLED } from "./runtimeLimitedPilotReadinessReviewConstants";
import { readLimitedPilotReadinessUpstreamContext } from "./runtimeLimitedPilotReadinessReviewCheckHelpers";
import type { RuntimePilotReadinessBlockerReport } from "./runtimeLimitedPilotReadinessReviewTypes";

export function detectRuntimePilotReadinessBlockers(
  reports: RuntimeSemanticPlanningReportsBeforeLimitedPilotReadinessReview
): RuntimePilotReadinessBlockerReport {
  const {
    pilotBoundaryFinalGate,
    pilotBoundaryVerification,
    pilotBoundaryAlignment,
    pilotBoundaryViolation,
    pilotBoundaryBlockers,
    activationFinalGate,
    ultimateFinalGate,
    approval,
    rollback,
    audit,
    control,
  } = readLimitedPilotReadinessUpstreamContext(reports);

  const blockers: string[] = [];

  if (pilotBoundaryFinalGate.finalGateStatus === "blocked") {
    blockers.push("limited pilot boundary final safety gate blocked");
  }
  if (pilotBoundaryFinalGate.h43EntryReadiness === "blocked") {
    blockers.push("h43 entry readiness blocked");
  }
  if (pilotBoundaryVerification.verificationStatus === "failed") {
    blockers.push("limited pilot boundary verification failed");
  }
  if (pilotBoundaryAlignment.alignmentStatus === "failed") {
    blockers.push("limited pilot boundary alignment failed");
  }
  if (pilotBoundaryViolation.actualFlagViolations.length > 0) {
    blockers.push(...pilotBoundaryViolation.actualFlagViolations.slice(0, 3));
  }
  if (pilotBoundaryViolation.policyViolations.length > 0) {
    blockers.push(...pilotBoundaryViolation.policyViolations.slice(0, 3));
  }
  if (pilotBoundaryBlockers.blockers.length > 0) {
    blockers.push(...pilotBoundaryBlockers.blockers.slice(0, 2));
  }
  if (activationFinalGate.finalGateStatus === "blocked") {
    blockers.push("controlled activation candidate final safety gate blocked");
  }
  if (ultimateFinalGate.finalGateStatus === "blocked") {
    blockers.push("ultimate governance review final safety gate blocked");
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
    mode: "runtime_pilot_readiness_blocker_report",
    ...RUNTIME_LIMITED_PILOT_READINESS_REVIEW_ACTUAL_FLAGS_DISABLED,
    blockers: mergeSortedUniqueKo(blockers),
    recommendations: mergeSortedUniqueKo([
      ...(blockers.length > 0
        ? ["H43: pilot readiness blocker — limited pilot boundary·approval 정렬(pilot activation·execution 없음)"]
        : []),
    ]),
  };
}
