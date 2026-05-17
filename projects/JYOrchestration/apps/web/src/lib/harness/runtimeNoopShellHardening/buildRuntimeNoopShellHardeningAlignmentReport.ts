/**
 * H33.5 — shell hardening envelope·result·guard **alignment report**(read-only; H34 entry).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeNoopShellHardeningAlignmentReport,
  RuntimeNoopShellHardeningBoundaryViolationReport,
  RuntimeNoopShellHardeningContractVerificationReport,
  RuntimeNoopShellHardeningInputEnvelope,
  RuntimeNoopShellHardeningPreflightSummary,
  RuntimeNoopShellHardeningSafetyGuard,
  RuntimeNoopShellNoExecutionResultMetadata,
} from "./runtimeNoopShellHardeningTypes";

function envelopeHas(envelopeRows: readonly string[], prefix: string): boolean {
  return envelopeRows.some((row) => row.startsWith(prefix));
}

function rowIncludes(rows: readonly string[], fragment: string): boolean {
  return rows.some((row) => row.includes(fragment));
}

export function buildRuntimeNoopShellHardeningAlignmentReport(input: {
  readonly inputEnvelope: RuntimeNoopShellHardeningInputEnvelope;
  readonly result: RuntimeNoopShellNoExecutionResultMetadata;
  readonly safetyGuard: RuntimeNoopShellHardeningSafetyGuard;
  readonly contractVerification: RuntimeNoopShellHardeningContractVerificationReport;
  readonly boundaryViolation: RuntimeNoopShellHardeningBoundaryViolationReport;
  readonly preflight: RuntimeNoopShellHardeningPreflightSummary;
}): RuntimeNoopShellHardeningAlignmentReport {
  const { inputEnvelope, result, safetyGuard, contractVerification, boundaryViolation, preflight } = input;
  const findings: string[] = [];

  if (!envelopeHas(inputEnvelope.envelopeRows, "harnessPreflight:")) {
    findings.push("input envelope missing harnessPreflight row");
  }
  if (!envelopeHas(inputEnvelope.envelopeRows, "harnessReadiness:")) {
    findings.push("input envelope missing harnessReadiness row");
  }
  if (!envelopeHas(inputEnvelope.envelopeRows, "contractBoundary:")) {
    findings.push("input envelope missing contractBoundary row");
  }
  if (!envelopeHas(inputEnvelope.envelopeRows, "finalGateStatus:")) {
    findings.push("input envelope missing execution shell finalGateStatus row");
  }
  if (!envelopeHas(inputEnvelope.envelopeRows, "readinessVerification:")) {
    findings.push("input envelope missing execution shell readinessVerification row");
  }
  if (!envelopeHas(inputEnvelope.envelopeRows, "boundaryViolations:")) {
    findings.push("input envelope missing execution shell boundaryViolations row");
  }

  if (result.noopShellExecuted !== false) {
    findings.push("result noopShellExecuted must be false");
  }
  if (result.executionShellExecuted !== false) {
    findings.push("result executionShellExecuted must be false");
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

  if (!rowIncludes(result.resultRows, "noopShellExecuted=false")) {
    findings.push("result rows missing noopShellExecuted=false");
  }
  if (!rowIncludes(result.resultRows, "executionShellExecuted=false")) {
    findings.push("result rows missing executionShellExecuted=false");
  }
  if (!rowIncludes(result.resultRows, "diagnosticOnly=true")) {
    findings.push("result rows missing diagnosticOnly=true");
  }

  if (safetyGuard.actualShellExecutionForbidden !== true) {
    findings.push("guard actualShellExecutionForbidden must be true");
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

  if (!rowIncludes(safetyGuard.guardRows, "actualShellExecutionForbidden:true")) {
    findings.push("guard rows missing actualShellExecutionForbidden:true");
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

  let alignmentStatus: RuntimeNoopShellHardeningAlignmentReport["alignmentStatus"];
  if (findings.length === 0) {
    alignmentStatus = "aligned_metadata";
  } else if (
    findings.some(
      (f) =>
        f.includes("diagnosticOnly") ||
        f.includes("promptMutated") ||
        f.includes("noopShellExecuted") ||
        f.includes("actualShellExecutionForbidden")
    )
  ) {
    alignmentStatus = "failed";
  } else {
    alignmentStatus = "partial";
  }

  const recommendations = mergeSortedUniqueKo([
    ...(alignmentStatus === "aligned_metadata"
      ? ["H33.5: shell hardening alignment aligned_metadata — envelope·result·guard H34 후보(shell execution 없음)"]
      : []),
    ...(alignmentStatus === "partial"
      ? ["H33.5: shell hardening alignment partial — input envelope·result·guard rows 재검토"]
      : []),
    ...(alignmentStatus === "failed"
      ? ["H33.5: shell hardening alignment failed — result·guard·preflight 정렬"]
      : []),
  ]);

  return {
    mode: "runtime_noop_shell_hardening_alignment_report",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualNoopShellExecutionEnabled: false,
    actualExecutionShellExecutionEnabled: false,
    alignmentStatus,
    findings: mergeSortedUniqueKo(findings),
    recommendations,
  };
}
