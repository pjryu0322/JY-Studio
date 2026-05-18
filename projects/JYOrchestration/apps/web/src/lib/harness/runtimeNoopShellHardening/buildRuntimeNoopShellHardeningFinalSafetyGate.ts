/**
 * H33.5 — H34 진입 전 no-op shell hardening **final safety gate**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeNoopShellHardeningAlignmentReport,
  RuntimeNoopShellHardeningBoundaryViolationReport,
  RuntimeNoopShellHardeningContractVerificationReport,
  RuntimeNoopShellHardeningFinalGateStatus,
  RuntimeNoopShellHardeningFinalSafetyGate,
  RuntimeNoopShellHardeningPreflightSummary,
  RuntimeNoopShellHardeningReadinessVerificationReport,
  RuntimeNoopShellHardeningSummary,
} from "./runtimeNoopShellHardeningTypes";

export function buildRuntimeNoopShellHardeningFinalSafetyGate(input: {
  readonly summary: RuntimeNoopShellHardeningSummary;
  readonly preflight: RuntimeNoopShellHardeningPreflightSummary;
  readonly readinessVerification: RuntimeNoopShellHardeningReadinessVerificationReport;
  readonly alignmentReport: RuntimeNoopShellHardeningAlignmentReport;
  readonly contractVerification: RuntimeNoopShellHardeningContractVerificationReport;
  readonly boundaryViolation: RuntimeNoopShellHardeningBoundaryViolationReport;
}): RuntimeNoopShellHardeningFinalSafetyGate {
  const { summary, preflight, readinessVerification, alignmentReport, contractVerification, boundaryViolation } =
    input;

  const blockers: string[] = [];
  if (summary.hardeningBlockers.length > 0) {
    blockers.push(...summary.hardeningBlockers.slice(0, 3));
  }
  if (preflight.blockers.length > 0) {
    blockers.push(...preflight.blockers.slice(0, 3));
  }
  if (boundaryViolation.actualFlagViolations.length > 0) {
    blockers.push(...boundaryViolation.actualFlagViolations.slice(0, 3));
  }
  if (readinessVerification.verificationStatus === "failed") {
    blockers.push("shell hardening readiness verification failed");
  }
  if (alignmentReport.alignmentStatus === "failed") {
    blockers.push("shell hardening alignment failed");
  }

  let finalGateStatus: RuntimeNoopShellHardeningFinalGateStatus;
  if (
    preflight.preflightReadiness === "blocked" ||
    readinessVerification.verificationStatus === "failed" ||
    alignmentReport.alignmentStatus === "failed" ||
    boundaryViolation.actualFlagViolations.length > 0 ||
    summary.hardeningBlockers.length > 0 ||
    summary.hardeningReadiness === "blocked"
  ) {
    finalGateStatus = "blocked";
  } else if (
    preflight.preflightReadiness === "watch" ||
    readinessVerification.verificationStatus === "partial" ||
    alignmentReport.alignmentStatus === "partial" ||
    boundaryViolation.wordingRiskFindings.length > 0 ||
    summary.hardeningReadiness === "watch"
  ) {
    finalGateStatus = "watch";
  } else if (
    preflight.preflightReadiness === "ready_metadata" &&
    readinessVerification.verificationStatus === "verified_metadata" &&
    alignmentReport.alignmentStatus === "aligned_metadata" &&
    contractVerification.verificationStatus === "verified_metadata" &&
    boundaryViolation.actualFlagViolations.length === 0 &&
    summary.hardeningBlockers.length === 0 &&
    summary.hardeningReadiness === "hardening_metadata_ready"
  ) {
    finalGateStatus = "ready_metadata";
  } else {
    finalGateStatus = "not_ready";
  }

  const checklist = mergeSortedUniqueKo([
    `hardeningReadiness:${summary.hardeningReadiness}`,
    `hardeningMode:${summary.hardeningMode}`,
    `preflightReadiness:${preflight.preflightReadiness}`,
    `readinessVerification:${readinessVerification.verificationStatus}`,
    `alignmentStatus:${alignmentReport.alignmentStatus}`,
    `contractVerification:${contractVerification.verificationStatus}`,
    `actualFlagViolations:${boundaryViolation.actualFlagViolations.length}`,
    `wordingRiskFindings:${boundaryViolation.wordingRiskFindings.length}`,
    `hardeningBlockers:${summary.hardeningBlockers.length}`,
    `finalGateStatus:${finalGateStatus}`,
    "h34EntryReadiness:metadata_only_gate",
    "actualShellExecutionForbidden:true",
  ]);

  const recommendations = mergeSortedUniqueKo([
    ...(finalGateStatus === "ready_metadata"
      ? ["H33.5: shell hardening final gate ready_metadata — H34 metadata shell gate 후보(shell execution 없음)"]
      : []),
    ...(finalGateStatus === "watch"
      ? ["H33.5: shell hardening final gate watch — readiness·alignment·wording risk 재검토"]
      : []),
    ...(finalGateStatus === "blocked"
      ? ["H33.5: shell hardening final gate blocked — violation·blocker·verification 정렬"]
      : []),
    ...(finalGateStatus === "not_ready" ? ["H33.5: shell hardening final gate not_ready — H33 hardening 선행"] : []),
    ...readinessVerification.recommendations,
    ...alignmentReport.recommendations,
    ...boundaryViolation.recommendations,
  ]);

  return {
    mode: "runtime_noop_shell_hardening_final_safety_gate",
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
    h34EntryReadiness: finalGateStatus,
    checklist,
    blockers: mergeSortedUniqueKo(blockers),
    recommendations,
  };
}
