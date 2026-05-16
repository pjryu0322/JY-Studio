/**
 * H30.5 — no-op harness summary·preflight·contract·boundary **정합성 검증**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeRunnerNoopHarnessBoundaryViolationReport,
  RuntimeRunnerNoopHarnessContractVerificationReport,
  RuntimeRunnerNoopHarnessPreflightSummary,
  RuntimeRunnerNoopHarnessReadinessVerificationReport,
  RuntimeRunnerNoopHarnessSafetyGuard,
  RuntimeRunnerNoopHarnessSummary,
  RuntimeRunnerNoopResultMetadata,
} from "./runtimeRunnerNoopHarnessTypes";

export function verifyRuntimeRunnerNoopHarnessReadiness(input: {
  readonly summary: RuntimeRunnerNoopHarnessSummary;
  readonly preflight: RuntimeRunnerNoopHarnessPreflightSummary;
  readonly contractVerification: RuntimeRunnerNoopHarnessContractVerificationReport;
  readonly boundaryViolation: RuntimeRunnerNoopHarnessBoundaryViolationReport;
  readonly result: RuntimeRunnerNoopResultMetadata;
  readonly safetyGuard: RuntimeRunnerNoopHarnessSafetyGuard;
}): RuntimeRunnerNoopHarnessReadinessVerificationReport {
  const { summary, preflight, contractVerification, boundaryViolation, result, safetyGuard } = input;
  const findings: string[] = [];

  if (
    summary.harnessReadiness === "noop_harness_metadata_ready" &&
    summary.harnessMode !== "noop_contract_only"
  ) {
    findings.push(
      `harnessMode(${summary.harnessMode}) must be noop_contract_only when harnessReadiness noop_harness_metadata_ready`
    );
  }
  if (summary.harnessReadiness === "blocked" && summary.harnessBlockers.length === 0) {
    findings.push("blocked harnessReadiness requires harnessBlockers");
  }
  if (
    preflight.preflightReadiness === "ready_metadata" &&
    contractVerification.verificationStatus !== "verified_metadata"
  ) {
    findings.push("preflight ready_metadata requires contract verification verified_metadata");
  }
  if (
    preflight.preflightReadiness === "ready_metadata" &&
    boundaryViolation.actualFlagViolations.length > 0
  ) {
    findings.push("preflight ready_metadata requires empty boundary actualFlagViolations");
  }
  if (preflight.preflightReadiness === "ready_metadata" && result.diagnosticOnly !== true) {
    findings.push("preflight ready_metadata requires result diagnosticOnly true");
  }
  if (preflight.preflightReadiness === "ready_metadata" && safetyGuard.actualInvocationForbidden !== true) {
    findings.push("preflight ready_metadata requires safetyGuard actualInvocationForbidden true");
  }
  if (
    contractVerification.verificationStatus === "failed" &&
    preflight.preflightReadiness === "ready_metadata"
  ) {
    findings.push("contract failed incompatible with preflight ready_metadata");
  }
  if (
    boundaryViolation.actualFlagViolations.length > 0 &&
    preflight.preflightReadiness === "ready_metadata"
  ) {
    findings.push("boundary violations incompatible with preflight ready_metadata");
  }
  if (
    boundaryViolation.actualFlagViolations.length > 0 &&
    preflight.preflightReadiness !== "blocked"
  ) {
    findings.push("boundary actualFlagViolations require preflight blocked");
  }
  if (preflight.blockers.length > 0 && preflight.preflightReadiness === "ready_metadata") {
    findings.push("preflight blockers incompatible with ready_metadata");
  }

  let verificationStatus: RuntimeRunnerNoopHarnessReadinessVerificationReport["verificationStatus"];
  if (findings.length === 0) {
    verificationStatus = "verified_metadata";
  } else if (
    findings.some(
      (f) =>
        f.includes("diagnosticOnly") ||
        f.includes("actualInvocationForbidden") ||
        f.includes("contract failed") ||
        f.includes("boundary violations incompatible") ||
        f.includes("blocked harnessReadiness")
    )
  ) {
    verificationStatus = "failed";
  } else {
    verificationStatus = "partial";
  }

  const recommendations = mergeSortedUniqueKo([
    ...(verificationStatus === "verified_metadata"
      ? ["H30.5: harness readiness verified_metadata — H31 entry gate 후보(invocation 없음)"]
      : []),
    ...(verificationStatus === "partial"
      ? ["H30.5: harness readiness partial — summary·preflight·contract 정합성 재검토"]
      : []),
    ...(verificationStatus === "failed"
      ? ["H30.5: harness readiness failed — blocker·boundary·diagnosticOnly alignment 정렬"]
      : []),
  ]);

  return {
    mode: "runtime_runner_noop_harness_readiness_verification_report",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualIsolatedRunnerInvocationEnabled: false,
    actualDryRunRunnerInvocationEnabled: false,
    verificationStatus,
    findings: mergeSortedUniqueKo(findings),
    recommendations,
  };
}
