/**
 * H43 / H43.5 — limited pilot readiness review upstream·proof·gate 검증 헬퍼(read-only).
 */

import { runtimeChecklistHasLabel } from "@/lib/harness/runtimeShared/runtimeChecklistHelpers";
import type { RuntimeSemanticPlanningReportsBeforeLimitedPilotReadinessReview } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { readLimitedPilotBoundaryUpstreamContext } from "@/lib/harness/runtimeLimitedPilotBoundary/runtimeLimitedPilotBoundaryCheckHelpers";
import {
  PILOT_CONTRACT_HARDENING_BOUNDARY_SOURCE_LAYER,
  PILOT_CONTRACT_HARDENING_BOUNDARY_TARGET_LAYER,
  PILOT_READINESS_REVIEW_WORDING_RISK_PHRASES,
  RUNTIME_LIMITED_PILOT_READINESS_REVIEW_ACTUAL_FLAGS_DISABLED,
  RUNTIME_PILOT_EXECUTION_FORBIDDEN_PROOF_REQUIRED_KEYS,
} from "./runtimeLimitedPilotReadinessReviewConstants";
import type {
  RuntimeLimitedPilotReadinessReviewAlignmentReport,
  RuntimeLimitedPilotReadinessReviewAlignmentStatus,
  RuntimeLimitedPilotReadinessReviewFinalGateStatus,
  RuntimeLimitedPilotReadinessReviewSummary,
  RuntimeLimitedPilotReadinessReviewVerificationReport,
  RuntimeLimitedPilotReadinessReviewVerificationStatus,
  RuntimeLimitedPilotReadinessReviewViolationReport,
  RuntimePilotExecutionForbiddenProof,
  RuntimePilotNoExecutionProof,
  RuntimePilotReadinessBlockerReport,
} from "./runtimeLimitedPilotReadinessReviewTypes";

export { runtimeChecklistHasLabel };

export function readLimitedPilotReadinessUpstreamContext(
  reports: RuntimeSemanticPlanningReportsBeforeLimitedPilotReadinessReview
) {
  return {
    ...readLimitedPilotBoundaryUpstreamContext(reports),
    pilotBoundaryFinalGate: reports.runtimeLimitedPilotBoundaryFinalSafetyGate,
    pilotBoundarySummary: reports.runtimeLimitedPilotBoundarySummary,
    pilotBoundaryPolicy: reports.runtimeLimitedPilotBoundaryPolicy,
    pilotBoundaryVerification: reports.runtimeLimitedPilotBoundaryVerificationReport,
    pilotBoundaryAlignment: reports.runtimeLimitedPilotBoundaryAlignmentReport,
    pilotBoundaryViolation: reports.runtimeLimitedPilotBoundaryViolationReport,
    pilotBoundaryBlockers: reports.runtimeLimitedPilotBoundaryBlockerReport,
    pilotInputContract: reports.runtimeLimitedPilotInputContract,
    pilotOutputContract: reports.runtimeLimitedPilotOutputContract,
  };
}

export function isRuntimePilotExecutionForbiddenProofComplete(
  proof: RuntimePilotExecutionForbiddenProof
): boolean {
  return RUNTIME_PILOT_EXECUTION_FORBIDDEN_PROOF_REQUIRED_KEYS.every((key) => proof[key] === true);
}

export function isRuntimePilotNoExecutionProofValid(
  proof: Readonly<{ diagnosticOnly: boolean }>
): boolean {
  return proof.diagnosticOnly === true;
}

export function collectPilotReadinessSummaryActualFlagViolations(
  summary: RuntimeLimitedPilotReadinessReviewSummary
): readonly string[] {
  const violations: string[] = [];
  for (const [key, expected] of Object.entries(RUNTIME_LIMITED_PILOT_READINESS_REVIEW_ACTUAL_FLAGS_DISABLED)) {
    if (summary[key as keyof RuntimeLimitedPilotReadinessReviewSummary] !== expected) {
      violations.push(`runtimeLimitedPilotReadinessReviewSummary.${key} must be false`);
    }
  }
  return violations;
}

