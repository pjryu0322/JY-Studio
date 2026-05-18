/**
 * H45 / H45.5 — controlled pilot execution candidate upstream·status·검증 공통 헬퍼(read-only).
 */

import { runtimeChecklistHasLabel } from "@/lib/harness/runtimeShared/runtimeChecklistHelpers";
import type { RuntimeSemanticPlanningReportsBeforeControlledPilotExecutionCandidate } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import {
  CONTROLLED_PILOT_EXECUTION_CANDIDATE_SCOPE_SOURCE_LAYER,
  CONTROLLED_PILOT_EXECUTION_CANDIDATE_SCOPE_TARGET_LAYER,
  CONTROLLED_PILOT_EXECUTION_CANDIDATE_WORDING_RISK_PHRASES,
  CONTROLLED_PILOT_EXECUTION_POLICY_FORBIDDEN_MUST_BE_TRUE,
  RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_ACTUAL_FLAGS_DISABLED,
  RUNTIME_FINAL_RUNTIME_HANDOFF_BOUNDARY_SOURCE_LAYER,
  RUNTIME_FINAL_RUNTIME_HANDOFF_BOUNDARY_TARGET_LAYER,
} from "./runtimeControlledPilotExecutionCandidateConstants";
import type {
  RuntimeControlledPilotExecutionCandidateAlignmentReport,
  RuntimeControlledPilotExecutionCandidateAlignmentStatus,
  RuntimeControlledPilotExecutionCandidateBlockerReport,
  RuntimeControlledPilotExecutionCandidateFinalGateStatus,
  RuntimeControlledPilotExecutionCandidatePolicy,
  RuntimeControlledPilotExecutionCandidateSummary,
  RuntimeControlledPilotExecutionCandidateVerificationReport,
  RuntimeControlledPilotExecutionCandidateVerificationStatus,
  RuntimeControlledPilotExecutionCandidateViolationReport,
} from "./runtimeControlledPilotExecutionCandidateTypes";

export { runtimeChecklistHasLabel };

export function readControlledPilotExecutionUpstreamContext(
  reports: RuntimeSemanticPlanningReportsBeforeControlledPilotExecutionCandidate
) {
  return {
    executionFinalGate: reports.runtimePilotExecutionReadinessFinalSafetyGate,
    executionSummary: reports.runtimePilotExecutionReadinessSummary,
    executionVerification: reports.runtimePilotExecutionReadinessVerificationReport,
    executionAlignment: reports.runtimePilotExecutionReadinessAlignmentReport,
    executionViolation: reports.runtimePilotExecutionReadinessViolationReport,
    executionBlockers: reports.runtimePilotExecutionReadinessBlockerReport,
    executionBoundary: reports.runtimePilotExecutionReadinessBoundary,
    noExecutionProof: reports.runtimeFinalPilotNoExecutionProof,
    forbiddenProof: reports.runtimeFinalPilotExecutionForbiddenProof,
    reviewFinalGate: reports.runtimeLimitedPilotReadinessReviewFinalSafetyGate,
    pilotBoundaryFinalGate: reports.runtimeLimitedPilotBoundaryFinalSafetyGate,
    approval: reports.runtimeOperatorApprovalSummary,
    rollback: reports.runtimeRollbackReadinessSummary,
    audit: reports.runtimeAuditReadinessSummary,
    control: reports.runtimeControlBoundarySummary,
  };
}

export function controlledPilotExecutionForbiddenIncludes(
  forbiddenOperations: readonly string[],
  fragment: string
): boolean {
  return forbiddenOperations.some((op) => op.toLowerCase().includes(fragment.toLowerCase()));
}

export function contractIncludes(contractRows: readonly string[], fragment: string): boolean {
  return contractRows.some((row) => row.toLowerCase().includes(fragment.toLowerCase()));
}

export function collectControlledPilotExecutionSummaryActualFlagViolations(
  summary: RuntimeControlledPilotExecutionCandidateSummary
): readonly string[] {
  const violations: string[] = [];
  for (const [key, expected] of Object.entries(RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_ACTUAL_FLAGS_DISABLED)) {
    if (summary[key as keyof RuntimeControlledPilotExecutionCandidateSummary] !== expected) {
      violations.push(`runtimeControlledPilotExecutionCandidateSummary.${key} must be false`);
    }
  }
  return violations;
}

export function collectControlledPilotExecutionPolicyForbiddenViolations(
  policy: RuntimeControlledPilotExecutionCandidatePolicy
): readonly string[] {
  const violations: string[] = [];
  for (const key of CONTROLLED_PILOT_EXECUTION_POLICY_FORBIDDEN_MUST_BE_TRUE) {
    if (policy[key] !== true) {
      violations.push(`runtimeControlledPilotExecutionCandidatePolicy.${key} must be true`);
    }
  }
  return violations;
}

export function collectControlledPilotExecutionCandidateWordingBlob(parts: readonly string[]): string {
  return parts.join(" ").toLowerCase().replace(/\s+/g, "");
}

export function scanControlledPilotExecutionCandidateWordingRisks(blob: string): readonly string[] {
  const findings: string[] = [];
  for (const { phrase, label } of CONTROLLED_PILOT_EXECUTION_CANDIDATE_WORDING_RISK_PHRASES) {
    if (blob.includes(phrase)) {
      findings.push(`wording/flag risk: ${label}`);
    }
  }
  return findings;
}

