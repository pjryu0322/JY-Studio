/**
 * H33.5 — shell hardening summary·preflight·contract **정합성 검증**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeNoopShellHardeningBoundaryViolationReport,
  RuntimeNoopShellHardeningContractVerificationReport,
  RuntimeNoopShellHardeningPreflightSummary,
  RuntimeNoopShellHardeningReadinessVerificationReport,
  RuntimeNoopShellHardeningSafetyGuard,
  RuntimeNoopShellHardeningSummary,
  RuntimeNoopShellNoExecutionResultMetadata,
} from "./runtimeNoopShellHardeningTypes";

export function verifyRuntimeNoopShellHardeningReadiness(input: {
  readonly summary: RuntimeNoopShellHardeningSummary;
  readonly preflight: RuntimeNoopShellHardeningPreflightSummary;
  readonly contractVerification: RuntimeNoopShellHardeningContractVerificationReport;
  readonly boundaryViolation: RuntimeNoopShellHardeningBoundaryViolationReport;
  readonly result: RuntimeNoopShellNoExecutionResultMetadata;
  readonly safetyGuard: RuntimeNoopShellHardeningSafetyGuard;
}): RuntimeNoopShellHardeningReadinessVerificationReport {
  const { summary, preflight, contractVerification, boundaryViolation, result, safetyGuard } = input;
  const findings: string[] = [];

  if (
    summary.hardeningReadiness === "hardening_metadata_ready" &&
    summary.hardeningMode !== "contract_verification_only"
  ) {
    findings.push("hardening_metadata_ready requires contract_verification_only mode");
  }
  if (summary.hardeningReadiness === "blocked" && summary.hardeningBlockers.length === 0) {
    findings.push("blocked hardeningReadiness requires hardeningBlockers");
  }
  if (
    preflight.preflightReadiness === "ready_metadata" &&
    contractVerification.verificationStatus !== "verified_metadata"
  ) {
    findings.push("preflight ready_metadata requires contract verification verified_metadata");
  }
  if (preflight.preflightReadiness === "ready_metadata" && boundaryViolation.actualFlagViolations.length > 0) {
    findings.push("preflight ready_metadata requires empty boundary actualFlagViolations");
  }
  if (preflight.preflightReadiness === "ready_metadata" && result.diagnosticOnly !== true) {
    findings.push("preflight ready_metadata requires result diagnosticOnly true");
  }
  if (preflight.preflightReadiness === "ready_metadata" && safetyGuard.actualShellExecutionForbidden !== true) {
    findings.push("preflight ready_metadata requires actualShellExecutionForbidden true");
  }
  if (contractVerification.verificationStatus === "failed" && preflight.preflightReadiness === "ready_metadata") {
    findings.push("contract failed incompatible with preflight ready_metadata");
  }
  if (boundaryViolation.actualFlagViolations.length > 0 && preflight.preflightReadiness !== "blocked") {
    findings.push("boundary actualFlagViolations require preflight blocked");
  }

  let verificationStatus: RuntimeNoopShellHardeningReadinessVerificationReport["verificationStatus"];
  if (findings.length === 0) {
    verificationStatus = "verified_metadata";
  } else if (
    findings.some(
      (f) =>
        f.includes("diagnosticOnly") ||
        f.includes("actualShellExecutionForbidden") ||
        f.includes("contract failed") ||
        f.includes("blocked hardeningReadiness")
    )
  ) {
    verificationStatus = "failed";
  } else {
    verificationStatus = "partial";
  }

  const recommendations = mergeSortedUniqueKo([
    ...(verificationStatus === "verified_metadata"
      ? ["H33.5: shell hardening readiness verified_metadata — H34 entry gate 후보(shell execution 없음)"]
      : []),
    ...(verificationStatus === "partial"
      ? ["H33.5: shell hardening readiness partial — summary·preflight·contract 정합성 재검토"]
      : []),
    ...(verificationStatus === "failed"
      ? ["H33.5: shell hardening readiness failed — blocker·guard·result alignment 정렬"]
      : []),
  ]);

  return {
    mode: "runtime_noop_shell_hardening_readiness_verification_report",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualNoopShellExecutionEnabled: false,
    actualExecutionShellExecutionEnabled: false,
    verificationStatus,
    findings: mergeSortedUniqueKo(findings),
    recommendations,
  };
}
