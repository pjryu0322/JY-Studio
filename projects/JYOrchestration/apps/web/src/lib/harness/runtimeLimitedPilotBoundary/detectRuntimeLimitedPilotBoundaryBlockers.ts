/**
 * H42 — limited pilot boundary **blocker** 탐지(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeLimitedPilotBoundary } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { RUNTIME_LIMITED_PILOT_BOUNDARY_ACTUAL_FLAGS_DISABLED } from "./runtimeLimitedPilotBoundaryConstants";
import { readLimitedPilotBoundaryUpstreamContext } from "./runtimeLimitedPilotBoundaryCheckHelpers";
import type { RuntimeLimitedPilotBoundaryBlockerReport } from "./runtimeLimitedPilotBoundaryTypes";

export function detectRuntimeLimitedPilotBoundaryBlockers(
  reports: RuntimeSemanticPlanningReportsBeforeLimitedPilotBoundary
): RuntimeLimitedPilotBoundaryBlockerReport {
  const {
    activationFinalGate,
    activationVerification,
    activationAlignment,
    activationViolation,
    activationBlockers,
    ultimateFinalGate,
    finalGate,
    approval,
    rollback,
    audit,
    control,
  } = readLimitedPilotBoundaryUpstreamContext(reports);

  const blockers: string[] = [];

  if (activationFinalGate.finalGateStatus === "blocked") {
    blockers.push("controlled activation candidate final safety gate blocked");
  }
  if (activationFinalGate.h42EntryReadiness === "blocked") {
    blockers.push("h42 entry readiness blocked");
  }
  if (activationVerification.verificationStatus === "failed") {
    blockers.push("controlled activation candidate verification failed");
  }
  if (activationAlignment.alignmentStatus === "failed") {
    blockers.push("controlled activation candidate alignment failed");
  }
  if (activationViolation.actualFlagViolations.length > 0) {
    blockers.push(...activationViolation.actualFlagViolations.slice(0, 3));
  }
  if (activationViolation.policyViolations.length > 0) {
    blockers.push(...activationViolation.policyViolations.slice(0, 3));
  }
  if (activationBlockers.blockers.length > 0) {
    blockers.push(...activationBlockers.blockers.slice(0, 2));
  }
  if (ultimateFinalGate.finalGateStatus === "blocked") {
    blockers.push("ultimate governance review final safety gate blocked");
  }
  if (finalGate.finalGateStatus === "blocked") {
    blockers.push("final release governance gate final safety gate blocked");
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
    mode: "runtime_limited_pilot_boundary_blocker_report",
    ...RUNTIME_LIMITED_PILOT_BOUNDARY_ACTUAL_FLAGS_DISABLED,
    blockers: mergeSortedUniqueKo(blockers),
    recommendations: mergeSortedUniqueKo([
      ...(blockers.length > 0
        ? ["H42: limited pilot boundary blocker — controlled activation·approval 정렬(pilot activation 없음)"]
        : []),
    ]),
  };
}
