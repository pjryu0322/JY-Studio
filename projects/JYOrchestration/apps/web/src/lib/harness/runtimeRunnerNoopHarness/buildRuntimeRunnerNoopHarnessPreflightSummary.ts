/**
 * H30 — no-op harness **preflight readiness**(read-only; H31 전 gate, runner invocation 없음).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeRunnerNoopHarnessBoundaryViolationReport,
  RuntimeRunnerNoopHarnessContractVerificationReport,
  RuntimeRunnerNoopHarnessPreflightReadiness,
  RuntimeRunnerNoopHarnessPreflightSummary,
  RuntimeRunnerNoopHarnessSummary,
  RuntimeRunnerNoopResultMetadata,
} from "./runtimeRunnerNoopHarnessTypes";

export function buildRuntimeRunnerNoopHarnessPreflightSummary(input: {
  readonly summary: RuntimeRunnerNoopHarnessSummary;
  readonly contractVerification: RuntimeRunnerNoopHarnessContractVerificationReport;
  readonly boundaryViolation: RuntimeRunnerNoopHarnessBoundaryViolationReport;
  readonly result: RuntimeRunnerNoopResultMetadata;
}): RuntimeRunnerNoopHarnessPreflightSummary {
  const { summary, contractVerification, boundaryViolation, result } = input;

  const checklist = mergeSortedUniqueKo([
    "noop harness summary exists",
    "noop invocation envelope exists",
    "noop result metadata exists",
    "harness safety guard exists",
    "contract verification report exists",
    "boundary violation report exists",
    `harnessReadiness:${summary.harnessReadiness}`,
    `harnessMode:${summary.harnessMode}`,
    `contractVerification:${contractVerification.verificationStatus}`,
    `actualFlagViolations:${boundaryViolation.actualFlagViolations.length}`,
    `wordingRiskFindings:${boundaryViolation.wordingRiskFindings.length}`,
    `harnessBlockers:${summary.harnessBlockers.length}`,
    `diagnosticOnly:${result.diagnosticOnly}`,
    "overlayWordingStabilized:H30",
    "diagnosticBundleIncludesNoopHarnessPreflight:metadata",
  ]);

  const blockers: string[] = [];
  if (summary.harnessBlockers.length > 0) {
    blockers.push(...summary.harnessBlockers.slice(0, 3));
  }
  if (boundaryViolation.actualFlagViolations.length > 0) {
    blockers.push(...boundaryViolation.actualFlagViolations.slice(0, 3));
  }
  if (contractVerification.verificationStatus === "failed") {
    blockers.push("noop harness contract verification failed");
  }
  if (summary.harnessReadiness === "blocked") {
    blockers.push("noop harness readiness blocked");
  }
  if (result.diagnosticOnly !== true) {
    blockers.push("noop result metadata not diagnosticOnly");
  }

  let preflightReadiness: RuntimeRunnerNoopHarnessPreflightReadiness;
  if (
    boundaryViolation.actualFlagViolations.length > 0 ||
    summary.harnessReadiness === "blocked" ||
    contractVerification.verificationStatus === "failed" ||
    summary.harnessBlockers.length > 0 ||
    result.diagnosticOnly !== true
  ) {
    preflightReadiness = "blocked";
  } else if (
    summary.harnessReadiness === "watch" ||
    contractVerification.verificationStatus === "partial" ||
    boundaryViolation.wordingRiskFindings.length > 0
  ) {
    preflightReadiness = "watch";
  } else if (
    summary.harnessReadiness === "noop_harness_metadata_ready" &&
    contractVerification.verificationStatus === "verified_metadata" &&
    boundaryViolation.actualFlagViolations.length === 0 &&
    boundaryViolation.wordingRiskFindings.length === 0 &&
    summary.harnessBlockers.length === 0 &&
    result.diagnosticOnly === true
  ) {
    preflightReadiness = "ready_metadata";
  } else {
    preflightReadiness = "not_ready";
  }

  const recommendations = mergeSortedUniqueKo([
    ...(preflightReadiness === "ready_metadata"
      ? ["H30: no-op harness preflight ready_metadata — H31 전 gate 통과(invocation 없음)"]
      : []),
    ...(preflightReadiness === "watch"
      ? ["H30: no-op harness preflight watch — contract·wording risk 재검토"]
      : []),
    ...(preflightReadiness === "blocked"
      ? ["H30: no-op harness preflight blocked — violation·contract 정렬 후 재평가"]
      : []),
    ...(preflightReadiness === "not_ready" ? ["H30: no-op harness preflight not_ready — H29.5 gate 정렬"] : []),
    ...contractVerification.recommendations,
    ...boundaryViolation.recommendations,
  ]);

  return {
    mode: "runtime_runner_noop_harness_preflight_summary",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualIsolatedRunnerInvocationEnabled: false,
    actualIsolatedRunnerExecutionEnabled: false,
    actualDryRunRunnerInvocationEnabled: false,
    actualDryRunRunnerExecutionEnabled: false,
    preflightReadiness,
    checklist,
    blockers: mergeSortedUniqueKo(blockers),
    recommendations,
  };
}
