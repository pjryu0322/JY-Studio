/**
 * H37.5 — H38 진입 전 governance boundary **final safety gate**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeExecutionGovernanceBoundaryAlignmentReport,
  RuntimeExecutionGovernanceBoundaryBlockerReport,
  RuntimeExecutionGovernanceBoundaryFinalGateStatus,
  RuntimeExecutionGovernanceBoundaryFinalSafetyGate,
  RuntimeExecutionGovernanceBoundaryReadinessVerificationReport,
  RuntimeExecutionGovernanceBoundarySummary,
  RuntimeExecutionGovernanceBoundaryViolationReport,
} from "./runtimeExecutionGovernanceBoundaryTypes";

export function buildRuntimeExecutionGovernanceBoundaryFinalSafetyGate(input: {
  readonly summary: RuntimeExecutionGovernanceBoundarySummary;
  readonly blockerReport: RuntimeExecutionGovernanceBoundaryBlockerReport;
  readonly boundaryViolation: RuntimeExecutionGovernanceBoundaryViolationReport;
  readonly readinessVerification: RuntimeExecutionGovernanceBoundaryReadinessVerificationReport;
  readonly alignmentReport: RuntimeExecutionGovernanceBoundaryAlignmentReport;
}): RuntimeExecutionGovernanceBoundaryFinalSafetyGate {
  const { summary, blockerReport, boundaryViolation, readinessVerification, alignmentReport } = input;

  const blockers: string[] = [];
  if (blockerReport.blockers.length > 0) {
    blockers.push(...blockerReport.blockers.slice(0, 3));
  }
  if (summary.governanceBlockers.length > 0) {
    blockers.push(...summary.governanceBlockers.slice(0, 3));
  }
  if (boundaryViolation.actualFlagViolations.length > 0) {
    blockers.push(...boundaryViolation.actualFlagViolations.slice(0, 3));
  }
  if (readinessVerification.verificationStatus === "failed") {
    blockers.push("governance boundary readiness verification failed");
  }
  if (alignmentReport.alignmentStatus === "failed") {
    blockers.push("governance boundary alignment failed");
  }

  let finalGateStatus: RuntimeExecutionGovernanceBoundaryFinalGateStatus;
  if (
    summary.candidateStatus === "blocked" ||
    readinessVerification.verificationStatus === "failed" ||
    alignmentReport.alignmentStatus === "failed" ||
    boundaryViolation.actualFlagViolations.length > 0 ||
    blockerReport.blockers.length > 0 ||
    summary.governanceBlockers.length > 0
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
    summary.candidateStatus === "governance_boundary_metadata_candidate" &&
    summary.governanceMode === "metadata_only" &&
    readinessVerification.verificationStatus === "verified_metadata" &&
    alignmentReport.alignmentStatus === "aligned_metadata" &&
    boundaryViolation.actualFlagViolations.length === 0 &&
    blockerReport.blockers.length === 0 &&
    summary.governanceBlockers.length === 0
  ) {
    finalGateStatus = "ready_metadata";
  } else {
    finalGateStatus = "not_ready";
  }

  const checklist = mergeSortedUniqueKo([
    `candidateStatus:${summary.candidateStatus}`,
    `governanceMode:${summary.governanceMode}`,
    `hardeningReadiness:${summary.hardeningReadiness}`,
    `readinessVerification:${readinessVerification.verificationStatus}`,
    `alignmentStatus:${alignmentReport.alignmentStatus}`,
    `actualFlagViolations:${boundaryViolation.actualFlagViolations.length}`,
    `wordingRiskFindings:${boundaryViolation.wordingRiskFindings.length}`,
    `governanceBlockers:${summary.governanceBlockers.length}`,
    `finalGateStatus:${finalGateStatus}`,
    "h38EntryReadiness:metadata_only_gate",
    "actualExecutionForbidden:true",
    "actualExecutionRoutingForbidden:true",
    "actualReleaseEnforcementForbidden:true",
    "actualApprovalEnforcementForbidden:true",
  ]);

  const recommendations = mergeSortedUniqueKo([
    ...(finalGateStatus === "ready_metadata"
      ? ["H37.5: governance boundary final gate ready_metadata — H38 entry governance 후보(집행 없음)"]
      : []),
    ...(finalGateStatus === "watch"
      ? ["H37.5: governance boundary final gate watch — readiness·alignment·wording risk 재검토"]
      : []),
    ...(finalGateStatus === "blocked"
      ? ["H37.5: governance boundary final gate blocked — violation·blocker·verification 정렬"]
      : []),
    ...(finalGateStatus === "not_ready"
      ? ["H37.5: governance boundary final gate not_ready — governance_boundary_metadata_candidate 선행"]
      : []),
    ...readinessVerification.recommendations,
    ...alignmentReport.recommendations,
    ...boundaryViolation.recommendations,
  ]);

  return {
    mode: "runtime_execution_governance_boundary_final_safety_gate",
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
    h38EntryReadiness: finalGateStatus,
    checklist,
    blockers: mergeSortedUniqueKo(blockers),
    recommendations,
  };
}
