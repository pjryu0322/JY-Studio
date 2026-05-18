/**
 * H44 / H44.5 — pilot execution readiness proof·gate 검증 헬퍼(read-only).
 */

import { runtimeChecklistHasLabel } from "@/lib/harness/runtimeShared/runtimeChecklistHelpers";
import type { RuntimeSemanticPlanningReportsBeforePilotExecutionReadiness } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import {
  envelopeIncludes,
  readLimitedPilotReadinessUpstreamContext,
} from "@/lib/harness/runtimeLimitedPilotReadinessReview/runtimeLimitedPilotReadinessReviewCheckHelpers";
import {
  PILOT_EXECUTION_READINESS_BOUNDARY_SOURCE_LAYER,
  PILOT_EXECUTION_READINESS_BOUNDARY_TARGET_LAYER,
  PILOT_EXECUTION_READINESS_WORDING_RISK_PHRASES,
  RUNTIME_FINAL_PILOT_EXECUTION_FORBIDDEN_PROOF_REQUIRED_KEYS,
  RUNTIME_PILOT_EXECUTION_READINESS_ACTUAL_FLAGS_DISABLED,
} from "./runtimePilotExecutionReadinessConstants";
import type {
  RuntimeFinalPilotExecutionForbiddenProof,
  RuntimeFinalPilotNoExecutionProof,
  RuntimePilotExecutionReadinessAlignmentReport,
  RuntimePilotExecutionReadinessAlignmentStatus,
  RuntimePilotExecutionReadinessBlockerReport,
  RuntimePilotExecutionReadinessFinalGateStatus,
  RuntimePilotExecutionReadinessSummary,
  RuntimePilotExecutionReadinessVerificationReport,
  RuntimePilotExecutionReadinessVerificationStatus,
  RuntimePilotExecutionReadinessViolationReport,
} from "./runtimePilotExecutionReadinessTypes";

export { runtimeChecklistHasLabel, envelopeIncludes };
export {
  PILOT_EXECUTION_READINESS_BOUNDARY_SOURCE_LAYER,
  PILOT_EXECUTION_READINESS_BOUNDARY_TARGET_LAYER,
};

export function readPilotExecutionReadinessUpstreamContext(
  reports: RuntimeSemanticPlanningReportsBeforePilotExecutionReadiness
) {
  return {
    ...readLimitedPilotReadinessUpstreamContext(reports),
    reviewFinalGate: reports.runtimeLimitedPilotReadinessReviewFinalSafetyGate,
    reviewSummary: reports.runtimeLimitedPilotReadinessReviewSummary,
    reviewVerification: reports.runtimeLimitedPilotReadinessReviewVerificationReport,
    reviewAlignment: reports.runtimeLimitedPilotReadinessReviewAlignmentReport,
    reviewViolation: reports.runtimeLimitedPilotReadinessReviewViolationReport,
    pilotContractBoundary: reports.runtimePilotContractHardeningBoundary,
    pilotNoExecutionProof: reports.runtimePilotNoExecutionProof,
    pilotForbiddenProof: reports.runtimePilotExecutionForbiddenProof,
    pilotReadinessBlockers: reports.runtimePilotReadinessBlockerReport,
  };
}

export function isRuntimeFinalPilotExecutionForbiddenProofComplete(
  proof: RuntimeFinalPilotExecutionForbiddenProof
): boolean {
  return RUNTIME_FINAL_PILOT_EXECUTION_FORBIDDEN_PROOF_REQUIRED_KEYS.every((key) => proof[key] === true);
}

export function isRuntimeFinalPilotNoExecutionProofValid(
  proof: Readonly<{ diagnosticOnly: boolean }>
): boolean {
  return proof.diagnosticOnly === true;
}

const FINAL_NO_EXECUTION_PROOF_FALSE_FIELDS: readonly {
  readonly key: keyof RuntimeFinalPilotNoExecutionProof;
  readonly label: string;
}[] = [
  { key: "pilotActivated", label: "pilotActivated" },
  { key: "pilotExecuted", label: "pilotExecuted" },
  { key: "isolatedRunnerInvoked", label: "isolatedRunnerInvoked" },
  { key: "isolatedRunnerExecuted", label: "isolatedRunnerExecuted" },
  { key: "dryRunRunnerInvoked", label: "dryRunRunnerInvoked" },
  { key: "dryRunRunnerExecuted", label: "dryRunRunnerExecuted" },
  { key: "runtimeAdapterInvoked", label: "runtimeAdapterInvoked" },
  { key: "sandboxInvoked", label: "sandboxInvoked" },
  { key: "executionPerformed", label: "executionPerformed" },
  { key: "executionRoutingPerformed", label: "executionRoutingPerformed" },
  { key: "releaseEnforced", label: "releaseEnforced" },
  { key: "approvalEnforced", label: "approvalEnforced" },
  { key: "executionBlocked", label: "executionBlocked" },
  { key: "mergeBlocked", label: "mergeBlocked" },
];

