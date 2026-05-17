/**
 * H39.5 — H40 진입 전 final release governance gate **ultimate no-enforcement final safety gate**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_ACTUAL_FLAGS_DISABLED } from "./runtimeFinalReleaseGovernanceGateConstants";
import type {
  RuntimeFinalReleaseGovernanceGateAlignmentReport,
  RuntimeFinalReleaseGovernanceGateBlockerReport,
  RuntimeFinalReleaseGovernanceGateFinalGateStatus,
  RuntimeFinalReleaseGovernanceGateFinalSafetyGate,
  RuntimeFinalReleaseGovernanceGateSummary,
  RuntimeFinalReleaseGovernanceGateVerificationReport,
  RuntimeFinalReleaseGovernanceGateViolationReport,
} from "./runtimeFinalReleaseGovernanceGateTypes";

export function buildRuntimeFinalReleaseGovernanceGateFinalSafetyGate(input: {
  readonly summary: RuntimeFinalReleaseGovernanceGateSummary;
  readonly blockerReport: RuntimeFinalReleaseGovernanceGateBlockerReport;
  readonly boundaryViolation: RuntimeFinalReleaseGovernanceGateViolationReport;
  readonly readinessVerification: RuntimeFinalReleaseGovernanceGateVerificationReport;
  readonly alignmentReport: RuntimeFinalReleaseGovernanceGateAlignmentReport;
}): RuntimeFinalReleaseGovernanceGateFinalSafetyGate {
  const { summary, blockerReport, boundaryViolation, readinessVerification, alignmentReport } = input;

  const blockers: string[] = [];
  if (blockerReport.blockers.length > 0) {
    blockers.push(...blockerReport.blockers.slice(0, 3));
  }
  if (summary.gateBlockers.length > 0) {
    blockers.push(...summary.gateBlockers.slice(0, 3));
  }
  if (boundaryViolation.actualFlagViolations.length > 0) {
    blockers.push(...boundaryViolation.actualFlagViolations.slice(0, 3));
  }
  if (readinessVerification.verificationStatus === "failed") {
    blockers.push("final release governance gate readiness verification failed");
  }
  if (alignmentReport.alignmentStatus === "failed") {
    blockers.push("final release governance gate alignment failed");
  }

  let finalGateStatus: RuntimeFinalReleaseGovernanceGateFinalGateStatus;
  if (
    summary.candidateStatus === "blocked" ||
    readinessVerification.verificationStatus === "failed" ||
    alignmentReport.alignmentStatus === "failed" ||
    boundaryViolation.actualFlagViolations.length > 0 ||
    blockerReport.blockers.length > 0 ||
    summary.gateBlockers.length > 0
  ) {
    finalGateStatus = "blocked";
  } else if (
    summary.candidateStatus === "watch" ||
    readinessVerification.verificationStatus === "partial" ||
    alignmentReport.alignmentStatus === "partial" ||
    boundaryViolation.wordingRiskFindings.length > 0
  ) {
    finalGateStatus = "watch";
  } else if (
    summary.candidateStatus === "final_release_governance_gate_metadata_candidate" &&
    summary.gateMode === "metadata_only" &&
    readinessVerification.verificationStatus === "verified_metadata" &&
    alignmentReport.alignmentStatus === "aligned_metadata" &&
    boundaryViolation.actualFlagViolations.length === 0 &&
    boundaryViolation.wordingRiskFindings.length === 0 &&
    blockerReport.blockers.length === 0 &&
    summary.gateBlockers.length === 0
  ) {
    finalGateStatus = "ready_metadata";
  } else {
    finalGateStatus = "not_ready";
  }

  const checklist = mergeSortedUniqueKo([
    `candidateStatus:${summary.candidateStatus}`,
    `gateMode:${summary.gateMode}`,
    `readinessVerification:${readinessVerification.verificationStatus}`,
    `alignmentStatus:${alignmentReport.alignmentStatus}`,
    `actualFlagViolations:${boundaryViolation.actualFlagViolations.length}`,
    `wordingRiskFindings:${boundaryViolation.wordingRiskFindings.length}`,
    `gateBlockers:${summary.gateBlockers.length}`,
    `finalGateStatus:${finalGateStatus}`,
    "h40EntryReadiness:metadata_only_gate",
    "actualExecutionForbidden:true",
    "actualReleaseEnforcementForbidden:true",
    "actualApprovalEnforcementForbidden:true",
    "actualExecutionBlockingForbidden:true",
    "actualMergeBlockingForbidden:true",
  ]);

  const recommendations = mergeSortedUniqueKo([
    ...(finalGateStatus === "ready_metadata"
      ? ["H39.5: final release governance gate final safety gate ready_metadata — H40 entry 후보(enforcement 없음)"]
      : []),
    ...(finalGateStatus === "watch"
      ? ["H39.5: final release governance gate final safety gate watch — verification·alignment·wording risk 재검토"]
      : []),
    ...(finalGateStatus === "blocked"
      ? ["H39.5: final release governance gate final safety gate blocked — violation·blocker·verification 정렬"]
      : []),
    ...(finalGateStatus === "not_ready"
      ? ["H39.5: final release governance gate final safety gate not_ready — final_release_governance_gate_metadata_candidate 선행"]
      : []),
    ...readinessVerification.recommendations,
    ...alignmentReport.recommendations,
    ...boundaryViolation.recommendations,
  ]);

  return {
    mode: "runtime_final_release_governance_gate_final_safety_gate",
    ...RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_ACTUAL_FLAGS_DISABLED,
    finalGateStatus,
    h40EntryReadiness: finalGateStatus,
    checklist,
    blockers: mergeSortedUniqueKo(blockers),
    recommendations,
  };
}
