/**
 * H43 / H43.5 — limited pilot readiness review planning reports 일괄 산출(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeLimitedPilotReadinessReview } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { mergeRuntimeLayerRecommendations } from "@/lib/harness/runtimeShared/runtimeRecommendationHelpers";
import { buildRuntimeLimitedPilotReadinessReviewAlignmentReport } from "./buildRuntimeLimitedPilotReadinessReviewAlignmentReport";
import { buildRuntimeLimitedPilotReadinessReviewFinalSafetyGate } from "./buildRuntimeLimitedPilotReadinessReviewFinalSafetyGate";
import { buildRuntimeLimitedPilotReadinessReviewSummary } from "./buildRuntimeLimitedPilotReadinessReviewSummary";
import { buildRuntimePilotContractHardeningBoundary } from "./buildRuntimePilotContractHardeningBoundary";
import { buildRuntimePilotContractReadinessChecklist } from "./buildRuntimePilotContractReadinessChecklist";
import { buildRuntimePilotExecutionForbiddenProof } from "./buildRuntimePilotExecutionForbiddenProof";
import { buildRuntimePilotNoExecutionProof } from "./buildRuntimePilotNoExecutionProof";
import { buildRuntimePilotReadinessInputEnvelope } from "./buildRuntimePilotReadinessInputEnvelope";
import { buildRuntimePilotReadinessOutputEnvelope } from "./buildRuntimePilotReadinessOutputEnvelope";
import { detectRuntimeLimitedPilotReadinessReviewViolations } from "./detectRuntimeLimitedPilotReadinessReviewViolations";
import { detectRuntimePilotReadinessBlockers } from "./detectRuntimePilotReadinessBlockers";
import { verifyRuntimeLimitedPilotReadinessReview } from "./verifyRuntimeLimitedPilotReadinessReview";
import type { RuntimeLimitedPilotReadinessReviewPlanningReports } from "./runtimeLimitedPilotReadinessReviewTypes";

export type { RuntimeLimitedPilotReadinessReviewPlanningReports } from "./runtimeLimitedPilotReadinessReviewTypes";

export function buildRuntimeLimitedPilotReadinessReviewPlanningReports(
  reports: RuntimeSemanticPlanningReportsBeforeLimitedPilotReadinessReview
): RuntimeLimitedPilotReadinessReviewPlanningReports {
  const runtimePilotReadinessBlockerReport = detectRuntimePilotReadinessBlockers(reports);
  const runtimePilotContractHardeningBoundary = buildRuntimePilotContractHardeningBoundary(reports);
  const runtimePilotReadinessInputEnvelope = buildRuntimePilotReadinessInputEnvelope(reports);
  const runtimePilotNoExecutionProof = buildRuntimePilotNoExecutionProof();
  const runtimePilotExecutionForbiddenProof = buildRuntimePilotExecutionForbiddenProof();

  const runtimeLimitedPilotReadinessReviewSummaryDraft = buildRuntimeLimitedPilotReadinessReviewSummary({
    reports,
    blockerReport: runtimePilotReadinessBlockerReport,
    noExecutionProof: runtimePilotNoExecutionProof,
    forbiddenProof: runtimePilotExecutionForbiddenProof,
  });

  const runtimePilotReadinessOutputEnvelope = buildRuntimePilotReadinessOutputEnvelope({
    summary: runtimeLimitedPilotReadinessReviewSummaryDraft,
    noExecutionProof: runtimePilotNoExecutionProof,
    forbiddenProof: runtimePilotExecutionForbiddenProof,
    blockerReport: runtimePilotReadinessBlockerReport,
  });

  const runtimePilotContractReadinessChecklist = buildRuntimePilotContractReadinessChecklist({
    reports,
    blockerReport: runtimePilotReadinessBlockerReport,
    noExecutionProof: runtimePilotNoExecutionProof,
    forbiddenProof: runtimePilotExecutionForbiddenProof,
  });

  const runtimeLimitedPilotReadinessReviewViolationReport = detectRuntimeLimitedPilotReadinessReviewViolations({
    summary: runtimeLimitedPilotReadinessReviewSummaryDraft,
    noExecutionProof: runtimePilotNoExecutionProof,
    forbiddenProof: runtimePilotExecutionForbiddenProof,
  });

  const runtimeLimitedPilotReadinessReviewVerificationReport = verifyRuntimeLimitedPilotReadinessReview({
    summary: runtimeLimitedPilotReadinessReviewSummaryDraft,
    boundary: runtimePilotContractHardeningBoundary,
    inputEnvelope: runtimePilotReadinessInputEnvelope,
    outputEnvelope: runtimePilotReadinessOutputEnvelope,
    noExecutionProof: runtimePilotNoExecutionProof,
    forbiddenProof: runtimePilotExecutionForbiddenProof,
    checklist: runtimePilotContractReadinessChecklist,
    blockerReport: runtimePilotReadinessBlockerReport,
  });

  const runtimeLimitedPilotReadinessReviewAlignmentReport = buildRuntimeLimitedPilotReadinessReviewAlignmentReport({
    reports,
    summary: runtimeLimitedPilotReadinessReviewSummaryDraft,
    boundary: runtimePilotContractHardeningBoundary,
    inputEnvelope: runtimePilotReadinessInputEnvelope,
    outputEnvelope: runtimePilotReadinessOutputEnvelope,
    noExecutionProof: runtimePilotNoExecutionProof,
    forbiddenProof: runtimePilotExecutionForbiddenProof,
    checklist: runtimePilotContractReadinessChecklist,
    blockerReport: runtimePilotReadinessBlockerReport,
    reviewViolation: runtimeLimitedPilotReadinessReviewViolationReport,
  });

  const runtimeLimitedPilotReadinessReviewFinalSafetyGate = buildRuntimeLimitedPilotReadinessReviewFinalSafetyGate({
    summary: runtimeLimitedPilotReadinessReviewSummaryDraft,
    blockerReport: runtimePilotReadinessBlockerReport,
    reviewViolation: runtimeLimitedPilotReadinessReviewViolationReport,
    readinessVerification: runtimeLimitedPilotReadinessReviewVerificationReport,
    alignmentReport: runtimeLimitedPilotReadinessReviewAlignmentReport,
  });

  const runtimeLimitedPilotReadinessReviewSummary = {
    ...runtimeLimitedPilotReadinessReviewSummaryDraft,
    reviewBlockers: mergeSortedUniqueKo([
      ...runtimeLimitedPilotReadinessReviewSummaryDraft.reviewBlockers,
      ...runtimePilotContractReadinessChecklist.blockers,
    ]),
    recommendations: mergeRuntimeLayerRecommendations([
      runtimeLimitedPilotReadinessReviewSummaryDraft,
      runtimePilotContractHardeningBoundary,
      runtimePilotReadinessInputEnvelope,
      runtimePilotReadinessOutputEnvelope,
      runtimePilotNoExecutionProof,
      runtimePilotExecutionForbiddenProof,
      runtimePilotReadinessBlockerReport,
      runtimePilotContractReadinessChecklist,
      runtimeLimitedPilotReadinessReviewViolationReport,
      runtimeLimitedPilotReadinessReviewVerificationReport,
      runtimeLimitedPilotReadinessReviewAlignmentReport,
      runtimeLimitedPilotReadinessReviewFinalSafetyGate,
    ]),
  };

  return {
    runtimeLimitedPilotReadinessReviewSummary,
    runtimePilotContractHardeningBoundary,
    runtimePilotReadinessInputEnvelope,
    runtimePilotReadinessOutputEnvelope,
    runtimePilotNoExecutionProof,
    runtimePilotExecutionForbiddenProof,
    runtimePilotReadinessBlockerReport,
    runtimePilotContractReadinessChecklist,
    runtimeLimitedPilotReadinessReviewViolationReport,
    runtimeLimitedPilotReadinessReviewVerificationReport,
    runtimeLimitedPilotReadinessReviewAlignmentReport,
    runtimeLimitedPilotReadinessReviewFinalSafetyGate,
  };
}
