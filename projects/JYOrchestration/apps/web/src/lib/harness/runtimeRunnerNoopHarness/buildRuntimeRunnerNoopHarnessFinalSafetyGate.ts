/**
 * H30.5 — H31 진입 전 no-op harness **final safety gate**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeRunnerNoopHarnessAlignmentReport,
  RuntimeRunnerNoopHarnessBoundaryViolationReport,
  RuntimeRunnerNoopHarnessContractVerificationReport,
  RuntimeRunnerNoopHarnessFinalGateStatus,
  RuntimeRunnerNoopHarnessFinalSafetyGate,
  RuntimeRunnerNoopHarnessPreflightSummary,
  RuntimeRunnerNoopHarnessReadinessVerificationReport,
  RuntimeRunnerNoopHarnessSummary,
} from "./runtimeRunnerNoopHarnessTypes";

export function buildRuntimeRunnerNoopHarnessFinalSafetyGate(input: {
  readonly summary: RuntimeRunnerNoopHarnessSummary;
  readonly preflight: RuntimeRunnerNoopHarnessPreflightSummary;
  readonly contractVerification: RuntimeRunnerNoopHarnessContractVerificationReport;
  readonly boundaryViolation: RuntimeRunnerNoopHarnessBoundaryViolationReport;
  readonly readinessVerification: RuntimeRunnerNoopHarnessReadinessVerificationReport;
  readonly alignmentReport: RuntimeRunnerNoopHarnessAlignmentReport;
}): RuntimeRunnerNoopHarnessFinalSafetyGate {
  const { summary, preflight, contractVerification, boundaryViolation, readinessVerification, alignmentReport } =
    input;

  const blockers: string[] = [];
  if (summary.harnessBlockers.length > 0) {
    blockers.push(...summary.harnessBlockers.slice(0, 3));
  }
  if (preflight.blockers.length > 0) {
    blockers.push(...preflight.blockers.slice(0, 3));
  }
  if (boundaryViolation.actualFlagViolations.length > 0) {
    blockers.push(...boundaryViolation.actualFlagViolations.slice(0, 3));
  }
  if (readinessVerification.verificationStatus === "failed") {
    blockers.push("harness readiness verification failed");
  }
  if (alignmentReport.alignmentStatus === "failed") {
    blockers.push("harness alignment report failed");
  }
  if (contractVerification.verificationStatus === "failed") {
    blockers.push("harness contract verification failed");
  }

  let finalGateStatus: RuntimeRunnerNoopHarnessFinalGateStatus;
  if (
    preflight.preflightReadiness === "blocked" ||
    readinessVerification.verificationStatus === "failed" ||
    alignmentReport.alignmentStatus === "failed" ||
    boundaryViolation.actualFlagViolations.length > 0 ||
    summary.harnessBlockers.length > 0 ||
    contractVerification.verificationStatus === "failed"
  ) {
    finalGateStatus = "blocked";
  } else if (
    preflight.preflightReadiness === "watch" ||
    readinessVerification.verificationStatus === "partial" ||
    alignmentReport.alignmentStatus === "partial" ||
    boundaryViolation.wordingRiskFindings.length > 0
  ) {
    finalGateStatus = "watch";
  } else if (
    preflight.preflightReadiness === "ready_metadata" &&
    readinessVerification.verificationStatus === "verified_metadata" &&
    alignmentReport.alignmentStatus === "aligned_metadata" &&
    contractVerification.verificationStatus === "verified_metadata" &&
    boundaryViolation.actualFlagViolations.length === 0 &&
    summary.harnessBlockers.length === 0
  ) {
    finalGateStatus = "ready_metadata";
  } else {
    finalGateStatus = "not_ready";
  }

  const checklist = mergeSortedUniqueKo([
    `harnessReadiness:${summary.harnessReadiness}`,
    `harnessMode:${summary.harnessMode}`,
    `preflightReadiness:${preflight.preflightReadiness}`,
    `contractVerification:${contractVerification.verificationStatus}`,
    `readinessVerification:${readinessVerification.verificationStatus}`,
    `alignmentStatus:${alignmentReport.alignmentStatus}`,
    `actualFlagViolations:${boundaryViolation.actualFlagViolations.length}`,
    `wordingRiskFindings:${boundaryViolation.wordingRiskFindings.length}`,
    `harnessBlockers:${summary.harnessBlockers.length}`,
    `finalGateStatus:${finalGateStatus}`,
    "h31EntryReadiness:metadata_only_gate",
    "actualRunnerInvocationForbidden:true",
  ]);

  const recommendations = mergeSortedUniqueKo([
    ...(finalGateStatus === "ready_metadata"
      ? ["H30.5: final harness gate ready_metadata — H31 no-op shell metadata gate 후보(invocation 없음)"]
      : []),
    ...(finalGateStatus === "watch"
      ? ["H30.5: final harness gate watch — readiness·alignment·wording risk 재검토"]
      : []),
    ...(finalGateStatus === "blocked"
      ? ["H30.5: final harness gate blocked — violation·blocker·verification 정렬"]
      : []),
    ...(finalGateStatus === "not_ready" ? ["H30.5: final harness gate not_ready — H30 preflight 선행"] : []),
    ...readinessVerification.recommendations,
    ...alignmentReport.recommendations,
    ...boundaryViolation.recommendations,
  ]);

  return {
    mode: "runtime_runner_noop_harness_final_safety_gate",
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
    h31EntryReadiness: finalGateStatus,
    checklist,
    blockers: mergeSortedUniqueKo(blockers),
    recommendations,
  };
}
