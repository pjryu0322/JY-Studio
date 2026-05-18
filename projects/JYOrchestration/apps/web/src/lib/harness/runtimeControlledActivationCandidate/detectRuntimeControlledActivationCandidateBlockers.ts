/**
 * H41 — controlled activation candidate **blocker** 탐지(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeControlledActivationCandidate } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_ACTUAL_FLAGS_DISABLED } from "./runtimeControlledActivationCandidateConstants";
import { readControlledActivationUpstreamContext } from "./runtimeControlledActivationCandidateCheckHelpers";
import type { RuntimeControlledActivationCandidateBlockerReport } from "./runtimeControlledActivationCandidateTypes";

export function detectRuntimeControlledActivationCandidateBlockers(
  reports: RuntimeSemanticPlanningReportsBeforeControlledActivationCandidate
): RuntimeControlledActivationCandidateBlockerReport {
  const {
    ultimateFinalGate,
    ultimateVerification,
    ultimateAlignment,
    ultimateViolation,
    ultimateBlockers,
    finalGate,
    releaseFinalGate,
    approval,
    rollback,
    audit,
    control,
  } = readControlledActivationUpstreamContext(reports);

  const blockers: string[] = [];

  if (ultimateFinalGate.finalGateStatus === "blocked") {
    blockers.push("ultimate governance review final safety gate blocked");
  }
  if (ultimateFinalGate.h41EntryReadiness === "blocked") {
    blockers.push("h41 entry readiness blocked");
  }
  if (ultimateVerification.verificationStatus === "failed") {
    blockers.push("ultimate governance review verification failed");
  }
  if (ultimateAlignment.alignmentStatus === "failed") {
    blockers.push("ultimate governance review alignment failed");
  }
  if (ultimateViolation.actualFlagViolations.length > 0) {
    blockers.push(...ultimateViolation.actualFlagViolations.slice(0, 3));
  }
  if (ultimateViolation.proofViolations.length > 0) {
    blockers.push(...ultimateViolation.proofViolations.slice(0, 3));
  }
  if (ultimateBlockers.blockers.length > 0) {
    blockers.push(...ultimateBlockers.blockers.slice(0, 2));
  }
  if (finalGate.finalGateStatus === "blocked") {
    blockers.push("final release governance gate final safety gate blocked");
  }
  if (releaseFinalGate.finalGateStatus === "blocked") {
    blockers.push("governance release-readiness final gate blocked");
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
    mode: "runtime_controlled_activation_candidate_blocker_report",
    ...RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_ACTUAL_FLAGS_DISABLED,
    blockers: mergeSortedUniqueKo(blockers),
    recommendations: mergeSortedUniqueKo([
      ...(blockers.length > 0
        ? ["H41: controlled activation candidate blocker — ultimate governance·approval 정렬(activation 없음)"]
        : []),
    ]),
  };
}
