/**
 * H34.5 — H35 진입 전 no-op shell release-gate **final safety gate**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeNoopShellReleaseGateAlignmentReport,
  RuntimeNoopShellReleaseGateBlockerReport,
  RuntimeNoopShellReleaseGateBoundaryViolationReport,
  RuntimeNoopShellReleaseGateFinalGateStatus,
  RuntimeNoopShellReleaseGateFinalSafetyGate,
  RuntimeNoopShellReleaseGateReadinessVerificationReport,
  RuntimeNoopShellReleaseGateSummary,
} from "./runtimeNoopShellReleaseGateTypes";

export function buildRuntimeNoopShellReleaseGateFinalSafetyGate(input: {
  readonly summary: RuntimeNoopShellReleaseGateSummary;
  readonly blockerReport: RuntimeNoopShellReleaseGateBlockerReport;
  readonly boundaryViolation: RuntimeNoopShellReleaseGateBoundaryViolationReport;
  readonly readinessVerification: RuntimeNoopShellReleaseGateReadinessVerificationReport;
  readonly alignmentReport: RuntimeNoopShellReleaseGateAlignmentReport;
}): RuntimeNoopShellReleaseGateFinalSafetyGate {
  const { summary, blockerReport, boundaryViolation, readinessVerification, alignmentReport } = input;

  const blockers: string[] = [];
  if (blockerReport.blockers.length > 0) {
    blockers.push(...blockerReport.blockers.slice(0, 3));
  }
  if (summary.releaseGateBlockers.length > 0) {
    blockers.push(...summary.releaseGateBlockers.slice(0, 3));
  }
  if (boundaryViolation.actualFlagViolations.length > 0) {
    blockers.push(...boundaryViolation.actualFlagViolations.slice(0, 3));
  }
  if (readinessVerification.verificationStatus === "failed") {
    blockers.push("release-gate readiness verification failed");
  }
  if (alignmentReport.alignmentStatus === "failed") {
    blockers.push("release-gate alignment failed");
  }

  let finalGateStatus: RuntimeNoopShellReleaseGateFinalGateStatus;
  if (
    summary.candidateStatus === "blocked" ||
    readinessVerification.verificationStatus === "failed" ||
    alignmentReport.alignmentStatus === "failed" ||
    boundaryViolation.actualFlagViolations.length > 0 ||
    blockerReport.blockers.length > 0 ||
    summary.releaseGateBlockers.length > 0
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
    summary.candidateStatus === "release_gate_metadata_candidate" &&
    summary.releaseGateMode === "metadata_only" &&
    readinessVerification.verificationStatus === "verified_metadata" &&
    alignmentReport.alignmentStatus === "aligned_metadata" &&
    boundaryViolation.actualFlagViolations.length === 0 &&
    blockerReport.blockers.length === 0 &&
    summary.releaseGateBlockers.length === 0
  ) {
    finalGateStatus = "ready_metadata";
  } else {
    finalGateStatus = "not_ready";
  }

  const checklist = mergeSortedUniqueKo([
    `candidateStatus:${summary.candidateStatus}`,
    `releaseGateMode:${summary.releaseGateMode}`,
    `readinessVerification:${readinessVerification.verificationStatus}`,
    `alignmentStatus:${alignmentReport.alignmentStatus}`,
    `actualFlagViolations:${boundaryViolation.actualFlagViolations.length}`,
    `wordingRiskFindings:${boundaryViolation.wordingRiskFindings.length}`,
    `releaseGateBlockers:${summary.releaseGateBlockers.length}`,
    `finalGateStatus:${finalGateStatus}`,
    "h35EntryReadiness:metadata_only_gate",
    "actualReleaseEnforcementForbidden:true",
    "actualShellExecutionForbidden:true",
  ]);

  const recommendations = mergeSortedUniqueKo([
    ...(finalGateStatus === "ready_metadata"
      ? ["H34.5: release-gate final gate ready_metadata — H35 metadata shell gate 후보(release enforcement 없음)"]
      : []),
    ...(finalGateStatus === "watch"
      ? ["H34.5: release-gate final gate watch — readiness·alignment·wording risk 재검토"]
      : []),
    ...(finalGateStatus === "blocked"
      ? ["H34.5: release-gate final gate blocked — violation·blocker·verification 정렬"]
      : []),
    ...(finalGateStatus === "not_ready" ? ["H34.5: release-gate final gate not_ready — H34 release-gate candidate 선행"] : []),
    ...readinessVerification.recommendations,
    ...alignmentReport.recommendations,
    ...boundaryViolation.recommendations,
  ]);

  return {
    mode: "runtime_noop_shell_release_gate_final_safety_gate",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualNoopShellExecutionEnabled: false,
    actualExecutionShellExecutionEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualExecutionEnabled: false,
    actualProviderRoutingEnabled: false,
    actualQueueControlEnabled: false,
    actualRollbackExecutionEnabled: false,
    finalGateStatus,
    h35EntryReadiness: finalGateStatus,
    checklist,
    blockers: mergeSortedUniqueKo(blockers),
    recommendations,
  };
}
