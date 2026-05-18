/**
 * H36.5 — H37 진입 전 execution boundary shell **final safety gate**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeExecutionBoundaryShellAlignmentReport,
  RuntimeExecutionBoundaryShellBlockerReport,
  RuntimeExecutionBoundaryShellBoundaryViolationReport,
  RuntimeExecutionBoundaryShellFinalGateStatus,
  RuntimeExecutionBoundaryShellFinalSafetyGate,
  RuntimeExecutionBoundaryShellReadinessVerificationReport,
  RuntimeExecutionBoundaryShellSummary,
} from "./runtimeExecutionBoundaryShellTypes";

export function buildRuntimeExecutionBoundaryShellFinalSafetyGate(input: {
  readonly summary: RuntimeExecutionBoundaryShellSummary;
  readonly blockerReport: RuntimeExecutionBoundaryShellBlockerReport;
  readonly boundaryViolation: RuntimeExecutionBoundaryShellBoundaryViolationReport;
  readonly readinessVerification: RuntimeExecutionBoundaryShellReadinessVerificationReport;
  readonly alignmentReport: RuntimeExecutionBoundaryShellAlignmentReport;
}): RuntimeExecutionBoundaryShellFinalSafetyGate {
  const { summary, blockerReport, boundaryViolation, readinessVerification, alignmentReport } = input;

  const blockers: string[] = [];
  if (blockerReport.blockers.length > 0) {
    blockers.push(...blockerReport.blockers.slice(0, 3));
  }
  if (summary.shellBlockers.length > 0) {
    blockers.push(...summary.shellBlockers.slice(0, 3));
  }
  if (boundaryViolation.actualFlagViolations.length > 0) {
    blockers.push(...boundaryViolation.actualFlagViolations.slice(0, 3));
  }
  if (readinessVerification.verificationStatus === "failed") {
    blockers.push("execution boundary shell readiness verification failed");
  }
  if (alignmentReport.alignmentStatus === "failed") {
    blockers.push("execution boundary shell alignment failed");
  }

  let finalGateStatus: RuntimeExecutionBoundaryShellFinalGateStatus;
  if (
    summary.candidateStatus === "blocked" ||
    readinessVerification.verificationStatus === "failed" ||
    alignmentReport.alignmentStatus === "failed" ||
    boundaryViolation.actualFlagViolations.length > 0 ||
    blockerReport.blockers.length > 0 ||
    summary.shellBlockers.length > 0
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
    summary.candidateStatus === "boundary_shell_metadata_candidate" &&
    summary.shellMode === "metadata_only" &&
    readinessVerification.verificationStatus === "verified_metadata" &&
    alignmentReport.alignmentStatus === "aligned_metadata" &&
    boundaryViolation.actualFlagViolations.length === 0 &&
    blockerReport.blockers.length === 0 &&
    summary.shellBlockers.length === 0
  ) {
    finalGateStatus = "ready_metadata";
  } else {
    finalGateStatus = "not_ready";
  }

  const checklist = mergeSortedUniqueKo([
    `candidateStatus:${summary.candidateStatus}`,
    `shellMode:${summary.shellMode}`,
    `readinessVerification:${readinessVerification.verificationStatus}`,
    `alignmentStatus:${alignmentReport.alignmentStatus}`,
    `actualFlagViolations:${boundaryViolation.actualFlagViolations.length}`,
    `wordingRiskFindings:${boundaryViolation.wordingRiskFindings.length}`,
    `shellBlockers:${summary.shellBlockers.length}`,
    `finalGateStatus:${finalGateStatus}`,
    "h37EntryReadiness:metadata_only_gate",
    "actualExecutionForbidden:true",
    "actualExecutionRoutingForbidden:true",
    "actualReleaseEnforcementForbidden:true",
    "actualShellExecutionForbidden:true",
  ]);

  const recommendations = mergeSortedUniqueKo([
    ...(finalGateStatus === "ready_metadata"
      ? ["H36.5: execution boundary shell final gate ready_metadata — H37 entry boundary 후보(집행 없음)"]
      : []),
    ...(finalGateStatus === "watch"
      ? ["H36.5: execution boundary shell final gate watch — readiness·alignment·wording risk 재검토"]
      : []),
    ...(finalGateStatus === "blocked"
      ? ["H36.5: execution boundary shell final gate blocked — violation·blocker·verification 정렬"]
      : []),
    ...(finalGateStatus === "not_ready"
      ? ["H36.5: execution boundary shell final gate not_ready — boundary_shell_metadata_candidate 선행"]
      : []),
    ...readinessVerification.recommendations,
    ...alignmentReport.recommendations,
    ...boundaryViolation.recommendations,
  ]);

  return {
    mode: "runtime_execution_boundary_shell_final_safety_gate",
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
    h37EntryReadiness: finalGateStatus,
    checklist,
    blockers: mergeSortedUniqueKo(blockers),
    recommendations,
  };
}
