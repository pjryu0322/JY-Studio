/**
 * H33 — shell hardening **preflight readiness**(read-only; H34 전 gate, shell execution 없음).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeNoopShellHardeningBoundaryViolationReport,
  RuntimeNoopShellHardeningContractVerificationReport,
  RuntimeNoopShellHardeningPreflightReadiness,
  RuntimeNoopShellHardeningPreflightSummary,
  RuntimeNoopShellHardeningSummary,
  RuntimeNoopShellNoExecutionResultMetadata,
} from "./runtimeNoopShellHardeningTypes";

export function buildRuntimeNoopShellHardeningPreflightSummary(input: {
  readonly summary: RuntimeNoopShellHardeningSummary;
  readonly contractVerification: RuntimeNoopShellHardeningContractVerificationReport;
  readonly boundaryViolation: RuntimeNoopShellHardeningBoundaryViolationReport;
  readonly result: RuntimeNoopShellNoExecutionResultMetadata;
}): RuntimeNoopShellHardeningPreflightSummary {
  const { summary, contractVerification, boundaryViolation, result } = input;

  const checklist = mergeSortedUniqueKo([
    "shell hardening summary exists",
    "shell hardening contract exists",
    "shell hardening input envelope exists",
    "shell hardening output envelope exists",
    "shell no-execution result metadata exists",
    "shell hardening safety guard exists",
    "contract verification report exists",
    "boundary violation report exists",
    `hardeningReadiness:${summary.hardeningReadiness}`,
    `hardeningMode:${summary.hardeningMode}`,
    `contractVerification:${contractVerification.verificationStatus}`,
    `actualFlagViolations:${boundaryViolation.actualFlagViolations.length}`,
    `wordingRiskFindings:${boundaryViolation.wordingRiskFindings.length}`,
    `hardeningBlockers:${summary.hardeningBlockers.length}`,
    `diagnosticOnly:${result.diagnosticOnly}`,
    "overlayWordingStabilized:H33",
    "diagnosticBundleIncludesShellHardeningPreflight:metadata",
  ]);

  const blockers: string[] = [];
  if (summary.hardeningBlockers.length > 0) {
    blockers.push(...summary.hardeningBlockers.slice(0, 3));
  }
  if (boundaryViolation.actualFlagViolations.length > 0) {
    blockers.push(...boundaryViolation.actualFlagViolations.slice(0, 3));
  }
  if (contractVerification.verificationStatus === "failed") {
    blockers.push("shell hardening contract verification failed");
  }
  if (summary.hardeningReadiness === "blocked") {
    blockers.push("shell hardening readiness blocked");
  }
  if (result.diagnosticOnly !== true) {
    blockers.push("shell no-execution result metadata not diagnosticOnly");
  }

  let preflightReadiness: RuntimeNoopShellHardeningPreflightReadiness;
  if (
    boundaryViolation.actualFlagViolations.length > 0 ||
    summary.hardeningReadiness === "blocked" ||
    contractVerification.verificationStatus === "failed" ||
    summary.hardeningBlockers.length > 0 ||
    result.diagnosticOnly !== true
  ) {
    preflightReadiness = "blocked";
  } else if (
    summary.hardeningReadiness === "watch" ||
    contractVerification.verificationStatus === "partial" ||
    boundaryViolation.wordingRiskFindings.length > 0
  ) {
    preflightReadiness = "watch";
  } else if (
    summary.hardeningReadiness === "hardening_metadata_ready" &&
    contractVerification.verificationStatus === "verified_metadata" &&
    boundaryViolation.actualFlagViolations.length === 0 &&
    boundaryViolation.wordingRiskFindings.length === 0 &&
    summary.hardeningBlockers.length === 0 &&
    result.diagnosticOnly === true
  ) {
    preflightReadiness = "ready_metadata";
  } else {
    preflightReadiness = "not_ready";
  }

  const recommendations = mergeSortedUniqueKo([
    ...(preflightReadiness === "ready_metadata"
      ? ["H33: shell hardening preflight ready_metadata — H34 전 gate 통과(shell execution 없음)"]
      : []),
    ...(preflightReadiness === "watch"
      ? ["H33: shell hardening preflight watch — contract·wording risk 재검토"]
      : []),
    ...(preflightReadiness === "blocked"
      ? ["H33: shell hardening preflight blocked — violation·contract 정렬 후 재평가"]
      : []),
    ...(preflightReadiness === "not_ready" ? ["H33: shell hardening preflight not_ready — H31.5 gate 정렬"] : []),
    ...contractVerification.recommendations,
    ...boundaryViolation.recommendations,
  ]);

  return {
    mode: "runtime_noop_shell_hardening_preflight_summary",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualNoopShellExecutionEnabled: false,
    actualExecutionShellExecutionEnabled: false,
    preflightReadiness,
    checklist,
    blockers: mergeSortedUniqueKo(blockers),
    recommendations,
  };
}
