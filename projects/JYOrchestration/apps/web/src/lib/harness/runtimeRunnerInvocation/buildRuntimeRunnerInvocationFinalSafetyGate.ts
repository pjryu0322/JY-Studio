/**
 * H29.5 — H30 진입 전 runner invocation **final safety gate**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeRunnerInvocationBlockerReport,
  RuntimeRunnerInvocationBoundaryViolationReport,
  RuntimeRunnerInvocationFinalGateStatus,
  RuntimeRunnerInvocationFinalSafetyGate,
  RuntimeRunnerInvocationReadinessVerificationReport,
  RuntimeRunnerInvocationSummary,
} from "./runtimeRunnerInvocationTypes";

export function buildRuntimeRunnerInvocationFinalSafetyGate(input: {
  readonly summary: RuntimeRunnerInvocationSummary;
  readonly blockerReport: RuntimeRunnerInvocationBlockerReport;
  readonly boundaryViolation: RuntimeRunnerInvocationBoundaryViolationReport;
  readonly readinessVerification: RuntimeRunnerInvocationReadinessVerificationReport;
}): RuntimeRunnerInvocationFinalSafetyGate {
  const { summary, blockerReport, boundaryViolation, readinessVerification } = input;

  const blockers: string[] = [];
  if (blockerReport.blockers.length > 0) {
    blockers.push(...blockerReport.blockers.slice(0, 3));
  }
  if (boundaryViolation.actualFlagViolations.length > 0) {
    blockers.push(...boundaryViolation.actualFlagViolations.slice(0, 3));
  }
  if (readinessVerification.verificationStatus === "failed") {
    blockers.push("runner invocation readiness verification failed");
  }
  if (summary.invocationBlockers.length > 0 && blockerReport.blockers.length === 0) {
    blockers.push(...summary.invocationBlockers.slice(0, 2));
  }

  let finalGateStatus: RuntimeRunnerInvocationFinalGateStatus;
  if (
    boundaryViolation.actualFlagViolations.length > 0 ||
    readinessVerification.verificationStatus === "failed" ||
    summary.candidateStatus === "blocked" ||
    blockerReport.blockers.length > 0
  ) {
    finalGateStatus = "blocked";
  } else if (
    summary.candidateStatus === "watch" ||
    readinessVerification.verificationStatus === "partial" ||
    boundaryViolation.wordingRiskFindings.length > 0
  ) {
    finalGateStatus = "watch";
  } else if (
    summary.candidateStatus === "invocation_metadata_candidate" &&
    summary.invocationMode === "metadata_only" &&
    readinessVerification.verificationStatus === "verified_metadata" &&
    boundaryViolation.actualFlagViolations.length === 0 &&
    blockerReport.blockers.length === 0
  ) {
    finalGateStatus = "ready_metadata";
  } else {
    finalGateStatus = "not_ready";
  }

  const checklist = mergeSortedUniqueKo([
    `candidateStatus:${summary.candidateStatus}`,
    `invocationMode:${summary.invocationMode}`,
    `readinessVerification:${readinessVerification.verificationStatus}`,
    `actualFlagViolations:${boundaryViolation.actualFlagViolations.length}`,
    `wordingRiskFindings:${boundaryViolation.wordingRiskFindings.length}`,
    `blockerReport:${blockerReport.blockers.length}`,
    `finalGateStatus:${finalGateStatus}`,
    "h30EntryReadiness:metadata_only_gate",
    "actualRunnerInvocationForbidden:true",
  ]);

  const recommendations = mergeSortedUniqueKo([
    ...(finalGateStatus === "ready_metadata"
      ? ["H29.5: final gate ready_metadata — H30 runner skeleton metadata gate 후보(invocation 없음)"]
      : []),
    ...(finalGateStatus === "watch"
      ? ["H29.5: final gate watch — readiness·wording risk 재검토"]
      : []),
    ...(finalGateStatus === "blocked"
      ? ["H29.5: final gate blocked — violation·blocker·verification 정렬"]
      : []),
    ...(finalGateStatus === "not_ready" ? ["H29.5: final gate not_ready — H29 candidate 선행"] : []),
    ...readinessVerification.recommendations,
    ...boundaryViolation.recommendations,
  ]);

  return {
    mode: "runtime_runner_invocation_final_safety_gate",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualIsolatedRunnerInvocationEnabled: false,
    actualIsolatedRunnerExecutionEnabled: false,
    actualDryRunRunnerInvocationEnabled: false,
    actualDryRunRunnerExecutionEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualExecutionEnabled: false,
    actualProviderRoutingEnabled: false,
    actualQueueControlEnabled: false,
    actualRollbackExecutionEnabled: false,
    finalGateStatus,
    h30EntryReadiness: finalGateStatus,
    checklist,
    blockers: mergeSortedUniqueKo(blockers),
    recommendations,
  };
}