export function executionBlockersAligned(
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
  return sourceLayer === RUNTIME_FINAL_RUNTIME_HANDOFF_BOUNDARY_SOURCE_LAYER;
}

export function handoffBoundaryTargetLayerValid(targetLayer: string): boolean {
  return targetLayer === RUNTIME_FINAL_RUNTIME_HANDOFF_BOUNDARY_TARGET_LAYER;
}

export function candidateScopeSourceLayerValid(sourceLayer: string): boolean {
  return sourceLayer === CONTROLLED_PILOT_EXECUTION_CANDIDATE_SCOPE_SOURCE_LAYER;
}

export function candidateScopeTargetLayerValid(targetLayer: string): boolean {
  return targetLayer === CONTROLLED_PILOT_EXECUTION_CANDIDATE_SCOPE_TARGET_LAYER;
}

export function resolveControlledPilotExecutionCandidateVerificationStatus(
  findings: readonly string[]
): RuntimeControlledPilotExecutionCandidateVerificationStatus {
  if (findings.length === 0) {
    return "verified_metadata";
  }
  if (
    findings.some(
      (f) =>
        f.includes("metadata_only") ||
        f.includes("requires executionBlockers") ||
        f.includes("must be true") ||
        f.includes("boundarySourceLayer must be") ||
        f.includes("candidateSourceLayer must be") ||
        f.includes("misaligned with summary.executionMode")
    )
  ) {
    return "failed";
  }
  return "partial";
}

export function resolveControlledPilotExecutionCandidateAlignmentStatus(
  findings: readonly string[]
): RuntimeControlledPilotExecutionCandidateAlignmentStatus {
  if (findings.length === 0) {
    return "aligned_metadata";
  }
  if (
    findings.some(
      (f) =>
        f.includes("requires empty controlled pilot execution violations") ||
        f.includes("must be true") ||
        f.includes("misaligned with controlled pilot execution") ||
        f.includes("forbiddenHandoffOperations missing") ||
        f.includes("forbiddenCandidateOperations missing")
    )
  ) {
    return "failed";
  }
  return "partial";
}

export function collectControlledPilotExecutionCandidateFinalSafetyBlockers(input: {
  readonly blockerReport: RuntimeControlledPilotExecutionCandidateBlockerReport;
  readonly summary: RuntimeControlledPilotExecutionCandidateSummary;
  readonly boundaryViolation: RuntimeControlledPilotExecutionCandidateViolationReport;
  readonly readinessVerification: RuntimeControlledPilotExecutionCandidateVerificationReport;
  readonly alignmentReport: RuntimeControlledPilotExecutionCandidateAlignmentReport;
}): readonly string[] {
  const blockers: string[] = [];
  if (input.blockerReport.blockers.length > 0) {
    blockers.push(...input.blockerReport.blockers.slice(0, 3));
  }
  if (input.summary.executionBlockers.length > 0) {
    blockers.push(...input.summary.executionBlockers.slice(0, 3));
  }
  if (input.boundaryViolation.actualFlagViolations.length > 0) {
    blockers.push(...input.boundaryViolation.actualFlagViolations.slice(0, 3));
  }
  if (input.boundaryViolation.policyViolations.length > 0) {
    blockers.push(...input.boundaryViolation.policyViolations.slice(0, 3));
  }
  if (input.readinessVerification.verificationStatus === "failed") {
    blockers.push("controlled pilot execution candidate readiness verification failed");
  }
  if (input.alignmentReport.alignmentStatus === "failed") {
    blockers.push("controlled pilot execution candidate alignment failed");
  }
  return blockers;
}

export function resolveControlledPilotExecutionCandidateFinalGateStatus(input: {
  readonly summary: RuntimeControlledPilotExecutionCandidateSummary;
  readonly blockerReport: RuntimeControlledPilotExecutionCandidateBlockerReport;
  readonly boundaryViolation: RuntimeControlledPilotExecutionCandidateViolationReport;
  readonly readinessVerification: RuntimeControlledPilotExecutionCandidateVerificationReport;
  readonly alignmentReport: RuntimeControlledPilotExecutionCandidateAlignmentReport;
}): RuntimeControlledPilotExecutionCandidateFinalGateStatus {
  const { summary, blockerReport, boundaryViolation, readinessVerification, alignmentReport } = input;

  if (
    summary.candidateStatus === "blocked" ||
    summary.executionMode === "blocked" ||
    readinessVerification.verificationStatus === "failed" ||
    alignmentReport.alignmentStatus === "failed" ||
    boundaryViolation.actualFlagViolations.length > 0 ||
    boundaryViolation.policyViolations.length > 0 ||
    blockerReport.blockers.length > 0 ||
    (summary.candidateStatus !== "watch" && summary.executionBlockers.length > 0)
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
    summary.candidateStatus === "controlled_pilot_execution_metadata_candidate" &&
    summary.executionMode === "metadata_only" &&
    readinessVerification.verificationStatus === "verified_metadata" &&
    alignmentReport.alignmentStatus === "aligned_metadata" &&
    boundaryViolation.actualFlagViolations.length === 0 &&
    boundaryViolation.policyViolations.length === 0 &&
    boundaryViolation.wordingRiskFindings.length === 0 &&
    blockerReport.blockers.length === 0 &&
    summary.executionBlockers.length === 0
  ) {
    return "ready_metadata";
  }
  return "not_ready";
}

export function buildControlledPilotExecutionCandidateViolationRows(
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
