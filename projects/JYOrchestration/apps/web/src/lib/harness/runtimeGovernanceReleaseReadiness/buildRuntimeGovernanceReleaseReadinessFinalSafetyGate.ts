/**
 * H38.5 — H39 진입 전 governance release-readiness **final safety gate**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeGovernanceReleaseBlockerReport,
  RuntimeGovernanceReleaseReadinessAlignmentReport,
  RuntimeGovernanceReleaseReadinessFinalGateStatus,
  RuntimeGovernanceReleaseReadinessFinalSafetyGate,
  RuntimeGovernanceReleaseReadinessSummary,
  RuntimeGovernanceReleaseReadinessVerificationReport,
  RuntimeGovernanceReleaseReadinessViolationReport,
} from "./runtimeGovernanceReleaseReadinessTypes";

export function buildRuntimeGovernanceReleaseReadinessFinalSafetyGate(input: {
  readonly summary: RuntimeGovernanceReleaseReadinessSummary;
  readonly blockerReport: RuntimeGovernanceReleaseBlockerReport;
  readonly boundaryViolation: RuntimeGovernanceReleaseReadinessViolationReport;
  readonly readinessVerification: RuntimeGovernanceReleaseReadinessVerificationReport;
  readonly alignmentReport: RuntimeGovernanceReleaseReadinessAlignmentReport;
}): RuntimeGovernanceReleaseReadinessFinalSafetyGate {
  const { summary, blockerReport, boundaryViolation, readinessVerification, alignmentReport } = input;

  const blockers: string[] = [];
  if (blockerReport.blockers.length > 0) {
    blockers.push(...blockerReport.blockers.slice(0, 3));
  }
  if (summary.readinessBlockers.length > 0) {
    blockers.push(...summary.readinessBlockers.slice(0, 3));
  }
  if (boundaryViolation.actualFlagViolations.length > 0) {
    blockers.push(...boundaryViolation.actualFlagViolations.slice(0, 3));
  }
  if (boundaryViolation.proofViolations.length > 0) {
    blockers.push(...boundaryViolation.proofViolations.slice(0, 3));
  }
  if (readinessVerification.verificationStatus === "failed") {
    blockers.push("governance release-readiness verification failed");
  }
  if (alignmentReport.alignmentStatus === "failed") {
    blockers.push("governance release-readiness alignment failed");
  }

  let finalGateStatus: RuntimeGovernanceReleaseReadinessFinalGateStatus;
  if (
    summary.readinessStatus === "blocked" ||
    readinessVerification.verificationStatus === "failed" ||
    alignmentReport.alignmentStatus === "failed" ||
    boundaryViolation.actualFlagViolations.length > 0 ||
    boundaryViolation.proofViolations.length > 0 ||
    blockerReport.blockers.length > 0 ||
    summary.readinessBlockers.length > 0
  ) {
    finalGateStatus = "blocked";
  } else if (
    summary.readinessStatus === "watch" ||
    readinessVerification.verificationStatus === "partial" ||
    alignmentReport.alignmentStatus === "partial" ||
    boundaryViolation.wordingRiskFindings.length > 0
  ) {
    finalGateStatus = "watch";
  } else if (
    summary.readinessStatus === "governance_release_metadata_ready" &&
    summary.readinessMode === "metadata_only" &&
    readinessVerification.verificationStatus === "verified_metadata" &&
    alignmentReport.alignmentStatus === "aligned_metadata" &&
    boundaryViolation.actualFlagViolations.length === 0 &&
    boundaryViolation.proofViolations.length === 0 &&
    blockerReport.blockers.length === 0 &&
    summary.readinessBlockers.length === 0
  ) {
    finalGateStatus = "ready_metadata";
  } else {
    finalGateStatus = "not_ready";
  }

  const checklist = mergeSortedUniqueKo([
    `readinessStatus:${summary.readinessStatus}`,
    `readinessMode:${summary.readinessMode}`,
    `readinessVerification:${readinessVerification.verificationStatus}`,
    `alignmentStatus:${alignmentReport.alignmentStatus}`,
    `actualFlagViolations:${boundaryViolation.actualFlagViolations.length}`,
    `proofViolations:${boundaryViolation.proofViolations.length}`,
    `wordingRiskFindings:${boundaryViolation.wordingRiskFindings.length}`,
    `readinessBlockers:${summary.readinessBlockers.length}`,
    `finalGateStatus:${finalGateStatus}`,
    "h39EntryReadiness:metadata_only_gate",
    "actualExecutionForbidden:true",
    "actualExecutionRoutingForbidden:true",
    "actualReleaseEnforcementForbidden:true",
    "actualApprovalEnforcementForbidden:true",
  ]);

  const recommendations = mergeSortedUniqueKo([
    ...(finalGateStatus === "ready_metadata"
      ? ["H38.5: governance release-readiness final gate ready_metadata — H39 entry 후보(enforcement 없음)"]
      : []),
    ...(finalGateStatus === "watch"
      ? ["H38.5: governance release-readiness final gate watch — readiness·alignment·wording risk 재검토"]
      : []),
    ...(finalGateStatus === "blocked"
      ? ["H38.5: governance release-readiness final gate blocked — violation·blocker·verification 정렬"]
      : []),
    ...(finalGateStatus === "not_ready"
      ? ["H38.5: governance release-readiness final gate not_ready — governance_release_metadata_ready 선행"]
      : []),
    ...readinessVerification.recommendations,
    ...alignmentReport.recommendations,
    ...boundaryViolation.recommendations,
  ]);

  return {
    mode: "runtime_governance_release_readiness_final_safety_gate",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualNoopShellExecutionEnabled: false,
    actualExecutionShellExecutionEnabled: false,
    actualReleaseEnforcementEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualExecutionEnabled: false,
    actualExecutionRoutingEnabled: false,
    actualProviderRoutingEnabled: false,
    actualQueueControlEnabled: false,
    actualRollbackExecutionEnabled: false,
    actualApprovalEnforcementEnabled: false,
    finalGateStatus,
    h39EntryReadiness: finalGateStatus,
    checklist,
    blockers: mergeSortedUniqueKo(blockers),
    recommendations,
  };
}