const NO_EXECUTION_PROOF_FALSE_FIELDS: readonly { readonly key: keyof RuntimePilotNoExecutionProof; readonly label: string }[] = [
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

export function collectPilotNoExecutionProofViolations(
  proof: RuntimePilotNoExecutionProof
): readonly string[] {
  const violations: string[] = [];
  for (const { key, label } of NO_EXECUTION_PROOF_FALSE_FIELDS) {
    if (proof[key] !== false) {
      violations.push(`runtimePilotNoExecutionProof.${label} must be false`);
    }
  }
  if (proof.diagnosticOnly !== true) {
    violations.push("runtimePilotNoExecutionProof.diagnosticOnly must be true");
  }
  return violations;
}

export function collectPilotForbiddenProofViolations(
  proof: RuntimePilotExecutionForbiddenProof
): readonly string[] {
  const violations: string[] = [];
  for (const key of RUNTIME_PILOT_EXECUTION_FORBIDDEN_PROOF_REQUIRED_KEYS) {
    if (proof[key] !== true) {
      violations.push(`runtimePilotExecutionForbiddenProof.${key} must be true`);
    }
  }
  return violations;
}

export function collectPilotReadinessReviewWordingBlob(parts: readonly string[]): string {
  return parts.join(" ").toLowerCase().replace(/\s+/g, "");
}

export function scanPilotReadinessReviewWordingRisks(blob: string): readonly string[] {
  const findings: string[] = [];
  for (const { phrase, label } of PILOT_READINESS_REVIEW_WORDING_RISK_PHRASES) {
    if (blob.includes(phrase)) {
      findings.push(`wording/flag risk: ${label}`);
    }
  }
  return findings;
}

export function pilotReadinessBlockersAligned(
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

export function pilotReadinessForbiddenIncludes(
  forbiddenOperations: readonly string[],
  fragment: string
): boolean {
  return forbiddenOperations.some((op) => op.toLowerCase().includes(fragment.toLowerCase()));
}

export function envelopeIncludes(rows: readonly string[], fragment: string): boolean {
  return rows.some((r) => r.toLowerCase().includes(fragment.toLowerCase()));
}

export function resolvePilotReadinessReviewVerificationStatus(
  findings: readonly string[]
): RuntimeLimitedPilotReadinessReviewVerificationStatus {
  if (findings.length === 0) {
    return "verified_metadata";
  }
  if (
    findings.some(
      (f) =>
        f.includes("reviewMode metadata_only") ||
        f.includes("requires reviewBlockers") ||
        f.includes("must be") ||
        f.includes("missing") ||
        f.includes("misaligned")
    )
  ) {
    return "failed";
  }
  return "partial";
}

export function resolvePilotReadinessReviewAlignmentStatus(
  findings: readonly string[]
): RuntimeLimitedPilotReadinessReviewAlignmentStatus {
  if (findings.length === 0) {
    return "aligned_metadata";
  }
  if (
    findings.some(
      (f) =>
        f.includes("requires empty") ||
        f.includes("must be") ||
        f.includes("misaligned") ||
        f.includes("missing")
    )
  ) {
    return "failed";
  }
  return "partial";
}

export function collectPilotReadinessReviewFinalSafetyBlockers(input: {
  readonly blockerReport: RuntimePilotReadinessBlockerReport;
  readonly summary: RuntimeLimitedPilotReadinessReviewSummary;
  readonly reviewViolation: RuntimeLimitedPilotReadinessReviewViolationReport;
  readonly readinessVerification: RuntimeLimitedPilotReadinessReviewVerificationReport;
  readonly alignmentReport: RuntimeLimitedPilotReadinessReviewAlignmentReport;
}): readonly string[] {
  const blockers: string[] = [];
  if (input.blockerReport.blockers.length > 0) {
    blockers.push(...input.blockerReport.blockers.slice(0, 3));
  }
  if (input.summary.reviewBlockers.length > 0) {
    blockers.push(...input.summary.reviewBlockers.slice(0, 3));
  }
  if (input.reviewViolation.actualFlagViolations.length > 0) {
    blockers.push(...input.reviewViolation.actualFlagViolations.slice(0, 3));
  }
  if (input.reviewViolation.proofViolations.length > 0) {
    blockers.push(...input.reviewViolation.proofViolations.slice(0, 3));
  }
  if (input.reviewViolation.forbiddenProofViolations.length > 0) {
    blockers.push(...input.reviewViolation.forbiddenProofViolations.slice(0, 3));
  }
  if (input.readinessVerification.verificationStatus === "failed") {
    blockers.push("limited pilot readiness review verification failed");
  }
  if (input.alignmentReport.alignmentStatus === "failed") {
    blockers.push("limited pilot readiness review alignment failed");
  }
  return blockers;
}

export function resolvePilotReadinessReviewFinalGateStatus(input: {
  readonly summary: RuntimeLimitedPilotReadinessReviewSummary;
  readonly blockerReport: RuntimePilotReadinessBlockerReport;
  readonly reviewViolation: RuntimeLimitedPilotReadinessReviewViolationReport;
  readonly readinessVerification: RuntimeLimitedPilotReadinessReviewVerificationReport;
  readonly alignmentReport: RuntimeLimitedPilotReadinessReviewAlignmentReport;
}): RuntimeLimitedPilotReadinessReviewFinalGateStatus {
  const { summary, blockerReport, reviewViolation, readinessVerification, alignmentReport } = input;

  const hasViolations =
    reviewViolation.actualFlagViolations.length > 0 ||
    reviewViolation.proofViolations.length > 0 ||
    reviewViolation.forbiddenProofViolations.length > 0;

  if (
    summary.reviewStatus === "blocked" ||
    summary.reviewMode === "blocked" ||
    readinessVerification.verificationStatus === "failed" ||
    alignmentReport.alignmentStatus === "failed" ||
    hasViolations ||
    blockerReport.blockers.length > 0 ||
    summary.reviewBlockers.length > 0
  ) {
    return "blocked";
  }
  if (
    summary.reviewStatus === "watch" ||
    readinessVerification.verificationStatus === "partial" ||
    alignmentReport.alignmentStatus === "partial" ||
    reviewViolation.wordingRiskFindings.length > 0
  ) {
    return "watch";
  }
  if (
    summary.reviewStatus === "limited_pilot_readiness_metadata_ready" &&
    summary.reviewMode === "metadata_only" &&
    readinessVerification.verificationStatus === "verified_metadata" &&
    alignmentReport.alignmentStatus === "aligned_metadata" &&
    !hasViolations &&
    reviewViolation.wordingRiskFindings.length === 0 &&
    blockerReport.blockers.length === 0 &&
    summary.reviewBlockers.length === 0
  ) {
    return "ready_metadata";
  }
  return "not_ready";
}

export function buildPilotReadinessReviewViolationRows(
  reviewViolation: Readonly<{
    readonly actualFlagViolations: readonly string[];
    readonly proofViolations: readonly string[];
    readonly forbiddenProofViolations: readonly string[];
    readonly wordingRiskFindings: readonly string[];
  }>,
  compactAndNarrowUi: boolean
): readonly string[] {
  if (compactAndNarrowUi) {
    return [
      ...reviewViolation.actualFlagViolations.slice(0, 1),
      ...reviewViolation.proofViolations.slice(0, 1),
      ...reviewViolation.forbiddenProofViolations.slice(0, 1),
      ...reviewViolation.wordingRiskFindings.slice(0, 1),
    ].filter(Boolean);
  }
  return [
    ...reviewViolation.actualFlagViolations,
    ...reviewViolation.proofViolations,
    ...reviewViolation.forbiddenProofViolations,
    ...reviewViolation.wordingRiskFindings,
  ];
}

export {
  PILOT_CONTRACT_HARDENING_BOUNDARY_SOURCE_LAYER,
  PILOT_CONTRACT_HARDENING_BOUNDARY_TARGET_LAYER,
};
