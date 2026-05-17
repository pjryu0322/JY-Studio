/**
 * H36 — preflight final gate 기반 execution boundary shell **candidate status** 산출(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeExecutionBoundaryShell } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import type {
  RuntimeExecutionBoundaryShellBlockerReport,
  RuntimeExecutionBoundaryShellCandidateStatus,
} from "./runtimeExecutionBoundaryShellTypes";

export function evaluateRuntimeExecutionBoundaryShellCandidate(input: {
  readonly reports: RuntimeSemanticPlanningReportsBeforeExecutionBoundaryShell;
  readonly blockerReport: RuntimeExecutionBoundaryShellBlockerReport;
}): RuntimeExecutionBoundaryShellCandidateStatus {
  const { reports, blockerReport } = input;
  const preflightFinalGate = reports.runtimeReleaseGatePreflightFinalSafetyGate;
  const readinessVerification = reports.runtimeReleaseGatePreflightReadinessVerificationReport;
  const alignment = reports.runtimeReleaseGatePreflightAlignmentReport;
  const boundaryViolation = reports.runtimeReleaseGatePreflightBoundaryViolationReport;
  const preflightSummary = reports.runtimeReleaseGatePreflightSummary;

  if (
    blockerReport.blockers.length > 0 ||
    preflightFinalGate.finalGateStatus === "blocked" ||
    preflightFinalGate.h36EntryReadiness === "blocked" ||
    readinessVerification.verificationStatus === "failed" ||
    alignment.alignmentStatus === "failed" ||
    boundaryViolation.actualFlagViolations.length > 0 ||
    boundaryViolation.proofViolations.length > 0 ||
    preflightSummary.preflightBlockers.length > 0
  ) {
    return "blocked";
  }

  if (
    preflightFinalGate.finalGateStatus === "watch" ||
    preflightFinalGate.h36EntryReadiness === "watch" ||
    readinessVerification.verificationStatus === "partial" ||
    alignment.alignmentStatus === "partial" ||
    boundaryViolation.wordingRiskFindings.length > 0 ||
    preflightSummary.preflightReadiness === "watch"
  ) {
    return "watch";
  }

  if (
    preflightFinalGate.finalGateStatus === "ready_metadata" &&
    preflightFinalGate.h36EntryReadiness === "ready_metadata" &&
    readinessVerification.verificationStatus === "verified_metadata" &&
    alignment.alignmentStatus === "aligned_metadata" &&
    boundaryViolation.actualFlagViolations.length === 0 &&
    boundaryViolation.proofViolations.length === 0 &&
    blockerReport.blockers.length === 0 &&
    preflightSummary.preflightBlockers.length === 0 &&
    preflightSummary.preflightReadiness === "preflight_metadata_ready"
  ) {
    return "boundary_shell_metadata_candidate";
  }

  return "not_candidate";
}
