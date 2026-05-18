/**
 * H30.5 — envelope·result·guard **alignment report**(read-only; H31 entry).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeRunnerNoopHarnessAlignmentReport,
  RuntimeRunnerNoopHarnessBoundaryViolationReport,
  RuntimeRunnerNoopHarnessContractVerificationReport,
  RuntimeRunnerNoopHarnessPreflightSummary,
  RuntimeRunnerNoopHarnessSafetyGuard,
  RuntimeRunnerNoopInvocationEnvelope,
  RuntimeRunnerNoopResultMetadata,
} from "./runtimeRunnerNoopHarnessTypes";

function envelopeHas(envelopeRows: readonly string[], prefix: string): boolean {
  return envelopeRows.some((row) => row.startsWith(prefix));
}

function rowIncludes(rows: readonly string[], fragment: string): boolean {
  return rows.some((row) => row.includes(fragment));
}

export function buildRuntimeRunnerNoopHarnessAlignmentReport(input: {
  readonly envelope: RuntimeRunnerNoopInvocationEnvelope;
  readonly result: RuntimeRunnerNoopResultMetadata;
  readonly safetyGuard: RuntimeRunnerNoopHarnessSafetyGuard;
  readonly contractVerification: RuntimeRunnerNoopHarnessContractVerificationReport;
  readonly boundaryViolation: RuntimeRunnerNoopHarnessBoundaryViolationReport;
  readonly preflight: RuntimeRunnerNoopHarnessPreflightSummary;
}): RuntimeRunnerNoopHarnessAlignmentReport {
  const { envelope, result, safetyGuard, contractVerification, boundaryViolation, preflight } = input;
  const findings: string[] = [];

  if (!envelopeHas(envelope.envelopeRows, "finalGateStatus:")) {
    findings.push("envelope missing finalGateStatus row");
  }
  if (!envelopeHas(envelope.envelopeRows, "candidateStatus:")) {
    findings.push("envelope missing candidateStatus row");
  }
  if (!envelopeHas(envelope.envelopeRows, "invocationAllowedMode:")) {
    findings.push("envelope missing invocationAllowedMode row");
  }
  if (!envelopeHas(envelope.envelopeRows, "readinessVerification:")) {
    findings.push("envelope missing readinessVerification row");
  }
  if (!envelopeHas(envelope.envelopeRows, "boundaryViolations:")) {
    findings.push("envelope missing boundaryViolations row");
  }
  if (!envelopeHas(envelope.envelopeRows, "skeletonPreflight:")) {
    findings.push("envelope missing skeletonPreflight row");
  }
  if (!envelopeHas(envelope.envelopeRows, "runnerContractVerification:")) {
    findings.push("envelope missing runnerContractVerification row");
  }
  if (!envelopeHas(envelope.envelopeRows, "noExecutionDiagnosticOnly:")) {
    findings.push("envelope missing noExecutionDiagnosticOnly row");
  }

  if (result.isolatedRunnerInvoked !== false) {
    findings.push("result isolatedRunnerInvoked must be false");
  }
  if (result.dryRunRunnerExecuted !== false) {
    findings.push("result dryRunRunnerExecuted must be false");
  }
  if (result.runtimeAdapterInvoked !== false) {
    findings.push("result runtimeAdapterInvoked must be false");
  }
  if (result.promptMutated !== false) {
    findings.push("result promptMutated must be false");
  }
  if (result.diagnosticOnly !== true) {
    findings.push("result diagnosticOnly must be true");
  }

  if (!rowIncludes(result.resultRows, "isolatedRunnerInvoked=false")) {
    findings.push("result rows missing isolatedRunnerInvoked=false");
  }
  if (!rowIncludes(result.resultRows, "dryRunRunnerExecuted=false")) {
    findings.push("result rows missing dryRunRunnerExecuted=false");
  }
  if (!rowIncludes(result.resultRows, "diagnosticOnly=true")) {
    findings.push("result rows missing diagnosticOnly=true");
  }

  if (safetyGuard.actualInvocationForbidden !== true) {
    findings.push("guard actualInvocationForbidden must be true");
  }
  if (safetyGuard.actualExecutionForbidden !== true) {
    findings.push("guard actualExecutionForbidden must be true");
  }
  if (safetyGuard.actualAdapterInvocationForbidden !== true) {
    findings.push("guard actualAdapterInvocationForbidden must be true");
  }
  if (safetyGuard.actualPromptMutationForbidden !== true) {
    findings.push("guard actualPromptMutationForbidden must be true");
  }

  if (!rowIncludes(safetyGuard.guardRows, "actualInvocationForbidden:true")) {
    findings.push("guard rows missing actualInvocationForbidden:true");
  }
  if (!rowIncludes(safetyGuard.guardRows, "actualExecutionForbidden:true")) {
    findings.push("guard rows missing actualExecutionForbidden:true");
  }
  if (!rowIncludes(safetyGuard.guardRows, "actualAdapterInvocationForbidden:true")) {
    findings.push("guard rows missing actualAdapterInvocationForbidden:true");
  }
  if (!rowIncludes(safetyGuard.guardRows, "actualPromptMutationForbidden:true")) {
    findings.push("guard rows missing actualPromptMutationForbidden:true");
  }

  if (
    preflight.preflightReadiness === "ready_metadata" &&
    contractVerification.verificationStatus !== "verified_metadata"
  ) {
    findings.push("preflight·contract verification misaligned");
  }
  if (
    preflight.preflightReadiness === "ready_metadata" &&
    boundaryViolation.actualFlagViolations.length > 0
  ) {
    findings.push("preflight·boundary violation misaligned");
  }
  if (
    preflight.preflightReadiness === "blocked" &&
    boundaryViolation.actualFlagViolations.length === 0 &&
    contractVerification.verificationStatus !== "failed"
  ) {
    findings.push("preflight blocked without boundary or contract failure signal");
  }

  let alignmentStatus: RuntimeRunnerNoopHarnessAlignmentReport["alignmentStatus"];
  if (findings.length === 0) {
    alignmentStatus = "aligned_metadata";
  } else if (
    findings.some(
      (f) =>
        f.includes("diagnosticOnly") ||
        f.includes("promptMutated") ||
        f.includes("isolatedRunnerInvoked") ||
        f.includes("actualInvocationForbidden")
    )
  ) {
    alignmentStatus = "failed";
  } else {
    alignmentStatus = "partial";
  }

  const recommendations = mergeSortedUniqueKo([
    ...(alignmentStatus === "aligned_metadata"
      ? ["H30.5: harness alignment aligned_metadata — envelope·result·guard H31 후보(invocation 없음)"]
      : []),
    ...(alignmentStatus === "partial"
      ? ["H30.5: harness alignment partial — envelope·result·guard rows 재검토"]
      : []),
    ...(alignmentStatus === "failed"
      ? ["H30.5: harness alignment failed — result·guard·preflight 정렬"]
      : []),
  ]);

  return {
    mode: "runtime_runner_noop_harness_alignment_report",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualIsolatedRunnerInvocationEnabled: false,
    actualDryRunRunnerInvocationEnabled: false,
    alignmentStatus,
    findings: mergeSortedUniqueKo(findings),
    recommendations,
  };
}
