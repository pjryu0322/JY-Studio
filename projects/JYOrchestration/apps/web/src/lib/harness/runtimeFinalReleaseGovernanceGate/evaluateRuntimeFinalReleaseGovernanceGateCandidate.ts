/**
 * H39 — governance release-readiness final gate 기반 final release governance gate **candidate**(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeFinalReleaseGovernanceGate } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import type {
  RuntimeFinalReleaseGovernanceGateBlockerReport,
  RuntimeFinalReleaseGovernanceGateCandidateStatus,
} from "./runtimeFinalReleaseGovernanceGateTypes";

export function evaluateRuntimeFinalReleaseGovernanceGateCandidate(input: {
  readonly reports: RuntimeSemanticPlanningReportsBeforeFinalReleaseGovernanceGate;
  readonly blockerReport: RuntimeFinalReleaseGovernanceGateBlockerReport;
}): RuntimeFinalReleaseGovernanceGateCandidateStatus {
  const { reports, blockerReport } = input;
  const releaseFinalGate = reports.runtimeGovernanceReleaseReadinessFinalSafetyGate;
  const releaseReadiness = reports.runtimeGovernanceReleaseReadinessVerificationReport;
  const releaseAlignment = reports.runtimeGovernanceReleaseReadinessAlignmentReport;
  const releaseViolation = reports.runtimeGovernanceReleaseReadinessViolationReport;
  const releaseSummary = reports.runtimeGovernanceReleaseReadinessSummary;

  if (
    blockerReport.blockers.length > 0 ||
    releaseFinalGate.finalGateStatus === "blocked" ||
    releaseFinalGate.h39EntryReadiness === "blocked" ||
    releaseReadiness.verificationStatus === "failed" ||
    releaseAlignment.alignmentStatus === "failed" ||
    releaseViolation.actualFlagViolations.length > 0 ||
    releaseViolation.proofViolations.length > 0 ||
    releaseSummary.readinessBlockers.length > 0
  ) {
    return "blocked";
  }

  if (
    releaseFinalGate.finalGateStatus === "watch" ||
    releaseFinalGate.h39EntryReadiness === "watch" ||
    releaseReadiness.verificationStatus === "partial" ||
    releaseAlignment.alignmentStatus === "partial" ||
    releaseViolation.wordingRiskFindings.length > 0
  ) {
    return "watch";
  }

  if (
    releaseFinalGate.finalGateStatus === "ready_metadata" &&
    releaseFinalGate.h39EntryReadiness === "ready_metadata" &&
    releaseReadiness.verificationStatus === "verified_metadata" &&
    releaseAlignment.alignmentStatus === "aligned_metadata" &&
    releaseViolation.actualFlagViolations.length === 0 &&
    releaseViolation.proofViolations.length === 0 &&
    blockerReport.blockers.length === 0 &&
    releaseSummary.readinessBlockers.length === 0
  ) {
    return "final_release_governance_gate_metadata_candidate";
  }

  return "not_candidate";
}