export function collectFinalPilotNoExecutionProofViolations(
  proof: RuntimeFinalPilotNoExecutionProof
): readonly string[] {
  const violations: string[] = [];
  for (const { key, label } of FINAL_NO_EXECUTION_PROOF_FALSE_FIELDS) {
    if (proof[key] !== false) {
      violations.push(`runtimeFinalPilotNoExecutionProof.${label} must be false`);
    }
  }
  if (proof.diagnosticOnly !== true) {
    violations.push("runtimeFinalPilotNoExecutionProof.diagnosticOnly must be true");
  }
  return violations;
}

export function collectFinalPilotForbiddenProofViolations(
  proof: RuntimeFinalPilotExecutionForbiddenProof
): readonly string[] {
  const violations: string[] = [];
  for (const key of RUNTIME_FINAL_PILOT_EXECUTION_FORBIDDEN_PROOF_REQUIRED_KEYS) {
    if (proof[key] !== true) {
      violations.push(`runtimeFinalPilotExecutionForbiddenProof.${key} must be true`);
    }
  }
  return violations;
}

export function collectPilotExecutionReadinessSummaryActualFlagViolations(
  summary: RuntimePilotExecutionReadinessSummary
): readonly string[] {
  const violations: string[] = [];
  for (const [key, expected] of Object.entries(RUNTIME_PILOT_EXECUTION_READINESS_ACTUAL_FLAGS_DISABLED)) {
    if (summary[key as keyof RuntimePilotExecutionReadinessSummary] !== expected) {
      violations.push(`runtimePilotExecutionReadinessSummary.${key} must be false`);
    }
  }
  return violations;
}

export function collectPilotExecutionReadinessWordingBlob(parts: readonly string[]): string {
  return parts.join(" ").toLowerCase().replace(/\s+/g, "");
}

export function scanPilotExecutionReadinessWordingRisks(blob: string): readonly string[] {
  const findings: string[] = [];
  for (const { phrase, label } of PILOT_EXECUTION_READINESS_WORDING_RISK_PHRASES) {
    if (blob.includes(phrase)) {
      findings.push(`wording/flag risk: ${label}`);
    }
  }
  return findings;
}

export function pilotExecutionReadinessBlockersAligned(
  blockerReportBlockers: readonly string[],
  summaryBlockers: readonly string[]
): boolean {
  if (blockerReportBlockers.length === 0 && summaryBlockers.length === 0) {
    return true;
  }
  if (blockerReportBlockers.length > 0) {
    return blockerReportBlockers.every((b) => summaryBlockers.includes(b));
  }
  return true;
}

export function pilotExecutionReadinessForbiddenIncludes(
  forbiddenOperations: readonly string[],
  fragment: string
): boolean {
  return forbiddenOperations.some((op) => op.toLowerCase().includes(fragment.toLowerCase()));
}

export function resolvePilotExecutionReadinessVerificationStatus(
  findings: readonly string[]
): RuntimePilotExecutionReadinessVerificationStatus {
  if (findings.length === 0) {
    return "verified_metadata";
  }
  if (
    findings.some(
      (f) =>
        f.includes("metadata_only") ||
        f.includes("requires readinessBlockers") ||
        f.includes("must be") ||
        f.includes("missing") ||
        f.includes("misaligned") ||
        f.includes("incomplete")
    )
  ) {
    return "failed";
  }
  return "partial";
}

export function resolvePilotExecutionReadinessAlignmentStatus(
  findings: readonly string[]
): RuntimePilotExecutionReadinessAlignmentStatus {
  if (findings.length === 0) {
    return "aligned_metadata";
  }
  if (
    findings.some(
      (f) =>
        f.includes("misaligned") ||
        f.includes("must be") ||
        f.includes("missing") ||
        f.includes("requires")
    )
  ) {
    return "failed";
  }
  return "partial";
}

