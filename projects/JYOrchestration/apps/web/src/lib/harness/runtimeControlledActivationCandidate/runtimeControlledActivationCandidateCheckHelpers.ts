/**
 * H41 / H41.5 — controlled activation candidate upstream·status·검증 공통 헬퍼(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeControlledActivationCandidate } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { runtimeChecklistHasLabel } from "@/lib/harness/runtimeShared/runtimeChecklistHelpers";
import {
  CONTROLLED_ACTIVATION_CANDIDATE_SCOPE_SOURCE_LAYER,
  CONTROLLED_ACTIVATION_CANDIDATE_SCOPE_TARGET_LAYER,
  CONTROLLED_ACTIVATION_CANDIDATE_WORDING_RISK_PHRASES,
  CONTROLLED_ACTIVATION_POLICY_FORBIDDEN_MUST_BE_TRUE,
  RUNTIME_CONTROL_HANDOFF_BOUNDARY_SOURCE_LAYER,
  RUNTIME_CONTROL_HANDOFF_BOUNDARY_TARGET_LAYER,
  RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_ACTUAL_FLAGS_DISABLED,
} from "./runtimeControlledActivationCandidateConstants";
import type {
  RuntimeControlledActivationCandidateAlignmentReport,
  RuntimeControlledActivationCandidateAlignmentStatus,
  RuntimeControlledActivationCandidateBlockerReport,
  RuntimeControlledActivationCandidateFinalGateStatus,
  RuntimeControlledActivationCandidatePolicy,
  RuntimeControlledActivationCandidateSummary,
  RuntimeControlledActivationCandidateVerificationReport,
  RuntimeControlledActivationCandidateVerificationStatus,
  RuntimeControlledActivationCandidateViolationReport,
} from "./runtimeControlledActivationCandidateTypes";

export function controlledActivationForbiddenIncludes(
  forbiddenOperations: readonly string[],
  fragment: string
): boolean {
  return forbiddenOperations.some((op) => op.toLowerCase().includes(fragment.toLowerCase()));
}

export function readControlledActivationUpstreamContext(
  reports: RuntimeSemanticPlanningReportsBeforeControlledActivationCandidate
) {
  return {
    ultimateFinalGate: reports.runtimeUltimateGovernanceReviewFinalSafetyGate,
    ultimateVerification: reports.runtimeUltimateGovernanceReviewVerificationReport,
    ultimateAlignment: reports.runtimeUltimateGovernanceReviewAlignmentReport,
    ultimateViolation: reports.runtimeUltimateGovernanceReviewViolationReport,
    ultimateBlockers: reports.runtimeUltimateGovernanceBlockerReport,
    ultimateSummary: reports.runtimeUltimateGovernanceReviewSummary,
    finalGate: reports.runtimeFinalReleaseGovernanceGateFinalSafetyGate,
    releaseFinalGate: reports.runtimeGovernanceReleaseReadinessFinalSafetyGate,
    approval: reports.runtimeOperatorApprovalSummary,
    rollback: reports.runtimeRollbackReadinessSummary,
    audit: reports.runtimeAuditReadinessSummary,
    control: reports.runtimeControlBoundarySummary,
    noEnforcementProof: reports.runtimeUltimateNoEnforcementProof,
    forbiddenProof: reports.runtimeOrchestrationForbiddenProof,
  };
}

export function collectControlledActivationSummaryActualFlagViolations(
  summary: RuntimeControlledActivationCandidateSummary
): readonly string[] {
  const violations: string[] = [];
  for (const [key, expected] of Object.entries(RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_ACTUAL_FLAGS_DISABLED)) {
    if (summary[key as keyof RuntimeControlledActivationCandidateSummary] !== expected) {
      violations.push(`runtimeControlledActivationCandidateSummary.${key} must be false`);
    }
  }
  return violations;
}

export function collectControlledActivationPolicyForbiddenViolations(
  policy: RuntimeControlledActivationCandidatePolicy
): readonly string[] {
  const violations: string[] = [];
  for (const key of CONTROLLED_ACTIVATION_POLICY_FORBIDDEN_MUST_BE_TRUE) {
    if (policy[key] !== true) {
      violations.push(`runtimeControlledActivationCandidatePolicy.${key} must be true`);
    }
  }
  return violations;
}

export function collectControlledActivationCandidateWordingBlob(parts: readonly string[]): string {
  return parts.join(" ").toLowerCase().replace(/\s+/g, "");
}

export function scanControlledActivationCandidateWordingRisks(blob: string): readonly string[] {
  const findings: string[] = [];
  for (const { phrase, label } of CONTROLLED_ACTIVATION_CANDIDATE_WORDING_RISK_PHRASES) {
    if (blob.includes(phrase)) {
      findings.push(`wording/flag risk: ${label}`);
    }
  }
  return findings;
}

export function activationBlockersAligned(
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

export function handoffBoundarySourceLayerValid(sourceLayer: string): boolean {
  return sourceLayer === RUNTIME_CONTROL_HANDOFF_BOUNDARY_SOURCE_LAYER;
}

export function handoffBoundaryTargetLayerValid(targetLayer: string): boolean {
  return targetLayer === RUNTIME_CONTROL_HANDOFF_BOUNDARY_TARGET_LAYER;
}

export function candidateScopeSourceLayerValid(sourceLayer: string): boolean {
  return sourceLayer === CONTROLLED_ACTIVATION_CANDIDATE_SCOPE_SOURCE_LAYER;
}

export function candidateScopeTargetLayerValid(targetLayer: string): boolean {
  return targetLayer === CONTROLLED_ACTIVATION_CANDIDATE_SCOPE_TARGET_LAYER;
}

export function resolveControlledActivationCandidateVerificationStatus(
  findings: readonly string[]
): RuntimeControlledActivationCandidateVerificationStatus {
  if (findings.length === 0) {
    return "verified_metadata";
  }
  if (
    findings.some(
      (f) =>
        f.includes("activationMode metadata_only") ||
        f.includes("requires activationBlockers") ||
        f.includes("must be true") ||
        f.includes("boundarySourceLayer must be") ||
        f.includes("candidateSourceLayer must be")
    )
  ) {
    return "failed";
  }
  return "partial";
}

export function resolveControlledActivationCandidateAlignmentStatus(
  findings: readonly string[]
): RuntimeControlledActivationCandidateAlignmentStatus {
  if (findings.length === 0) {
    return "aligned_metadata";
  }
  if (
    findings.some(
      (f) =>
        f.includes("requires empty controlled activation violations") ||
        f.includes("must be true") ||
        f.includes("misaligned with controlled activation") ||
        f.includes("forbiddenHandoffOperations missing") ||
        f.includes("forbiddenCandidateOperations missing")
    )
  ) {
    return "failed";
  }
  return "partial";
}

export function collectControlledActivationCandidateFinalSafetyBlockers(input: {
  readonly blockerReport: RuntimeControlledActivationCandidateBlockerReport;
  readonly summary: RuntimeControlledActivationCandidateSummary;
  readonly boundaryViolation: RuntimeControlledActivationCandidateViolationReport;
  readonly readinessVerification: RuntimeControlledActivationCandidateVerificationReport;
  readonly alignmentReport: RuntimeControlledActivationCandidateAlignmentReport;
}): readonly string[] {
  const blockers: string[] = [];
  if (input.blockerReport.blockers.length > 0) {
    blockers.push(...input.blockerReport.blockers.slice(0, 3));
  }
  if (input.summary.activationBlockers.length > 0) {
    blockers.push(...input.summary.activationBlockers.slice(0, 3));
  }
  if (input.boundaryViolation.actualFlagViolations.length > 0) {
    blockers.push(...input.boundaryViolation.actualFlagViolations.slice(0, 3));
  }
  if (input.boundaryViolation.policyViolations.length > 0) {
    blockers.push(...input.boundaryViolation.policyViolations.slice(0, 3));
  }
  if (input.readinessVerification.verificationStatus === "failed") {
    blockers.push("controlled activation candidate readiness verification failed");
  }
  if (input.alignmentReport.alignmentStatus === "failed") {
    blockers.push("controlled activation candidate alignment failed");
  }
  return blockers;
}

export function resolveControlledActivationCandidateFinalGateStatus(input: {
  readonly summary: RuntimeControlledActivationCandidateSummary;
  readonly blockerReport: RuntimeControlledActivationCandidateBlockerReport;
  readonly boundaryViolation: RuntimeControlledActivationCandidateViolationReport;
  readonly readinessVerification: RuntimeControlledActivationCandidateVerificationReport;
  readonly alignmentReport: RuntimeControlledActivationCandidateAlignmentReport;
}): RuntimeControlledActivationCandidateFinalGateStatus {
  const { summary, blockerReport, boundaryViolation, readinessVerification, alignmentReport } = input;

  if (
    summary.candidateStatus === "blocked" ||
    summary.activationMode === "blocked" ||
    readinessVerification.verificationStatus === "failed" ||
    alignmentReport.alignmentStatus === "failed" ||
    boundaryViolation.actualFlagViolations.length > 0 ||
    boundaryViolation.policyViolations.length > 0 ||
    blockerReport.blockers.length > 0 ||
    summary.activationBlockers.length > 0
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
    summary.candidateStatus === "controlled_activation_metadata_candidate" &&
    summary.activationMode === "metadata_only" &&
    readinessVerification.verificationStatus === "verified_metadata" &&
    alignmentReport.alignmentStatus === "aligned_metadata" &&
    boundaryViolation.actualFlagViolations.length === 0 &&
    boundaryViolation.policyViolations.length === 0 &&
    boundaryViolation.wordingRiskFindings.length === 0 &&
    blockerReport.blockers.length === 0 &&
    summary.activationBlockers.length === 0
  ) {
    return "ready_metadata";
  }
  return "not_ready";
}

export function buildControlledActivationCandidateViolationRows(
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

export { runtimeChecklistHasLabel };
