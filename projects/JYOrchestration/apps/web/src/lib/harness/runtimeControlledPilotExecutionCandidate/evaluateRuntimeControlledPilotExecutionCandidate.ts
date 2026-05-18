/**
 * H45 — pilot execution readiness final gate 기반 controlled pilot execution **candidate**(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeControlledPilotExecutionCandidate } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { readControlledPilotExecutionUpstreamContext } from "./runtimeControlledPilotExecutionCandidateCheckHelpers";
import type {
  RuntimeControlledPilotExecutionCandidateBlockerReport,
  RuntimeControlledPilotExecutionCandidateStatus,
} from "./runtimeControlledPilotExecutionCandidateTypes";

export function evaluateRuntimeControlledPilotExecutionCandidate(input: {
  readonly reports: RuntimeSemanticPlanningReportsBeforeControlledPilotExecutionCandidate;
  readonly blockerReport: RuntimeControlledPilotExecutionCandidateBlockerReport;
}): RuntimeControlledPilotExecutionCandidateStatus {
  const { blockerReport } = input;
  const {
    executionFinalGate,
    executionVerification,
    executionAlignment,
    executionViolation,
  } = readControlledPilotExecutionUpstreamContext(input.reports);

  const hasExecutionViolations =
    executionViolation.actualFlagViolations.length > 0 ||
    executionViolation.proofViolations.length > 0 ||
    executionViolation.forbiddenProofViolations.length > 0;

  if (
    blockerReport.blockers.length > 0 ||
    executionFinalGate.finalGateStatus === "blocked" ||
    executionFinalGate.h45EntryReadiness === "blocked" ||
    executionVerification.verificationStatus === "failed" ||
    executionAlignment.alignmentStatus === "failed" ||
    hasExecutionViolations
  ) {
    return "blocked";
  }

  if (
    executionFinalGate.finalGateStatus === "watch" ||
    executionFinalGate.h45EntryReadiness === "watch" ||
    executionVerification.verificationStatus === "partial" ||
    executionAlignment.alignmentStatus === "partial" ||
    executionViolation.wordingRiskFindings.length > 0
  ) {
    return "watch";
  }

  if (
    executionFinalGate.finalGateStatus === "ready_metadata" &&
    executionFinalGate.h45EntryReadiness === "ready_metadata" &&
    executionVerification.verificationStatus === "verified_metadata" &&
    executionAlignment.alignmentStatus === "aligned_metadata" &&
    !hasExecutionViolations &&
    blockerReport.blockers.length === 0
  ) {
    return "controlled_pilot_execution_metadata_candidate";
  }

  return "not_candidate";
}
