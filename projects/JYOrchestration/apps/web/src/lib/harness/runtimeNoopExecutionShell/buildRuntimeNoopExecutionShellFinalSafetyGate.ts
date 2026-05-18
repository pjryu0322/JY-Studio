/**
 * H31.5 — H32 진입 전 no-op execution shell **final safety gate**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeNoopExecutionShellBlockerReport,
  RuntimeNoopExecutionShellBoundaryViolationReport,
  RuntimeNoopExecutionShellFinalGateStatus,
  RuntimeNoopExecutionShellFinalSafetyGate,
  RuntimeNoopExecutionShellReadinessVerificationReport,
  RuntimeNoopExecutionShellSummary,
} from "./runtimeNoopExecutionShellTypes";

export function buildRuntimeNoopExecutionShellFinalSafetyGate(input: {
  readonly summary: RuntimeNoopExecutionShellSummary;
  readonly blockerReport: RuntimeNoopExecutionShellBlockerReport;
  readonly boundaryViolation: RuntimeNoopExecutionShellBoundaryViolationReport;
  readonly readinessVerification: RuntimeNoopExecutionShellReadinessVerificationReport;
}): RuntimeNoopExecutionShellFinalSafetyGate {
  const { summary, blockerReport, boundaryViolation, readinessVerification } = input;

  const blockers: string[] = [];
  if (blockerReport.blockers.length > 0) {
    blockers.push(...blockerReport.blockers.slice(0, 3));
  }
  if (boundaryViolation.actualFlagViolations.length > 0) {
    blockers.push(...boundaryViolation.actualFlagViolations.slice(0, 3));
  }
  if (readinessVerification.verificationStatus === "failed") {
    blockers.push("execution shell readiness verification failed");
  }
  if (summary.shellBlockers.length > 0 && blockerReport.blockers.length === 0) {
    blockers.push(...summary.shellBlockers.slice(0, 2));
  }

  let finalGateStatus: RuntimeNoopExecutionShellFinalGateStatus;
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
    summary.candidateStatus === "shell_metadata_candidate" &&
    summary.shellMode === "metadata_only" &&
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
    `shellMode:${summary.shellMode}`,
    `readinessVerification:${readinessVerification.verificationStatus}`,
    `actualFlagViolations:${boundaryViolation.actualFlagViolations.length}`,
    `wordingRiskFindings:${boundaryViolation.wordingRiskFindings.length}`,
    `blockerReport:${blockerReport.blockers.length}`,
    `finalGateStatus:${finalGateStatus}`,
    "h32EntryReadiness:metadata_only_gate",
    "actualShellExecutionForbidden:true",
  ]);

  const recommendations = mergeSortedUniqueKo([
    ...(finalGateStatus === "ready_metadata"
      ? ["H31.5: final gate ready_metadata — H32 shell hardening metadata gate 후보(shell execution 없음)"]
      : []),
    ...(finalGateStatus === "watch"
      ? ["H31.5: final gate watch — readiness·wording risk 재검토"]
      : []),
    ...(finalGateStatus === "blocked"
      ? ["H31.5: final gate blocked — violation·blocker·verification 정렬"]
      : []),
    ...(finalGateStatus === "not_ready" ? ["H31.5: final gate not_ready — H31 shell candidate 선행"] : []),
    ...readinessVerification.recommendations,
    ...boundaryViolation.recommendations,
  ]);

  return {
    mode: "runtime_noop_execution_shell_final_safety_gate",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualIsolatedRunnerInvocationEnabled: false,
    actualIsolatedRunnerExecutionEnabled: false,
    actualDryRunRunnerInvocationEnabled: false,
    actualDryRunRunnerExecutionEnabled: false,
    actualNoopShellExecutionEnabled: false,
    actualExecutionShellExecutionEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualExecutionEnabled: false,
    actualProviderRoutingEnabled: false,
    actualQueueControlEnabled: false,
    actualRollbackExecutionEnabled: false,
    finalGateStatus,
    h32EntryReadiness: finalGateStatus,
    checklist,
    blockers: mergeSortedUniqueKo(blockers),
    recommendations,
  };
}
