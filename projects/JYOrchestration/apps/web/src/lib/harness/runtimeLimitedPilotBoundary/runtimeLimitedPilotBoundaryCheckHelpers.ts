/**
 * H42 / H42.5 — limited pilot boundary upstream·status·검증 공통 헬퍼(read-only).
 */

import { runtimeChecklistHasLabel } from "@/lib/harness/runtimeShared/runtimeChecklistHelpers";
import type { RuntimeSemanticPlanningReportsBeforeLimitedPilotBoundary } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import {
  LIMITED_PILOT_BOUNDARY_SCOPE_SOURCE_LAYER,
  LIMITED_PILOT_BOUNDARY_SCOPE_TARGET_LAYER,
  LIMITED_PILOT_BOUNDARY_WORDING_RISK_PHRASES,
  LIMITED_PILOT_POLICY_FORBIDDEN_MUST_BE_TRUE,
  RUNTIME_LIMITED_PILOT_BOUNDARY_ACTUAL_FLAGS_DISABLED,
} from "./runtimeLimitedPilotBoundaryConstants";
import type {
  RuntimeLimitedPilotBoundaryAlignmentReport,
  RuntimeLimitedPilotBoundaryAlignmentStatus,
  RuntimeLimitedPilotBoundaryBlockerReport,
  RuntimeLimitedPilotBoundaryFinalGateStatus,
  RuntimeLimitedPilotBoundaryPolicy,
  RuntimeLimitedPilotBoundarySummary,
  RuntimeLimitedPilotBoundaryVerificationReport,
  RuntimeLimitedPilotBoundaryVerificationStatus,
  RuntimeLimitedPilotBoundaryViolationReport,
} from "./runtimeLimitedPilotBoundaryTypes";

export { runtimeChecklistHasLabel };

export function limitedPilotForbiddenIncludes(
  forbiddenOperations: readonly string[],
  fragment: string
): boolean {
  return forbiddenOperations.some((op) => op.toLowerCase().includes(fragment.toLowerCase()));
}

export function readLimitedPilotBoundaryUpstreamContext(
  reports: RuntimeSemanticPlanningReportsBeforeLimitedPilotBoundary
) {
  return {
    activationFinalGate: reports.runtimeControlledActivationCandidateFinalSafetyGate,
    activationVerification: reports.runtimeControlledActivationCandidateVerificationReport,
    activationAlignment: reports.runtimeControlledActivationCandidateAlignmentReport,
    activationViolation: reports.runtimeControlledActivationCandidateViolationReport,
    activationBlockers: reports.runtimeControlledActivationCandidateBlockerReport,
    activationSummary: reports.runtimeControlledActivationCandidateSummary,
    ultimateFinalGate: reports.runtimeUltimateGovernanceReviewFinalSafetyGate,
    finalGate: reports.runtimeFinalReleaseGovernanceGateFinalSafetyGate,
    approval: reports.runtimeOperatorApprovalSummary,
    rollback: reports.runtimeRollbackReadinessSummary,
    audit: reports.runtimeAuditReadinessSummary,
    control: reports.runtimeControlBoundarySummary,
  };
}

export function collectLimitedPilotSummaryActualFlagViolations(
  summary: RuntimeLimitedPilotBoundarySummary
): readonly string[] {
  const violations: string[] = [];
  for (const [key, expected] of Object.entries(RUNTIME_LIMITED_PILOT_BOUNDARY_ACTUAL_FLAGS_DISABLED)) {
    if (summary[key as keyof RuntimeLimitedPilotBoundarySummary] !== expected) {
      violations.push(`runtimeLimitedPilotBoundarySummary.${key} must be false`);
    }
  }
  return violations;
}

export function collectLimitedPilotPolicyForbiddenViolations(
  policy: RuntimeLimitedPilotBoundaryPolicy
): readonly string[] {
  const violations: string[] = [];
  for (const key of LIMITED_PILOT_POLICY_FORBIDDEN_MUST_BE_TRUE) {
    if (policy[key] !== true) {
      violations.push(`runtimeLimitedPilotBoundaryPolicy.${key} must be true`);
    }
  }
  return violations;
}

export function collectLimitedPilotBoundaryWordingBlob(parts: readonly string[]): string {
  return parts.join(" ").toLowerCase().replace(/\s+/g, "");
}

export function scanLimitedPilotBoundaryWordingRisks(blob: string): readonly string[] {
  const findings: string[] = [];
  for (const { phrase, label } of LIMITED_PILOT_BOUNDARY_WORDING_RISK_PHRASES) {
    if (blob.includes(phrase)) {
      findings.push(`wording/flag risk: ${label}`);
    }
  }
  return findings;
}

