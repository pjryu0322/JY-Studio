/**
 * H25.5 — no-op adapter **preflight readiness**(read-only; H26 전 safety gate, 실행 없음).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeAdapterInvocationGuardReport,
  RuntimeNoopAdapterBoundaryViolationReport,
  RuntimeNoopAdapterPreflightReadiness,
  RuntimeNoopAdapterPreflightSummary,
  RuntimeNoopAdapterResultMetadata,
  RuntimeNoopAdapterSummary,
  RuntimePilotContractVerificationReport,
} from "./runtimeNoopAdapterTypes";

export function buildRuntimeNoopAdapterPreflightSummary(input: {
  readonly summary: RuntimeNoopAdapterSummary;
  readonly verification: RuntimePilotContractVerificationReport;
  readonly result: RuntimeNoopAdapterResultMetadata;
  readonly guard: RuntimeAdapterInvocationGuardReport;
  readonly violations: RuntimeNoopAdapterBoundaryViolationReport;
}): RuntimeNoopAdapterPreflightSummary {
  const { summary, verification, result, guard, violations } = input;

  const checklist = mergeSortedUniqueKo([
    "no-op adapter summary exists",
    "contract verification report exists",
    "no-op result metadata exists",
    "adapter invocation guard exists",
    "boundary violation report exists",
    "actual adapter invocation disabled",
    "actual execution disabled",
    "actual provider routing disabled",
    "actual queue control disabled",
    "actual rollback disabled",
    `noopAdapterStatus:${summary.noopAdapterStatus}`,
    `contractVerification:${verification.verificationStatus}`,
    `invocationGuard:${guard.invocationGuard}`,
    `actualFlagViolations:${violations.actualFlagViolations.length}`,
    `wordingRiskFindings:${violations.wordingRiskFindings.length}`,
    `resultDiagnosticOnly:${result.diagnosticOnly}`,
    `resultAdapterInvoked:${result.adapterInvoked}`,
    "overlayWordingStabilized:H25.5",
    "diagnosticBundleIncludesPreflight:metadata",
  ]);

  const blockers: string[] = [];
  if (violations.actualFlagViolations.length > 0) {
    blockers.push(...violations.actualFlagViolations.slice(0, 3));
  }
  if (verification.verificationStatus === "failed") {
    blockers.push("contract verification failed");
  }
  if (guard.invocationGuard === "always_blocked") {
    blockers.push("adapter invocation guard always_blocked");
  }
  if (summary.noopAdapterStatus === "blocked") {
    blockers.push("noop adapter status blocked");
  }

  let preflightReadiness: RuntimeNoopAdapterPreflightReadiness;
  if (
    violations.actualFlagViolations.length > 0 ||
    summary.noopAdapterStatus === "blocked" ||
    verification.verificationStatus === "failed" ||
    guard.invocationGuard === "always_blocked"
  ) {
    preflightReadiness = "blocked";
  } else if (
    summary.noopAdapterStatus === "watch" ||
    violations.wordingRiskFindings.length > 0 ||
    verification.verificationStatus === "partial"
  ) {
    preflightReadiness = "watch";
  } else if (
    summary.noopAdapterStatus === "contract_verified_noop" &&
    verification.verificationStatus === "verified_noop" &&
    guard.invocationGuard === "contract_metadata_only" &&
    violations.actualFlagViolations.length === 0 &&
    violations.wordingRiskFindings.length === 0
  ) {
    preflightReadiness = "ready_metadata";
  } else {
    preflightReadiness = "not_ready";
  }

  const recommendations = mergeSortedUniqueKo([
    ...(preflightReadiness === "ready_metadata"
      ? ["H25.5: preflight ready_metadata — H26 전 no-op gate 통과(실행 없음)"]
      : []),
    ...(preflightReadiness === "watch"
      ? ["H25.5: preflight watch — contract·wording risk 재검토"]
      : []),
    ...(preflightReadiness === "blocked"
      ? ["H25.5: preflight blocked — violation·contract 정렬 후 재평가"]
      : []),
    ...(preflightReadiness === "not_ready" ? ["H25.5: preflight not_ready — H24.5 contract·skeleton 정렬"] : []),
  ]);

  return {
    mode: "runtime_noop_adapter_preflight_summary",
    actualRuntimeOrchestrationEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
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
