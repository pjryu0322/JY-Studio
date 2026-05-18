/**
 * H31 — harness final gate 기반 no-op execution shell **candidate status** 산출(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeNoopExecutionShell } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import type {
  RuntimeNoopExecutionShellBlockerReport,
  RuntimeNoopExecutionShellCandidateStatus,
} from "./runtimeNoopExecutionShellTypes";

export function evaluateRuntimeNoopExecutionShellCandidate(input: {
  readonly reports: RuntimeSemanticPlanningReportsBeforeNoopExecutionShell;
  readonly blockerReport: RuntimeNoopExecutionShellBlockerReport;
}): RuntimeNoopExecutionShellCandidateStatus {
  const { reports, blockerReport } = input;
  const harnessGate = reports.runtimeRunnerNoopHarnessFinalSafetyGate;
  const harnessVerification = reports.runtimeRunnerNoopHarnessReadinessVerificationReport;
  const harnessAlignment = reports.runtimeRunnerNoopHarnessAlignmentReport;
  const harnessBoundary = reports.runtimeRunnerNoopHarnessBoundaryViolationReport;
  const harnessSummary = reports.runtimeRunnerNoopHarnessSummary;

  if (
    blockerReport.blockers.length > 0 ||
    harnessGate.finalGateStatus === "blocked" ||
    harnessGate.h31EntryReadiness === "blocked" ||
    harnessVerification.verificationStatus === "failed" ||
    harnessAlignment.alignmentStatus === "failed" ||
    harnessBoundary.actualFlagViolations.length > 0 ||
    harnessSummary.harnessBlockers.length > 0
  ) {
    return "blocked";
  }

  if (
    harnessGate.finalGateStatus === "watch" ||
    harnessGate.h31EntryReadiness === "watch" ||
    harnessVerification.verificationStatus === "partial" ||
    harnessAlignment.alignmentStatus === "partial" ||
    harnessBoundary.wordingRiskFindings.length > 0
  ) {
    return "watch";
  }

  if (
    harnessGate.finalGateStatus === "ready_metadata" &&
    harnessGate.h31EntryReadiness === "ready_metadata" &&
    harnessVerification.verificationStatus === "verified_metadata" &&
    harnessAlignment.alignmentStatus === "aligned_metadata" &&
    harnessBoundary.actualFlagViolations.length === 0 &&
    harnessSummary.harnessBlockers.length === 0
  ) {
    return "shell_metadata_candidate";
  }

  return "not_candidate";
}
