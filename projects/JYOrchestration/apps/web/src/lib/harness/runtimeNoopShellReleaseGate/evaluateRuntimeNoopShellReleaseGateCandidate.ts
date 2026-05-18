/**
 * H34 — hardening final gate 기반 release-gate **candidate status** 산출(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeNoopShellReleaseGate } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import type {
  RuntimeNoopShellReleaseGateBlockerReport,
  RuntimeNoopShellReleaseGateCandidateStatus,
} from "./runtimeNoopShellReleaseGateTypes";

export function evaluateRuntimeNoopShellReleaseGateCandidate(input: {
  readonly reports: RuntimeSemanticPlanningReportsBeforeNoopShellReleaseGate;
  readonly blockerReport: RuntimeNoopShellReleaseGateBlockerReport;
}): RuntimeNoopShellReleaseGateCandidateStatus {
  const { reports, blockerReport } = input;
  const hardeningGate = reports.runtimeNoopShellHardeningFinalSafetyGate;
  const readinessVerification = reports.runtimeNoopShellHardeningReadinessVerificationReport;
  const alignment = reports.runtimeNoopShellHardeningAlignmentReport;
  const boundary = reports.runtimeNoopShellHardeningBoundaryViolationReport;
  const hardeningSummary = reports.runtimeNoopShellHardeningSummary;

  if (
    blockerReport.blockers.length > 0 ||
    hardeningGate.finalGateStatus === "blocked" ||
    hardeningGate.h34EntryReadiness === "blocked" ||
    readinessVerification.verificationStatus === "failed" ||
    alignment.alignmentStatus === "failed" ||
    boundary.actualFlagViolations.length > 0 ||
    hardeningSummary.hardeningBlockers.length > 0
  ) {
    return "blocked";
  }

  if (
    hardeningGate.finalGateStatus === "watch" ||
    hardeningGate.h34EntryReadiness === "watch" ||
    readinessVerification.verificationStatus === "partial" ||
    alignment.alignmentStatus === "partial" ||
    boundary.wordingRiskFindings.length > 0 ||
    hardeningSummary.hardeningReadiness === "watch"
  ) {
    return "watch";
  }

  if (
    hardeningGate.finalGateStatus === "ready_metadata" &&
    hardeningGate.h34EntryReadiness === "ready_metadata" &&
    readinessVerification.verificationStatus === "verified_metadata" &&
    alignment.alignmentStatus === "aligned_metadata" &&
    boundary.actualFlagViolations.length === 0 &&
    blockerReport.blockers.length === 0 &&
    hardeningSummary.hardeningBlockers.length === 0 &&
    hardeningSummary.hardeningReadiness === "hardening_metadata_ready"
  ) {
    return "release_gate_metadata_candidate";
  }

  return "not_candidate";
}
