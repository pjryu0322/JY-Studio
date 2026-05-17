/**
 * H43 — limited runtime pilot readiness review **summary**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforeLimitedPilotReadinessReview } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import {
  isRuntimePilotExecutionForbiddenProofComplete,
  isRuntimePilotNoExecutionProofValid,
} from "./runtimeLimitedPilotReadinessReviewCheckHelpers";
import { RUNTIME_LIMITED_PILOT_READINESS_REVIEW_ACTUAL_FLAGS_DISABLED } from "./runtimeLimitedPilotReadinessReviewConstants";
import { resolveRuntimeLimitedPilotReadinessReviewMode } from "./resolveRuntimeLimitedPilotReadinessReviewMode";
import type {
  RuntimePilotExecutionForbiddenProof,
  RuntimePilotNoExecutionProof,
  RuntimePilotReadinessBlockerReport,
  RuntimeLimitedPilotReadinessReviewStatus,
  RuntimeLimitedPilotReadinessReviewSummary,
} from "./runtimeLimitedPilotReadinessReviewTypes";

export function evaluateRuntimeLimitedPilotReadinessReviewStatus(input: {
  readonly reports: RuntimeSemanticPlanningReportsBeforeLimitedPilotReadinessReview;
  readonly blockerReport: RuntimePilotReadinessBlockerReport;
  readonly noExecutionProof: RuntimePilotNoExecutionProof;
  readonly forbiddenProof: RuntimePilotExecutionForbiddenProof;
}): RuntimeLimitedPilotReadinessReviewStatus {
  const { reports, blockerReport, noExecutionProof, forbiddenProof } = input;
  const finalGate = reports.runtimeLimitedPilotBoundaryFinalSafetyGate;
  const verification = reports.runtimeLimitedPilotBoundaryVerificationReport;
  const alignment = reports.runtimeLimitedPilotBoundaryAlignmentReport;
  const violation = reports.runtimeLimitedPilotBoundaryViolationReport;
  const boundaryBlockers = reports.runtimeLimitedPilotBoundaryBlockerReport;

  if (
    finalGate.finalGateStatus === "blocked" ||
    finalGate.h43EntryReadiness === "blocked" ||
    verification.verificationStatus === "failed" ||
    alignment.alignmentStatus === "failed" ||
    violation.actualFlagViolations.length > 0 ||
    violation.policyViolations.length > 0 ||
    blockerReport.blockers.length > 0 ||
    boundaryBlockers.blockers.length > 0 ||
    !isRuntimePilotNoExecutionProofValid(noExecutionProof) ||
    !isRuntimePilotExecutionForbiddenProofComplete(forbiddenProof)
  ) {
    return "blocked";
  }

  if (
    finalGate.finalGateStatus === "watch" ||
    finalGate.h43EntryReadiness === "watch" ||
    verification.verificationStatus === "partial" ||
    alignment.alignmentStatus === "partial" ||
    violation.wordingRiskFindings.length > 0
  ) {
    return "watch";
  }

  if (
    finalGate.finalGateStatus === "ready_metadata" &&
    finalGate.h43EntryReadiness === "ready_metadata" &&
    verification.verificationStatus === "verified_metadata" &&
    alignment.alignmentStatus === "aligned_metadata" &&
    violation.actualFlagViolations.length === 0 &&
    violation.policyViolations.length === 0 &&
    blockerReport.blockers.length === 0 &&
    boundaryBlockers.blockers.length === 0 &&
    isRuntimePilotNoExecutionProofValid(noExecutionProof) &&
    isRuntimePilotExecutionForbiddenProofComplete(forbiddenProof)
  ) {
    return "limited_pilot_readiness_metadata_ready";
  }

  return "not_ready";
}

function reviewRationaleKo(status: RuntimeLimitedPilotReadinessReviewStatus): string {
  switch (status) {
    case "limited_pilot_readiness_metadata_ready":
      return "limited pilot boundary final gate·H43 entry readiness 정렬 — limited runtime pilot readiness review 메타(실제 pilot activation·execution 없음).";
    case "watch":
      return "limited pilot readiness review 주시 — boundary partial·wording risk(pilot·execution 금지).";
    case "blocked":
      return "limited pilot readiness review 차단 — boundary final gate·blocker·proof 정렬 필요.";
    default:
      return "limited pilot readiness review 미준비 — limited pilot boundary final safety gate 선행.";
  }
}

export function buildRuntimeLimitedPilotReadinessReviewSummary(input: {
  readonly reports: RuntimeSemanticPlanningReportsBeforeLimitedPilotReadinessReview;
  readonly blockerReport: RuntimePilotReadinessBlockerReport;
  readonly noExecutionProof: RuntimePilotNoExecutionProof;
  readonly forbiddenProof: RuntimePilotExecutionForbiddenProof;
}): RuntimeLimitedPilotReadinessReviewSummary {
  const { reports, blockerReport, noExecutionProof, forbiddenProof } = input;
  const reviewStatus = evaluateRuntimeLimitedPilotReadinessReviewStatus({
    reports,
    blockerReport,
    noExecutionProof,
    forbiddenProof,
  });
  const reviewMode = resolveRuntimeLimitedPilotReadinessReviewMode(reviewStatus);

  return {
    mode: "runtime_limited_pilot_readiness_review_summary",
    ...RUNTIME_LIMITED_PILOT_READINESS_REVIEW_ACTUAL_FLAGS_DISABLED,
    reviewStatus,
    reviewMode,
    rationaleKo: reviewRationaleKo(reviewStatus),
    reviewBlockers: mergeSortedUniqueKo([
      ...blockerReport.blockers,
      ...reports.runtimeLimitedPilotBoundarySummary.pilotBoundaryBlockers.slice(0, 3),
    ]),
    recommendations: [],
  };
}
