/**
 * H45 — controlled pilot execution candidate **blocker** 탐지(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeControlledPilotExecutionCandidate } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_ACTUAL_FLAGS_DISABLED } from "./runtimeControlledPilotExecutionCandidateConstants";
import { readControlledPilotExecutionUpstreamContext } from "./runtimeControlledPilotExecutionCandidateCheckHelpers";
import type { RuntimeControlledPilotExecutionCandidateBlockerReport } from "./runtimeControlledPilotExecutionCandidateTypes";

export function detectRuntimeControlledPilotExecutionCandidateBlockers(
  reports: RuntimeSemanticPlanningReportsBeforeControlledPilotExecutionCandidate
): RuntimeControlledPilotExecutionCandidateBlockerReport {
  const {
    executionFinalGate,
    executionVerification,
    executionAlignment,
    executionViolation,
    executionBlockers,
    reviewFinalGate,
    pilotBoundaryFinalGate,
    approval,
    rollback,
    audit,
    control,
  } = readControlledPilotExecutionUpstreamContext(reports);

  const blockers: string[] = [];

  if (executionFinalGate.finalGateStatus === "blocked") {
    blockers.push("pilot execution readiness final safety gate blocked");
  }
  if (executionFinalGate.h45EntryReadiness === "blocked") {
    blockers.push("h45 entry readiness blocked");
  }
  if (executionVerification.verificationStatus === "failed") {
    blockers.push("pilot execution readiness verification failed");
  }
  if (executionAlignment.alignmentStatus === "failed") {
    blockers.push("pilot execution readiness alignment failed");
  }
  if (executionViolation.actualFlagViolations.length > 0) {
    blockers.push(...executionViolation.actualFlagViolations.slice(0, 3));
  }
  if (executionViolation.proofViolations.length > 0) {
    blockers.push(...executionViolation.proofViolations.slice(0, 3));
  }
  if (executionViolation.forbiddenProofViolations.length > 0) {
    blockers.push(...executionViolation.forbiddenProofViolations.slice(0, 3));
  }
  if (executionBlockers.blockers.length > 0) {
    blockers.push(...executionBlockers.blockers.slice(0, 2));
  }
  if (reviewFinalGate.finalGateStatus === "blocked") {
    blockers.push("limited pilot readiness review final safety gate blocked");
  }
  if (pilotBoundaryFinalGate.finalGateStatus === "blocked") {
    blockers.push("limited pilot boundary final safety gate blocked");
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
    mode: "runtime_controlled_pilot_execution_candidate_blocker_report",
    ...RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_ACTUAL_FLAGS_DISABLED,
    blockers: mergeSortedUniqueKo(blockers),
    recommendations: mergeSortedUniqueKo([
      ...(blockers.length > 0
        ? [
            "H45: controlled pilot execution candidate blocker — pilot execution readiness·approval 정렬(pilot activation·execution 없음)",
          ]
        : []),
    ]),
  };
}
