/**
 * H30 — no-op harness contract·envelope·result·guard **정합성 검증**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeRunnerNoopHarnessContractVerificationReport,
  RuntimeRunnerNoopHarnessSafetyGuard,
  RuntimeRunnerNoopHarnessSummary,
  RuntimeRunnerNoopInvocationEnvelope,
  RuntimeRunnerNoopResultMetadata,
} from "./runtimeRunnerNoopHarnessTypes";

function envelopeHas(envelopeRows: readonly string[], prefix: string): boolean {
  return envelopeRows.some((row) => row.startsWith(prefix));
}

export function verifyRuntimeRunnerNoopHarnessContract(input: {
  readonly summary: RuntimeRunnerNoopHarnessSummary;
  readonly envelope: RuntimeRunnerNoopInvocationEnvelope;
  readonly result: RuntimeRunnerNoopResultMetadata;
  readonly safetyGuard: RuntimeRunnerNoopHarnessSafetyGuard;
}): RuntimeRunnerNoopHarnessContractVerificationReport {
  const { summary, envelope, result, safetyGuard } = input;
  const findings: string[] = [];

  if (!envelopeHas(envelope.envelopeRows, "finalGateStatus:")) {
    findings.push("envelope missing runner invocation final gate row");
  }
  if (!envelopeHas(envelope.envelopeRows, "candidateStatus:")) {
    findings.push("envelope missing runner invocation summary row");
  }
  if (!envelopeHas(envelope.envelopeRows, "invocationAllowedMode:")) {
    findings.push("envelope missing invocation policy row");
  }
  if (!envelopeHas(envelope.envelopeRows, "readinessVerification:")) {
    findings.push("envelope missing runner invocation readiness verification row");
  }
  if (!envelopeHas(envelope.envelopeRows, "boundaryViolations:")) {
    findings.push("envelope missing runner invocation boundary violation row");
  }
  if (!envelopeHas(envelope.envelopeRows, "skeletonPreflight:")) {
    findings.push("envelope missing pilot skeleton preflight row");
  }
  if (!envelopeHas(envelope.envelopeRows, "runnerContractVerification:")) {
    findings.push("envelope missing runner contract verification row");
  }
  if (!envelopeHas(envelope.envelopeRows, "noExecutionDiagnosticOnly:")) {
    findings.push("envelope missing no-execution result row");
  }
  if (result.diagnosticOnly !== true) {
    findings.push("noop result diagnosticOnly not true");
  }
  if (result.isolatedRunnerInvoked !== false) {
    findings.push("noop result isolatedRunnerInvoked not false");
  }
  if (result.dryRunRunnerExecuted !== false) {
    findings.push("noop result dryRunRunnerExecuted not false");
  }
  if (safetyGuard.actualInvocationForbidden !== true) {
    findings.push("safetyGuard.actualInvocationForbidden not true");
  }
  if (safetyGuard.actualExecutionForbidden !== true) {
    findings.push("safetyGuard.actualExecutionForbidden not true");
  }
  if (safetyGuard.actualAdapterInvocationForbidden !== true) {
    findings.push("safetyGuard.actualAdapterInvocationForbidden not true");
  }
  if (safetyGuard.actualProviderRoutingForbidden !== true) {
    findings.push("safetyGuard.actualProviderRoutingForbidden not true");
  }
  if (safetyGuard.actualQueueControlForbidden !== true) {
    findings.push("safetyGuard.actualQueueControlForbidden not true");
  }
  if (safetyGuard.actualRollbackForbidden !== true) {
    findings.push("safetyGuard.actualRollbackForbidden not true");
  }
  if (safetyGuard.actualPromptMutationForbidden !== true) {
    findings.push("safetyGuard.actualPromptMutationForbidden not true");
  }
  if (
    summary.harnessReadiness === "noop_harness_metadata_ready" &&
    summary.harnessMode !== "noop_contract_only"
  ) {
    findings.push(
      `harnessMode(${summary.harnessMode}) must be noop_contract_only when harnessReadiness noop_harness_metadata_ready`
    );
  }

  let verificationStatus: RuntimeRunnerNoopHarnessContractVerificationReport["verificationStatus"];
  if (findings.length === 0) {
    verificationStatus = "verified_metadata";
  } else if (
    findings.some(
      (f) =>
        f.includes("diagnosticOnly") ||
        f.includes("isolatedRunnerInvoked") ||
        f.includes("actualInvocationForbidden") ||
        f.includes("harnessMode")
    )
  ) {
    verificationStatus = "failed";
  } else {
    verificationStatus = "partial";
  }

  const recommendations = mergeSortedUniqueKo([
    ...(verificationStatus === "verified_metadata"
      ? ["H30: no-op harness contract verified_metadata — H31 entry gate 후보(invocation 없음)"]
      : []),
    ...(verificationStatus === "partial"
      ? ["H30: no-op harness contract partial — envelope·result·guard 정합성 재검토"]
      : []),
    ...(verificationStatus === "failed"
      ? ["H30: no-op harness contract failed — noop result·guard·mode alignment 정렬"]
      : []),
  ]);

  return {
    mode: "runtime_runner_noop_harness_contract_verification_report",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualIsolatedRunnerInvocationEnabled: false,
    actualDryRunRunnerInvocationEnabled: false,
    verificationStatus,
    findings: mergeSortedUniqueKo(findings),
    recommendations,
  };
}
