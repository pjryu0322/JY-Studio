/**
 * H43 — limited pilot readiness review planning reports 일괄 산출(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeLimitedPilotReadinessReview } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { mergeRuntimeLayerRecommendations } from "@/lib/harness/runtimeShared/runtimeRecommendationHelpers";
import { buildRuntimeLimitedPilotReadinessReviewSummary } from "./buildRuntimeLimitedPilotReadinessReviewSummary";
import { buildRuntimePilotContractHardeningBoundary } from "./buildRuntimePilotContractHardeningBoundary";
import { buildRuntimePilotContractReadinessChecklist } from "./buildRuntimePilotContractReadinessChecklist";
import { buildRuntimePilotExecutionForbiddenProof } from "./buildRuntimePilotExecutionForbiddenProof";
import { buildRuntimePilotNoExecutionProof } from "./buildRuntimePilotNoExecutionProof";
import { buildRuntimePilotReadinessInputEnvelope } from "./buildRuntimePilotReadinessInputEnvelope";
import { buildRuntimePilotReadinessOutputEnvelope } from "./buildRuntimePilotReadinessOutputEnvelope";
import { detectRuntimePilotReadinessBlockers } from "./detectRuntimePilotReadinessBlockers";
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
  };
}
