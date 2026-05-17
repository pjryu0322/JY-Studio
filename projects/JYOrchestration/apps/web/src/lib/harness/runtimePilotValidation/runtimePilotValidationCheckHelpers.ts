/**
 * Pilot Validation Phase 0 — H45.5 stabilization upstream read helpers.
 */

import type { RuntimeSemanticPlanningReportsBeforePilotValidation } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import type { RuntimePilotValidationReadOnlyChainStatus } from "./runtimePilotValidationTypes";

export function readControlledPilotExecutionStabilizationContext(
  reports: RuntimeSemanticPlanningReportsBeforePilotValidation
) {
  return {
    finalGate: reports.runtimeControlledPilotExecutionCandidateFinalSafetyGate,
    verification: reports.runtimeControlledPilotExecutionCandidateVerificationReport,
    alignment: reports.runtimeControlledPilotExecutionCandidateAlignmentReport,
    violation: reports.runtimeControlledPilotExecutionCandidateViolationReport,
    blockerReport: reports.runtimeControlledPilotExecutionCandidateBlockerReport,
    candidateSummary: reports.runtimeControlledPilotExecutionCandidateSummary,
    noExecutionProof: reports.runtimeFinalPilotNoExecutionProof,
    forbiddenProof: reports.runtimeFinalPilotExecutionForbiddenProof,
  };
}

export function hasControlledPilotExecutionViolations(
  reports: RuntimeSemanticPlanningReportsBeforePilotValidation
): boolean {
  const { violation } = readControlledPilotExecutionStabilizationContext(reports);
  return (
    violation.actualFlagViolations.length > 0 ||
    violation.policyViolations.length > 0 ||
    violation.wordingRiskFindings.length > 0
  );
}

export function resolveRuntimePilotValidationReadOnlyChainStatus(
  reports: RuntimeSemanticPlanningReportsBeforePilotValidation
): RuntimePilotValidationReadOnlyChainStatus {
  const { finalGate, verification, alignment, violation, blockerReport } =
    readControlledPilotExecutionStabilizationContext(reports);

  if (
    finalGate.finalGateStatus === "blocked" ||
    verification.verificationStatus === "failed" ||
    alignment.alignmentStatus === "failed" ||
    hasControlledPilotExecutionViolations(reports) ||
    blockerReport.blockers.length > 0
  ) {
    return "blocked";
  }

  if (
    finalGate.finalGateStatus === "watch" ||
    verification.verificationStatus === "partial" ||
    alignment.alignmentStatus === "partial" ||
    violation.wordingRiskFindings.length > 0
  ) {
    return "watch";
  }

  if (
    finalGate.finalGateStatus === "ready_metadata" &&
    finalGate.pilotValidationEntryReadiness === "ready_metadata" &&
    verification.verificationStatus === "verified_metadata" &&
    alignment.alignmentStatus === "aligned_metadata" &&
    !hasControlledPilotExecutionViolations(reports) &&
    blockerReport.blockers.length === 0
  ) {
    return "ready_for_validation";
  }

  return "not_ready";
}
