/**
 * H28.5 — dry-run runner contract·envelope·safety guard **정합성 검증**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeDryRunRunnerContract,
  RuntimePilotRunnerContractVerificationReport,
  RuntimePilotRunnerInputEnvelope,
  RuntimePilotRunnerOutputEnvelope,
  RuntimePilotRunnerSafetyGuard,
  RuntimePilotSkeletonSummary,
} from "./runtimePilotSkeletonTypes";

export function verifyRuntimePilotRunnerContract(input: {
  readonly summary: RuntimePilotSkeletonSummary;
  readonly contract: RuntimeDryRunRunnerContract;
  readonly inputEnvelope: RuntimePilotRunnerInputEnvelope;
  readonly outputEnvelope: RuntimePilotRunnerOutputEnvelope;
  readonly safetyGuard: RuntimePilotRunnerSafetyGuard;
}): RuntimePilotRunnerContractVerificationReport {
  const { summary, contract, inputEnvelope, outputEnvelope, safetyGuard } = input;
  const findings: string[] = [];

  if (contract.requiredInputMetadata.length === 0) {
    findings.push("contract.requiredInputMetadata empty");
  }
  if (inputEnvelope.envelopeRows.length === 0) {
    findings.push("inputEnvelope.envelopeRows empty");
  }
  if (contract.expectedOutputMetadata.length === 0) {
    findings.push("contract.expectedOutputMetadata empty");
  }
  if (
    outputEnvelope.acceptedMetadataRows.length === 0 &&
    outputEnvelope.safetyEnvelopeRows.length === 0
  ) {
    findings.push("outputEnvelope missing accepted/safety rows");
  }
  if (contract.forbiddenRunnerOperations.length === 0) {
    findings.push("contract.forbiddenRunnerOperations empty");
  }
  if (safetyGuard.guardRows.length === 0) {
    findings.push("safetyGuard.guardRows empty");
  }
  if (contract.runnerMode !== "dry_run_contract_only") {
    findings.push(`contract.runnerMode(${contract.runnerMode}) must be dry_run_contract_only`);
  }
  if (
    summary.skeletonReadiness === "skeleton_metadata_ready" &&
    summary.runnerMode !== "dry_run_contract_only"
  ) {
    findings.push(
      `summary.runnerMode(${summary.runnerMode}) must be dry_run_contract_only when skeleton_metadata_ready`
    );
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

  let verificationStatus: RuntimePilotRunnerContractVerificationReport["verificationStatus"];
  if (findings.length === 0) {
    verificationStatus = "verified_metadata";
  } else if (
    findings.some(
      (f) =>
        f.includes("actualExecutionForbidden") ||
        f.includes("actualAdapterInvocationForbidden") ||
        f.includes("contract.runnerMode") ||
        f.includes("summary.runnerMode")
    )
  ) {
    verificationStatus = "failed";
  } else {
    verificationStatus = "partial";
  }

  const recommendations = mergeSortedUniqueKo([
    ...(verificationStatus === "verified_metadata"
      ? ["H28.5: runner contract verified_metadata — H29 entry preflight 후보(runner 실행 없음)"]
      : []),
    ...(verificationStatus === "partial"
      ? ["H28.5: runner contract partial — envelope·forbidden alignment 재검토"]
      : []),
    ...(verificationStatus === "failed"
      ? ["H28.5: runner contract failed — contract·guard·mode 정렬"]
      : []),
  ]);

  return {
    mode: "runtime_pilot_runner_contract_verification_report",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualIsolatedRunnerExecutionEnabled: false,
    actualDryRunRunnerExecutionEnabled: false,
    verificationStatus,
    findings: mergeSortedUniqueKo(findings),
    recommendations,
  };
}
