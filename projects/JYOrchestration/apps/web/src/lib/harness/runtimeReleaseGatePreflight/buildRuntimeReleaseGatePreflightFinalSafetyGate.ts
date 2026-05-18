/**
 * H35.5 — H36 진입 전 release-gate preflight **final safety gate**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeReleaseGatePreflightAlignmentReport,
  RuntimeReleaseGatePreflightBlockerReport,
  RuntimeReleaseGatePreflightBoundaryViolationReport,
  RuntimeReleaseGatePreflightFinalGateStatus,
  RuntimeReleaseGatePreflightFinalSafetyGate,
  RuntimeReleaseGatePreflightReadinessVerificationReport,
  RuntimeReleaseGatePreflightSummary,
} from "./runtimeReleaseGatePreflightTypes";

export function buildRuntimeReleaseGatePreflightFinalSafetyGate(input: {
  readonly summary: RuntimeReleaseGatePreflightSummary;
  readonly blockerReport: RuntimeReleaseGatePreflightBlockerReport;
  readonly boundaryViolation: RuntimeReleaseGatePreflightBoundaryViolationReport;
  readonly readinessVerification: RuntimeReleaseGatePreflightReadinessVerificationReport;
  readonly alignmentReport: RuntimeReleaseGatePreflightAlignmentReport;
}): RuntimeReleaseGatePreflightFinalSafetyGate {
  const { summary, blockerReport, boundaryViolation, readinessVerification, alignmentReport } = input;

  const blockers: string[] = [];
  if (blockerReport.blockers.length > 0) {
    blockers.push(...blockerReport.blockers.slice(0, 3));
  }
  if (summary.preflightBlockers.length > 0) {
    blockers.push(...summary.preflightBlockers.slice(0, 3));
  }
  if (boundaryViolation.actualFlagViolations.length > 0) {
    blockers.push(...boundaryViolation.actualFlagViolations.slice(0, 3));
  }
  if (boundaryViolation.proofViolations.length > 0) {
    blockers.push(...boundaryViolation.proofViolations.slice(0, 3));
  }
  if (readinessVerification.verificationStatus === "failed") {
    blockers.push("preflight readiness verification failed");
  }
  if (alignmentReport.alignmentStatus === "failed") {
    blockers.push("preflight alignment failed");
  }

  let finalGateStatus: RuntimeReleaseGatePreflightFinalGateStatus;
  if (
    summary.preflightReadiness === "blocked" ||
    readinessVerification.verificationStatus === "failed" ||
    alignmentReport.alignmentStatus === "failed" ||
    boundaryViolation.actualFlagViolations.length > 0 ||
    boundaryViolation.proofViolations.length > 0 ||
    blockerReport.blockers.length > 0 ||
    summary.preflightBlockers.length > 0
  ) {
    finalGateStatus = "blocked";
  } else if (
    summary.preflightReadiness === "watch" ||
    readinessVerification.verificationStatus === "partial" ||
    alignmentReport.alignmentStatus === "partial" ||
    boundaryViolation.wordingRiskFindings.length > 0
  ) {
    finalGateStatus = "watch";
  } else if (
    summary.preflightReadiness === "preflight_metadata_ready" &&
    summary.preflightMode === "metadata_only" &&
    readinessVerification.verificationStatus === "verified_metadata" &&
    alignmentReport.alignmentStatus === "aligned_metadata" &&
    boundaryViolation.actualFlagViolations.length === 0 &&
    boundaryViolation.proofViolations.length === 0 &&
    blockerReport.blockers.length === 0 &&
    summary.preflightBlockers.length === 0
  ) {
    finalGateStatus = "ready_metadata";
  } else {
    finalGateStatus = "not_ready";
  }

  const checklist = mergeSortedUniqueKo([
    `preflightReadiness:${summary.preflightReadiness}`,
    `preflightMode:${summary.preflightMode}`,
    `readinessVerification:${readinessVerification.verificationStatus}`,
    `alignmentStatus:${alignmentReport.alignmentStatus}`,
    `actualFlagViolations:${boundaryViolation.actualFlagViolations.length}`,
    `proofViolations:${boundaryViolation.proofViolations.length}`,
    `wordingRiskFindings:${boundaryViolation.wordingRiskFindings.length}`,
    `preflightBlockers:${summary.preflightBlockers.length}`,
    `finalGateStatus:${finalGateStatus}`,
    "h36EntryReadiness:metadata_only_gate",
    "actualReleaseEnforcementForbidden:true",
    "actualShellExecutionForbidden:true",
    "actualExecutionForbidden:true",
  ]);

  const recommendations = mergeSortedUniqueKo([
    ...(finalGateStatus === "ready_metadata"
      ? ["H35.5: preflight final gate ready_metadata — H36 execution boundary metadata shell 후보(집행 없음)"]
      : []),
    ...(finalGateStatus === "watch"
      ? ["H35.5: preflight final gate watch — readiness·alignment·wording risk 재검토"]
      : []),
    ...(finalGateStatus === "blocked"
      ? ["H35.5: preflight final gate blocked — violation·blocker·verification 정렬"]
      : []),
    ...(finalGateStatus === "not_ready" ? ["H35.5: preflight final gate not_ready — H35 preflight_metadata_ready 선행"] : []),
    ...readinessVerification.recommendations,
    ...alignmentReport.recommendations,
    ...boundaryViolation.recommendations,
  ]);

  return {
    mode: "runtime_release_gate_preflight_final_safety_gate",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualNoopShellExecutionEnabled: false,
    actualExecutionShellExecutionEnabled: false,
    actualReleaseEnforcementEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualExecutionEnabled: false,
    actualProviderRoutingEnabled: false,
    actualQueueControlEnabled: false,
    actualRollbackExecutionEnabled: false,
    finalGateStatus,
    h36EntryReadiness: finalGateStatus,
    checklist,
    blockers: mergeSortedUniqueKo(blockers),
    recommendations,
  };
}
