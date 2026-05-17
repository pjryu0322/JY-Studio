/**
 * H41.5 final safety gate 기반 limited pilot boundary **candidate**(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeLimitedPilotBoundary } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { readLimitedPilotBoundaryUpstreamContext } from "./runtimeLimitedPilotBoundaryCheckHelpers";
import type {
  RuntimeLimitedPilotBoundaryBlockerReport,
  RuntimeLimitedPilotBoundaryCandidateStatus,
} from "./runtimeLimitedPilotBoundaryTypes";

export function evaluateRuntimeLimitedPilotBoundaryCandidate(input: {
  readonly reports: RuntimeSemanticPlanningReportsBeforeLimitedPilotBoundary;
  readonly blockerReport: RuntimeLimitedPilotBoundaryBlockerReport;
}): RuntimeLimitedPilotBoundaryCandidateStatus {
  const { blockerReport } = input;
  const {
    activationFinalGate,
    activationVerification,
    activationAlignment,
    activationViolation,
    activationSummary,
  } = readLimitedPilotBoundaryUpstreamContext(input.reports);

  if (
    blockerReport.blockers.length > 0 ||
    activationFinalGate.finalGateStatus === "blocked" ||
    activationFinalGate.h42EntryReadiness === "blocked" ||
    activationVerification.verificationStatus === "failed" ||
    activationAlignment.alignmentStatus === "failed" ||
    activationViolation.actualFlagViolations.length > 0 ||
    activationViolation.policyViolations.length > 0 ||
    activationSummary.activationBlockers.length > 0
  ) {
    return "blocked";
  }

  if (
    activationFinalGate.finalGateStatus === "watch" ||
    activationFinalGate.h42EntryReadiness === "watch" ||
    activationVerification.verificationStatus === "partial" ||
    activationAlignment.alignmentStatus === "partial" ||
    activationViolation.wordingRiskFindings.length > 0
  ) {
    return "watch";
  }

  if (
    activationFinalGate.finalGateStatus === "ready_metadata" &&
    activationFinalGate.h42EntryReadiness === "ready_metadata" &&
    activationVerification.verificationStatus === "verified_metadata" &&
    activationAlignment.alignmentStatus === "aligned_metadata" &&
    activationViolation.actualFlagViolations.length === 0 &&
    activationViolation.policyViolations.length === 0 &&
    activationViolation.wordingRiskFindings.length === 0 &&
    blockerReport.blockers.length === 0 &&
    activationSummary.activationBlockers.length === 0
  ) {
    return "limited_pilot_boundary_metadata_candidate";
  }

  return "not_candidate";
}