export function pilotBoundaryBlockersAligned(
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

export function limitedPilotScopeSourceLayerValid(sourceLayer: string): boolean {
  return sourceLayer === LIMITED_PILOT_BOUNDARY_SCOPE_SOURCE_LAYER;
}

export function limitedPilotScopeTargetLayerValid(targetLayer: string): boolean {
  return targetLayer === LIMITED_PILOT_BOUNDARY_SCOPE_TARGET_LAYER;
}

export function resolveLimitedPilotBoundaryVerificationStatus(
  findings: readonly string[]
): RuntimeLimitedPilotBoundaryVerificationStatus {
  if (findings.length === 0) {
    return "verified_metadata";
  }
  if (
    findings.some(
      (f) =>
        f.includes("pilotBoundaryMode metadata_only") ||
        f.includes("requires pilotBoundaryBlockers") ||
        f.includes("must be true") ||
        f.includes("candidateSourceLayer must be") ||
        f.includes("candidateTargetLayer must be") ||
        f.includes("input contract missing") ||
        f.includes("output contract missing")
    )
  ) {
    return "failed";
  }
  return "partial";
}

export function resolveLimitedPilotBoundaryAlignmentStatus(
  findings: readonly string[]
): RuntimeLimitedPilotBoundaryAlignmentStatus {
  if (findings.length === 0) {
    return "aligned_metadata";
  }
  if (
    findings.some(
      (f) =>
        f.includes("requires empty limited pilot boundary violations") ||
        f.includes("must be true") ||
        f.includes("misaligned with") ||
        f.includes("forbiddenPilotBoundaryOperations missing") ||
        f.includes("controlled activation final safety gate misaligned")
    )
  ) {
    return "failed";
  }
  return "partial";
}

export function collectLimitedPilotBoundaryFinalSafetyBlockers(input: {
  readonly blockerReport: RuntimeLimitedPilotBoundaryBlockerReport;
  readonly summary: RuntimeLimitedPilotBoundarySummary;
  readonly boundaryViolation: RuntimeLimitedPilotBoundaryViolationReport;
  readonly readinessVerification: RuntimeLimitedPilotBoundaryVerificationReport;
  readonly alignmentReport: RuntimeLimitedPilotBoundaryAlignmentReport;
}): readonly string[] {
  const blockers: string[] = [];
  if (input.blockerReport.blockers.length > 0) {
    blockers.push(...input.blockerReport.blockers.slice(0, 3));
  }
  if (input.summary.pilotBoundaryBlockers.length > 0) {
    blockers.push(...input.summary.pilotBoundaryBlockers.slice(0, 3));
  }
  if (input.boundaryViolation.actualFlagViolations.length > 0) {
    blockers.push(...input.boundaryViolation.actualFlagViolations.slice(0, 3));
  }
  if (input.boundaryViolation.policyViolations.length > 0) {
    blockers.push(...input.boundaryViolation.policyViolations.slice(0, 3));
  }
  if (input.readinessVerification.verificationStatus === "failed") {
    blockers.push("limited pilot boundary readiness verification failed");
  }
  if (input.alignmentReport.alignmentStatus === "failed") {
    blockers.push("limited pilot boundary alignment failed");
  }
  return blockers;
}

export function resolveLimitedPilotBoundaryFinalGateStatus(input: {
  readonly summary: RuntimeLimitedPilotBoundarySummary;
  readonly blockerReport: RuntimeLimitedPilotBoundaryBlockerReport;
  readonly boundaryViolation: RuntimeLimitedPilotBoundaryViolationReport;
  readonly readinessVerification: RuntimeLimitedPilotBoundaryVerificationReport;
  readonly alignmentReport: RuntimeLimitedPilotBoundaryAlignmentReport;
}): RuntimeLimitedPilotBoundaryFinalGateStatus {
  const { summary, blockerReport, boundaryViolation, readinessVerification, alignmentReport } = input;

  if (
    summary.candidateStatus === "blocked" ||
    summary.pilotBoundaryMode === "blocked" ||
    readinessVerification.verificationStatus === "failed" ||
    alignmentReport.alignmentStatus === "failed" ||
    boundaryViolation.actualFlagViolations.length > 0 ||
    boundaryViolation.policyViolations.length > 0 ||
    blockerReport.blockers.length > 0 ||
    summary.pilotBoundaryBlockers.length > 0
  ) {
    return "blocked";
  }
  if (
    summary.candidateStatus === "watch" ||
    readinessVerification.verificationStatus === "partial" ||
    alignmentReport.alignmentStatus === "partial" ||
    boundaryViolation.wordingRiskFindings.length > 0
  ) {
    return "watch";
  }
  if (
    summary.candidateStatus === "limited_pilot_boundary_metadata_candidate" &&
    summary.pilotBoundaryMode === "metadata_only" &&
    readinessVerification.verificationStatus === "verified_metadata" &&
    alignmentReport.alignmentStatus === "aligned_metadata" &&
    boundaryViolation.actualFlagViolations.length === 0 &&
    boundaryViolation.policyViolations.length === 0 &&
    boundaryViolation.wordingRiskFindings.length === 0 &&
    blockerReport.blockers.length === 0 &&
    summary.pilotBoundaryBlockers.length === 0
  ) {
    return "ready_metadata";
  }
  return "not_ready";
}

export function buildLimitedPilotBoundaryViolationRows(
  boundaryViolation: Readonly<{
    readonly actualFlagViolations: readonly string[];
    readonly policyViolations: readonly string[];
    readonly wordingRiskFindings: readonly string[];
  }>,
  compactAndNarrowUi: boolean
): readonly string[] {
  if (compactAndNarrowUi) {
    return [
      ...boundaryViolation.actualFlagViolations.slice(0, 1),
      ...boundaryViolation.policyViolations.slice(0, 1),
      ...boundaryViolation.wordingRiskFindings.slice(0, 1),
    ].filter(Boolean);
  }
  return [
    ...boundaryViolation.actualFlagViolations,
    ...boundaryViolation.policyViolations,
    ...boundaryViolation.wordingRiskFindings,
  ];
}
