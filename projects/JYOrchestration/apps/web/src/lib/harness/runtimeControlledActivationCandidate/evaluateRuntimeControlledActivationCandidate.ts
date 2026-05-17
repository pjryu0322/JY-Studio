/**
 * H41 — ultimate governance final safety gate 기반 controlled activation **candidate**(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeControlledActivationCandidate } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { readControlledActivationUpstreamContext } from "./runtimeControlledActivationCandidateCheckHelpers";
import type {
  RuntimeControlledActivationCandidateBlockerReport,
  RuntimeControlledActivationCandidateStatus,
} from "./runtimeControlledActivationCandidateTypes";

export function evaluateRuntimeControlledActivationCandidate(input: {
  readonly reports: RuntimeSemanticPlanningReportsBeforeControlledActivationCandidate;
  readonly blockerReport: RuntimeControlledActivationCandidateBlockerReport;
}): RuntimeControlledActivationCandidateStatus {
  const { blockerReport } = input;
  const {
    ultimateFinalGate,
    ultimateVerification,
    ultimateAlignment,
    ultimateViolation,
    ultimateSummary,
  } = readControlledActivationUpstreamContext(input.reports);

  if (
    blockerReport.blockers.length > 0 ||
    ultimateFinalGate.finalGateStatus === "blocked" ||
    ultimateFinalGate.h41EntryReadiness === "blocked" ||
    ultimateVerification.verificationStatus === "failed" ||
    ultimateAlignment.alignmentStatus === "failed" ||
    ultimateViolation.actualFlagViolations.length > 0 ||
    ultimateViolation.proofViolations.length > 0 ||
    ultimateSummary.reviewBlockers.length > 0
  ) {
    return "blocked";
  }

  if (
    ultimateFinalGate.finalGateStatus === "watch" ||
    ultimateFinalGate.h41EntryReadiness === "watch" ||
    ultimateVerification.verificationStatus === "partial" ||
    ultimateAlignment.alignmentStatus === "partial" ||
    ultimateViolation.wordingRiskFindings.length > 0
  ) {
    return "watch";
  }

  if (
    ultimateFinalGate.finalGateStatus === "ready_metadata" &&
    ultimateFinalGate.h41EntryReadiness === "ready_metadata" &&
    ultimateVerification.verificationStatus === "verified_metadata" &&
    ultimateAlignment.alignmentStatus === "aligned_metadata" &&
    ultimateViolation.actualFlagViolations.length === 0 &&
    ultimateViolation.proofViolations.length === 0 &&
    ultimateViolation.wordingRiskFindings.length === 0 &&
    blockerReport.blockers.length === 0 &&
    ultimateSummary.reviewBlockers.length === 0
  ) {
    return "controlled_activation_metadata_candidate";
  }

  return "not_candidate";
}
