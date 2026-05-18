/**
 * H37 — execution boundary shell final gate 기반 governance boundary **candidate status**(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeExecutionGovernanceBoundary } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import type {
  RuntimeExecutionGovernanceBoundaryBlockerReport,
  RuntimeExecutionGovernanceBoundaryCandidateStatus,
} from "./runtimeExecutionGovernanceBoundaryTypes";

export function evaluateRuntimeExecutionGovernanceBoundaryCandidate(input: {
  readonly reports: RuntimeSemanticPlanningReportsBeforeExecutionGovernanceBoundary;
  readonly blockerReport: RuntimeExecutionGovernanceBoundaryBlockerReport;
}): RuntimeExecutionGovernanceBoundaryCandidateStatus {
  const { reports, blockerReport } = input;
  const shellFinalGate = reports.runtimeExecutionBoundaryShellFinalSafetyGate;
  const shellReadiness = reports.runtimeExecutionBoundaryShellReadinessVerificationReport;
  const shellAlignment = reports.runtimeExecutionBoundaryShellAlignmentReport;
  const shellBoundaryViolation = reports.runtimeExecutionBoundaryShellBoundaryViolationReport;
  const shellSummary = reports.runtimeExecutionBoundaryShellSummary;

  if (
    blockerReport.blockers.length > 0 ||
    shellFinalGate.finalGateStatus === "blocked" ||
    shellFinalGate.h37EntryReadiness === "blocked" ||
    shellReadiness.verificationStatus === "failed" ||
    shellAlignment.alignmentStatus === "failed" ||
    shellBoundaryViolation.actualFlagViolations.length > 0 ||
    shellSummary.shellBlockers.length > 0
  ) {
    return "blocked";
  }

  if (
    shellFinalGate.finalGateStatus === "watch" ||
    shellFinalGate.h37EntryReadiness === "watch" ||
    shellReadiness.verificationStatus === "partial" ||
    shellAlignment.alignmentStatus === "partial" ||
    shellBoundaryViolation.wordingRiskFindings.length > 0
  ) {
    return "watch";
  }

  if (
    shellFinalGate.finalGateStatus === "ready_metadata" &&
    shellFinalGate.h37EntryReadiness === "ready_metadata" &&
    shellReadiness.verificationStatus === "verified_metadata" &&
    shellAlignment.alignmentStatus === "aligned_metadata" &&
    shellBoundaryViolation.actualFlagViolations.length === 0 &&
    blockerReport.blockers.length === 0 &&
    shellSummary.shellBlockers.length === 0
  ) {
    return "governance_boundary_metadata_candidate";
  }

  return "not_candidate";
}
