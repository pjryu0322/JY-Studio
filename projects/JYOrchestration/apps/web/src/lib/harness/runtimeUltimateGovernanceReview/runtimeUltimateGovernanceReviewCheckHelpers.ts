/**
 * H40 — ultimate governance review status·blocker·proof 검증 공통 헬퍼(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeUltimateGovernanceReview } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import {
  RUNTIME_ORCHESTRATION_FORBIDDEN_PROOF_REQUIRED_KEYS,
  isRuntimeOrchestrationForbiddenProofRecordComplete,
} from "@/lib/harness/runtimeShared/runtimeForbiddenProofFlags";
import {
  FINAL_ORCHESTRATION_READINESS_BOUNDARY_SOURCE_LAYER,
  FINAL_ORCHESTRATION_READINESS_BOUNDARY_TARGET_LAYER,
  ULTIMATE_GOVERNANCE_REVIEW_WORDING_RISK_PHRASES,
} from "./runtimeUltimateGovernanceReviewConstants";
import { runtimeChecklistHas, runtimeChecklistHasLabel, runtimeEnvelopeIncludes } from "@/lib/harness/runtimeShared/runtimeChecklistHelpers";
import type {
  RuntimeOrchestrationForbiddenProof,
  RuntimeUltimateGovernanceBlockerReport,
  RuntimeUltimateGovernanceReviewAlignmentReport,
  RuntimeUltimateGovernanceReviewAlignmentStatus,
  RuntimeUltimateGovernanceReviewFinalGateStatus,
  RuntimeUltimateGovernanceReviewStatus,
  RuntimeUltimateGovernanceReviewSummary,
  RuntimeUltimateGovernanceReviewVerificationReport,
  RuntimeUltimateGovernanceReviewVerificationStatus,
  RuntimeUltimateGovernanceReviewViolationReport,
  RuntimeUltimateNoEnforcementProof,
} from "./runtimeUltimateGovernanceReviewTypes";

export { RUNTIME_ORCHESTRATION_FORBIDDEN_PROOF_REQUIRED_KEYS };

export function readUltimateGovernanceUpstreamContext(
  reports: RuntimeSemanticPlanningReportsBeforeUltimateGovernanceReview
) {
  return {
    finalGate: reports.runtimeFinalReleaseGovernanceGateFinalSafetyGate,
    finalVerification: reports.runtimeFinalReleaseGovernanceGateVerificationReport,
    finalAlignment: reports.runtimeFinalReleaseGovernanceGateAlignmentReport,
    finalViolation: reports.runtimeFinalReleaseGovernanceGateViolationReport,
    finalSummary: reports.runtimeFinalReleaseGovernanceGateSummary,
    finalBlockers: reports.runtimeFinalReleaseGovernanceGateBlockerReport,
    releaseFinalGate: reports.runtimeGovernanceReleaseReadinessFinalSafetyGate,
    governanceFinalGate: reports.runtimeExecutionGovernanceBoundaryFinalSafetyGate,
    approval: reports.runtimeOperatorApprovalSummary,
    rollback: reports.runtimeRollbackReadinessSummary,
    audit: reports.runtimeAuditReadinessSummary,
    control: reports.runtimeControlBoundarySummary,
  };
}

export function isRuntimeUltimateNoEnforcementProofValid(
  proof: RuntimeUltimateNoEnforcementProof
): boolean {
  return proof.diagnosticOnly === true;
}

export function isRuntimeOrchestrationForbiddenProofComplete(
  proof: RuntimeOrchestrationForbiddenProof
): boolean {
  return isRuntimeOrchestrationForbiddenProofRecordComplete(proof);
}

export function resolveRuntimeUltimateGovernanceReviewStatus(input: {
  readonly upstream: ReturnType<typeof readUltimateGovernanceUpstreamContext>;
  readonly noEnforcementProof: RuntimeUltimateNoEnforcementProof;
  readonly forbiddenProof: RuntimeOrchestrationForbiddenProof;
  readonly ultimateBlockerCount: number;
}): RuntimeUltimateGovernanceReviewStatus {
  const { upstream, noEnforcementProof, forbiddenProof, ultimateBlockerCount } = input;
  const { finalGate, finalVerification, finalAlignment, finalViolation, finalSummary } = upstream;

  const proofValid =
    isRuntimeUltimateNoEnforcementProofValid(noEnforcementProof) &&
    isRuntimeOrchestrationForbiddenProofComplete(forbiddenProof);

  const finalGateHardBlocked =
    finalGate.finalGateStatus === "blocked" ||
    finalGate.h40EntryReadiness === "blocked" ||
    finalVerification.verificationStatus === "failed" ||
    finalAlignment.alignmentStatus === "failed" ||
    finalViolation.actualFlagViolations.length > 0 ||
    !proofValid;

  const finalGateWatch =
    finalGate.finalGateStatus === "watch" ||
    finalGate.h40EntryReadiness === "watch" ||
    finalVerification.verificationStatus === "partial" ||
    finalAlignment.alignmentStatus === "partial" ||
    finalViolation.wordingRiskFindings.length > 0;

  const finalGateBlockersBlock = finalSummary.gateBlockers.length > 0 && !finalGateWatch;

  if (finalGateHardBlocked || finalGateBlockersBlock) {
    return "blocked";
  }
  if (finalGateWatch) {
    return "watch";
  }
  if (
    finalGate.finalGateStatus === "ready_metadata" &&
    finalGate.h40EntryReadiness === "ready_metadata" &&
    finalVerification.verificationStatus === "verified_metadata" &&
    finalAlignment.alignmentStatus === "aligned_metadata" &&
    finalViolation.actualFlagViolations.length === 0 &&
    finalViolation.wordingRiskFindings.length === 0 &&
    ultimateBlockerCount === 0 &&
    finalSummary.gateBlockers.length === 0 &&
    proofValid
  ) {
    return "ultimate_governance_metadata_ready";
  }
  return "not_ready";
}

export function ultimateGovernanceBlockersAligned(
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

export function collectUltimateGovernanceReviewWordingBlob(parts: readonly string[]): string {
  return parts.join(" ").toLowerCase().replace(/\s+/g, "");
}

export function scanUltimateGovernanceReviewWordingRisks(blob: string): readonly string[] {
  const findings: string[] = [];
  for (const { phrase, label } of ULTIMATE_GOVERNANCE_REVIEW_WORDING_RISK_PHRASES) {
    if (blob.includes(phrase)) {
      findings.push(`wording/flag risk: ${label}`);
    }
  }
  return findings;
}

export function buildUltimateGovernanceReviewViolationRows(
  boundaryViolation: Readonly<{
    readonly actualFlagViolations: readonly string[];
    readonly proofViolations: readonly string[];
    readonly wordingRiskFindings: readonly string[];
  }>,
  compactAndNarrowUi: boolean
): readonly string[] {
  if (compactAndNarrowUi) {
    return [
      ...boundaryViolation.actualFlagViolations.slice(0, 1),
      ...boundaryViolation.proofViolations.slice(0, 1),
      ...boundaryViolation.wordingRiskFindings.slice(0, 1),
    ].filter(Boolean);
  }
  return [
    ...boundaryViolation.actualFlagViolations,
    ...boundaryViolation.proofViolations,
    ...boundaryViolation.wordingRiskFindings,
  ];
}

export function resolveUltimateGovernanceReviewVerificationStatus(
  findings: readonly string[]
): RuntimeUltimateGovernanceReviewVerificationStatus {
  if (findings.length === 0) {
    return "verified_metadata";
  }
  if (
    findings.some(
      (f) =>
        f.includes("reviewMode metadata_only") ||
        f.includes("diagnosticOnly must be true") ||
        f.includes("orchestration-forbidden proof incomplete") ||
        f.includes("requires no review blockers") ||
        f.includes("boundarySourceLayer must be")
    )
  ) {
    return "failed";
  }
  return "partial";
}

export function resolveUltimateGovernanceReviewAlignmentStatus(
  findings: readonly string[]
): RuntimeUltimateGovernanceReviewAlignmentStatus {
  if (findings.length === 0) {
    return "aligned_metadata";
  }
  if (
    findings.some(
      (f) =>
        f.includes("requires empty ultimate governance violations") ||
        f.includes("must be true") ||
        f.includes("misaligned with ultimate governance review summary") ||
        f.includes("forbiddenBoundaryOperations missing")
    )
  ) {
    return "failed";
  }
  return "partial";
}

export function collectUltimateGovernanceReviewFinalSafetyBlockers(input: {
  readonly blockerReport: RuntimeUltimateGovernanceBlockerReport;
  readonly summary: RuntimeUltimateGovernanceReviewSummary;
  readonly boundaryViolation: RuntimeUltimateGovernanceReviewViolationReport;
  readonly readinessVerification: RuntimeUltimateGovernanceReviewVerificationReport;
  readonly alignmentReport: RuntimeUltimateGovernanceReviewAlignmentReport;
}): readonly string[] {
  const blockers: string[] = [];
  if (input.blockerReport.blockers.length > 0) {
    blockers.push(...input.blockerReport.blockers.slice(0, 3));
  }
  if (input.summary.reviewBlockers.length > 0) {
    blockers.push(...input.summary.reviewBlockers.slice(0, 3));
  }
  if (input.boundaryViolation.actualFlagViolations.length > 0) {
    blockers.push(...input.boundaryViolation.actualFlagViolations.slice(0, 3));
  }
  if (input.boundaryViolation.proofViolations.length > 0) {
    blockers.push(...input.boundaryViolation.proofViolations.slice(0, 3));
  }
  if (input.readinessVerification.verificationStatus === "failed") {
    blockers.push("ultimate governance review readiness verification failed");
  }
  if (input.alignmentReport.alignmentStatus === "failed") {
    blockers.push("ultimate governance review alignment failed");
  }
  return blockers;
}

export function resolveUltimateGovernanceReviewFinalGateStatus(input: {
  readonly summary: RuntimeUltimateGovernanceReviewSummary;
  readonly blockerReport: RuntimeUltimateGovernanceBlockerReport;
  readonly boundaryViolation: RuntimeUltimateGovernanceReviewViolationReport;
  readonly readinessVerification: RuntimeUltimateGovernanceReviewVerificationReport;
  readonly alignmentReport: RuntimeUltimateGovernanceReviewAlignmentReport;
}): RuntimeUltimateGovernanceReviewFinalGateStatus {
  const { summary, blockerReport, boundaryViolation, readinessVerification, alignmentReport } = input;

  if (
    summary.reviewStatus === "blocked" ||
    readinessVerification.verificationStatus === "failed" ||
    alignmentReport.alignmentStatus === "failed" ||
    boundaryViolation.actualFlagViolations.length > 0 ||
    boundaryViolation.proofViolations.length > 0 ||
    blockerReport.blockers.length > 0 ||
    summary.reviewBlockers.length > 0
  ) {
    return "blocked";
  }
  if (
    summary.reviewStatus === "watch" ||
    readinessVerification.verificationStatus === "partial" ||
    alignmentReport.alignmentStatus === "partial" ||
    boundaryViolation.wordingRiskFindings.length > 0
  ) {
    return "watch";
  }
  if (
    summary.reviewStatus === "ultimate_governance_metadata_ready" &&
    summary.reviewMode === "metadata_only" &&
    readinessVerification.verificationStatus === "verified_metadata" &&
    alignmentReport.alignmentStatus === "aligned_metadata" &&
    boundaryViolation.actualFlagViolations.length === 0 &&
    boundaryViolation.proofViolations.length === 0 &&
    boundaryViolation.wordingRiskFindings.length === 0 &&
    blockerReport.blockers.length === 0 &&
    summary.reviewBlockers.length === 0
  ) {
    return "ready_metadata";
  }
  return "not_ready";
}

export function ultimateBoundarySourceLayerValid(sourceLayer: string): boolean {
  return sourceLayer === FINAL_ORCHESTRATION_READINESS_BOUNDARY_SOURCE_LAYER;
}

export function ultimateBoundaryTargetLayerValid(targetLayer: string): boolean {
  return targetLayer === FINAL_ORCHESTRATION_READINESS_BOUNDARY_TARGET_LAYER;
}

export { runtimeChecklistHas, runtimeChecklistHasLabel, runtimeEnvelopeIncludes };
