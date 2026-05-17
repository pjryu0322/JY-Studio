/**
 * H33 — shell hardening contract·envelope·result·guard **정합성 검증**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeNoopShellHardeningContract,
  RuntimeNoopShellHardeningContractVerificationReport,
  RuntimeNoopShellHardeningInputEnvelope,
  RuntimeNoopShellHardeningOutputEnvelope,
  RuntimeNoopShellHardeningSafetyGuard,
  RuntimeNoopShellHardeningSummary,
  RuntimeNoopShellNoExecutionResultMetadata,
} from "./runtimeNoopShellHardeningTypes";

function envelopeHas(envelopeRows: readonly string[], prefix: string): boolean {
  return envelopeRows.some((row) => row.startsWith(prefix));
}

export function verifyRuntimeNoopShellHardeningContract(input: {
  readonly contract: RuntimeNoopShellHardeningContract;
  readonly summary: RuntimeNoopShellHardeningSummary;
  readonly inputEnvelope: RuntimeNoopShellHardeningInputEnvelope;
  readonly outputEnvelope: RuntimeNoopShellHardeningOutputEnvelope;
  readonly result: RuntimeNoopShellNoExecutionResultMetadata;
  readonly safetyGuard: RuntimeNoopShellHardeningSafetyGuard;
}): RuntimeNoopShellHardeningContractVerificationReport {
  const { contract, summary, inputEnvelope, outputEnvelope, result, safetyGuard } = input;
  const findings: string[] = [];

  if (contract.requiredInputMetadata.length === 0) {
    findings.push("contract requiredInputMetadata empty");
  }
  if (!envelopeHas(inputEnvelope.envelopeRows, "finalGateStatus:")) {
    findings.push("input envelope missing shell final safety gate row");
  }
  if (!envelopeHas(inputEnvelope.envelopeRows, "readinessVerification:")) {
    findings.push("input envelope missing shell readiness verification row");
  }
  if (!envelopeHas(inputEnvelope.envelopeRows, "boundaryViolations:")) {
    findings.push("input envelope missing shell boundary violation row");
  }
  if (!envelopeHas(outputEnvelope.envelopeRows, "noExecutionDiagnosticOnly:")) {
    findings.push("output envelope missing no-execution result metadata row");
  }
  if (result.diagnosticOnly !== true) {
    findings.push("noExecution result diagnosticOnly not true");
  }
  if (result.noopShellExecuted !== false) {
    findings.push("noExecution result noopShellExecuted not false");
  }
  if (result.executionShellExecuted !== false) {
    findings.push("noExecution result executionShellExecuted not false");
  }
  if (result.runtimeAdapterInvoked !== false) {
    findings.push("noExecution result runtimeAdapterInvoked not false");
  }
  if (result.executionPerformed !== false) {
    findings.push("noExecution result executionPerformed not false");
  }
  if (result.providerRoutingPerformed !== false) {
    findings.push("noExecution result providerRoutingPerformed not false");
  }
  if (result.queueControlPerformed !== false) {
    findings.push("noExecution result queueControlPerformed not false");
  }
  if (result.rollbackPerformed !== false) {
    findings.push("noExecution result rollbackPerformed not false");
  }
  if (result.promptMutated !== false) {
    findings.push("noExecution result promptMutated not false");
  }
  if (safetyGuard.actualShellExecutionForbidden !== true) {
    findings.push("safetyGuard.actualShellExecutionForbidden not true");
  }
  if (safetyGuard.actualAdapterInvocationForbidden !== true) {
    findings.push("safetyGuard.actualAdapterInvocationForbidden not true");
  }
  if (safetyGuard.actualExecutionForbidden !== true) {
    findings.push("safetyGuard.actualExecutionForbidden not true");
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
    summary.hardeningReadiness === "hardening_metadata_ready" &&
    summary.hardeningMode !== "contract_verification_only"
  ) {
    findings.push(
      `hardeningMode(${summary.hardeningMode}) must be contract_verification_only when hardeningReadiness hardening_metadata_ready`
    );
  }

  let verificationStatus: RuntimeNoopShellHardeningContractVerificationReport["verificationStatus"];
  if (findings.length === 0) {
    verificationStatus = "verified_metadata";
  } else if (
    findings.some(
      (f) =>
        f.includes("diagnosticOnly") ||
        f.includes("noopShellExecuted") ||
        f.includes("executionShellExecuted") ||
        f.includes("actualShellExecutionForbidden") ||
        f.includes("hardeningMode")
    )
  ) {
    verificationStatus = "failed";
  } else {
    verificationStatus = "partial";
  }

  const recommendations = mergeSortedUniqueKo([
    ...(verificationStatus === "verified_metadata"
      ? ["H33: shell hardening contract verified_metadata — H34 entry gate 후보(shell execution 없음)"]
      : []),
    ...(verificationStatus === "partial"
      ? ["H33: shell hardening contract partial — input/output envelope·guard 정합성 재검토"]
      : []),
    ...(verificationStatus === "failed"
      ? ["H33: shell hardening contract failed — no-execution result·guard·mode alignment 정렬"]
      : []),
  ]);

  return {
    mode: "runtime_noop_shell_hardening_contract_verification_report",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualNoopShellExecutionEnabled: false,
    actualExecutionShellExecutionEnabled: false,
    verificationStatus,
    findings: mergeSortedUniqueKo(findings),
    recommendations,
  };
}
