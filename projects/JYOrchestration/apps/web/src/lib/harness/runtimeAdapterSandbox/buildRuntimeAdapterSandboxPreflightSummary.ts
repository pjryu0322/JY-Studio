/**
 * H26.5 — sandbox **preflight readiness**(read-only; H27 전 safety gate, 호출 없음).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeAdapterSandboxBlockerReport,
  RuntimeAdapterSandboxBoundaryViolationReport,
  RuntimeAdapterSandboxEnvelopeVerificationReport,
  RuntimeAdapterSandboxPreflightReadiness,
  RuntimeAdapterSandboxPreflightSummary,
  RuntimeAdapterSandboxSummary,
} from "./runtimeAdapterSandboxTypes";

export function buildRuntimeAdapterSandboxPreflightSummary(input: {
  readonly summary: RuntimeAdapterSandboxSummary;
  readonly envelopeVerification: RuntimeAdapterSandboxEnvelopeVerificationReport;
  readonly boundaryViolation: RuntimeAdapterSandboxBoundaryViolationReport;
  readonly blockerReport: RuntimeAdapterSandboxBlockerReport;
}): RuntimeAdapterSandboxPreflightSummary {
  const { summary, envelopeVerification, boundaryViolation, blockerReport } = input;

  const checklist = mergeSortedUniqueKo([
    "sandbox summary exists",
    "input envelope exists",
    "output envelope exists",
    "sandbox policy exists",
    "sandbox result metadata exists",
    "envelope verification report exists",
    "boundary violation report exists",
    `sandboxReadiness:${summary.sandboxReadiness}`,
    `envelopeVerification:${envelopeVerification.verificationStatus}`,
    `actualFlagViolations:${boundaryViolation.actualFlagViolations.length}`,
    `wordingRiskFindings:${boundaryViolation.wordingRiskFindings.length}`,
    `sandboxBlockers:${blockerReport.blockers.length}`,
    "overlayWordingStabilized:H26.5",
    "diagnosticBundleIncludesSandboxPreflight:metadata",
  ]);

  const blockers: string[] = [];
  if (blockerReport.blockers.length > 0) {
    blockers.push(...blockerReport.blockers.slice(0, 3));
  }
  if (boundaryViolation.actualFlagViolations.length > 0) {
    blockers.push(...boundaryViolation.actualFlagViolations.slice(0, 3));
  }
  if (envelopeVerification.verificationStatus === "failed") {
    blockers.push("sandbox envelope verification failed");
  }
  if (summary.sandboxReadiness === "blocked") {
    blockers.push("sandbox readiness blocked");
  }

  let preflightReadiness: RuntimeAdapterSandboxPreflightReadiness;
  if (
    boundaryViolation.actualFlagViolations.length > 0 ||
    summary.sandboxReadiness === "blocked" ||
    envelopeVerification.verificationStatus === "failed" ||
    blockerReport.blockers.length > 0
  ) {
    preflightReadiness = "blocked";
  } else if (
    summary.sandboxReadiness === "watch" ||
    envelopeVerification.verificationStatus === "partial" ||
    boundaryViolation.wordingRiskFindings.length > 0
  ) {
    preflightReadiness = "watch";
  } else if (
    summary.sandboxReadiness === "sandbox_metadata_ready" &&
    envelopeVerification.verificationStatus === "verified_metadata" &&
    boundaryViolation.actualFlagViolations.length === 0 &&
    boundaryViolation.wordingRiskFindings.length === 0 &&
    blockerReport.blockers.length === 0
  ) {
    preflightReadiness = "ready_metadata";
  } else {
    preflightReadiness = "not_ready";
  }

  const recommendations = mergeSortedUniqueKo([
    ...(preflightReadiness === "ready_metadata"
      ? ["H26.5: sandbox preflight ready_metadata — H27 전 gate 통과(호출 없음)"]
      : []),
    ...(preflightReadiness === "watch"
      ? ["H26.5: sandbox preflight watch — envelope·wording risk 재검토"]
      : []),
    ...(preflightReadiness === "blocked"
      ? ["H26.5: sandbox preflight blocked — violation·envelope 정렬 후 재평가"]
      : []),
    ...(preflightReadiness === "not_ready" ? ["H26.5: sandbox preflight not_ready — H26 envelope 정렬"] : []),
  ]);

  return {
    mode: "runtime_adapter_sandbox_preflight_summary",
    actualRuntimeOrchestrationEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualSandboxInvocationEnabled: false,
    actualExecutionEnabled: false,
    actualProviderRoutingEnabled: false,
    actualQueueControlEnabled: false,
    actualRollbackExecutionEnabled: false,
    preflightReadiness,
    checklist,
    blockers: mergeSortedUniqueKo(blockers),
    recommendations,
  };
}