export function collectPilotExecutionReadinessFinalSafetyBlockers(input: {
  readonly blockerReport: RuntimePilotExecutionReadinessBlockerReport;
  readonly summary: RuntimePilotExecutionReadinessSummary;
  readonly executionViolation: RuntimePilotExecutionReadinessViolationReport;
  readonly readinessVerification: RuntimePilotExecutionReadinessVerificationReport;
  readonly alignmentReport: RuntimePilotExecutionReadinessAlignmentReport;
}): readonly string[] {
  const blockers: string[] = [];
  if (input.blockerReport.blockers.length > 0) {
    blockers.push(...input.blockerReport.blockers.slice(0, 3));
  }
  if (input.summary.readinessBlockers.length > 0) {
    blockers.push(...input.summary.readinessBlockers.slice(0, 3));
  }
  if (input.executionViolation.actualFlagViolations.length > 0) {
    blockers.push(...input.executionViolation.actualFlagViolations.slice(0, 3));
  }
  if (input.executionViolation.proofViolations.length > 0) {
    blockers.push(...input.executionViolation.proofViolations.slice(0, 3));
  }
  if (input.executionViolation.forbiddenProofViolations.length > 0) {
    blockers.push(...input.executionViolation.forbiddenProofViolations.slice(0, 3));
  }
  if (input.readinessVerification.verificationStatus === "failed") {
    blockers.push("pilot execution readiness verification failed");
  }
  if (input.alignmentReport.alignmentStatus === "failed") {
    blockers.push("pilot execution readiness alignment failed");
  }
  return blockers;
}

export function resolvePilotExecutionReadinessFinalGateStatus(input: {
  readonly summary: RuntimePilotExecutionReadinessSummary;
  readonly blockerReport: RuntimePilotExecutionReadinessBlockerReport;
  readonly executionViolation: RuntimePilotExecutionReadinessViolationReport;
  readonly readinessVerification: RuntimePilotExecutionReadinessVerificationReport;
  readonly alignmentReport: RuntimePilotExecutionReadinessAlignmentReport;
}): RuntimePilotExecutionReadinessFinalGateStatus {
  const { summary, blockerReport, executionViolation, readinessVerification, alignmentReport } = input;

  const hasViolations =
    executionViolation.actualFlagViolations.length > 0 ||
    executionViolation.proofViolations.length > 0 ||
    executionViolation.forbiddenProofViolations.length > 0;

  if (
    summary.readinessStatus === "blocked" ||
    summary.readinessMode === "blocked" ||
    readinessVerification.verificationStatus === "failed" ||
    alignmentReport.alignmentStatus === "failed" ||
    hasViolations ||
    blockerReport.blockers.length > 0 ||
    summary.readinessBlockers.length > 0
  ) {
    return "blocked";
  }
  if (
    summary.readinessStatus === "watch" ||
    readinessVerification.verificationStatus === "partial" ||
    alignmentReport.alignmentStatus === "partial" ||
    executionViolation.wordingRiskFindings.length > 0
  ) {
    return "watch";
  }
  if (
    summary.readinessStatus === "pilot_execution_readiness_metadata_ready" &&
    summary.readinessMode === "metadata_only" &&
    readinessVerification.verificationStatus === "verified_metadata" &&
    alignmentReport.alignmentStatus === "aligned_metadata" &&
    !hasViolations &&
    executionViolation.wordingRiskFindings.length === 0 &&
    blockerReport.blockers.length === 0 &&
    summary.readinessBlockers.length === 0
  ) {
    return "ready_metadata";
  }
  return "not_ready";
}

export function buildPilotExecutionReadinessViolationRows(
  executionViolation: Readonly<{
    readonly actualFlagViolations: readonly string[];
    readonly proofViolations: readonly string[];
    readonly forbiddenProofViolations: readonly string[];
    readonly wordingRiskFindings: readonly string[];
  }>,
  compactAndNarrowUi: boolean
): readonly string[] {
  if (compactAndNarrowUi) {
    return [
      ...executionViolation.actualFlagViolations.slice(0, 1),
      ...executionViolation.proofViolations.slice(0, 1),
      ...executionViolation.forbiddenProofViolations.slice(0, 1),
      ...executionViolation.wordingRiskFindings.slice(0, 1),
    ].filter(Boolean);
  }
  return [
    ...executionViolation.actualFlagViolations,
    ...executionViolation.proofViolations,
    ...executionViolation.forbiddenProofViolations,
    ...executionViolation.wordingRiskFindings,
  ];
}
