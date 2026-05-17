/**
 * H40 — ultimate governance review planning reports 일괄 산출(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeUltimateGovernanceReview } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { buildRuntimeFinalOrchestrationReadinessBoundary } from "./buildRuntimeFinalOrchestrationReadinessBoundary";
import { mergeRuntimeLayerRecommendations } from "@/lib/harness/runtimeShared/runtimeRecommendationHelpers";
import { buildRuntimeFinalOrchestrationReadinessChecklist } from "./buildRuntimeFinalOrchestrationReadinessChecklist";
import { buildRuntimeOrchestrationForbiddenProof } from "./buildRuntimeOrchestrationForbiddenProof";
import { buildRuntimeOrchestrationReadinessInputEnvelope } from "./buildRuntimeOrchestrationReadinessInputEnvelope";
import { buildRuntimeOrchestrationReadinessOutputEnvelope } from "./buildRuntimeOrchestrationReadinessOutputEnvelope";
import { buildRuntimeUltimateGovernanceReviewSummary } from "./buildRuntimeUltimateGovernanceReviewSummary";
import { buildRuntimeUltimateNoEnforcementProof } from "./buildRuntimeUltimateNoEnforcementProof";
import { detectRuntimeUltimateGovernanceBlockers } from "./detectRuntimeUltimateGovernanceBlockers";
import type { RuntimeUltimateGovernanceReviewPlanningReports } from "./runtimeUltimateGovernanceReviewTypes";

export type { RuntimeUltimateGovernanceReviewPlanningReports } from "./runtimeUltimateGovernanceReviewTypes";

export function buildRuntimeUltimateGovernanceReviewPlanningReports(
  reports: RuntimeSemanticPlanningReportsBeforeUltimateGovernanceReview
): RuntimeUltimateGovernanceReviewPlanningReports {
  const runtimeUltimateGovernanceBlockerReport = detectRuntimeUltimateGovernanceBlockers(reports);
  const runtimeFinalOrchestrationReadinessBoundary = buildRuntimeFinalOrchestrationReadinessBoundary();
  const runtimeOrchestrationReadinessInputEnvelope = buildRuntimeOrchestrationReadinessInputEnvelope(reports);
  const runtimeUltimateNoEnforcementProof = buildRuntimeUltimateNoEnforcementProof();
  const runtimeOrchestrationForbiddenProof = buildRuntimeOrchestrationForbiddenProof();

  const runtimeUltimateGovernanceReviewSummaryDraft = buildRuntimeUltimateGovernanceReviewSummary({
    reports,
    blockerReport: runtimeUltimateGovernanceBlockerReport,
    noEnforcementProof: runtimeUltimateNoEnforcementProof,
    forbiddenProof: runtimeOrchestrationForbiddenProof,
  });

  const runtimeOrchestrationReadinessOutputEnvelope = buildRuntimeOrchestrationReadinessOutputEnvelope({
    summary: runtimeUltimateGovernanceReviewSummaryDraft,
    noEnforcementProof: runtimeUltimateNoEnforcementProof,
    forbiddenProof: runtimeOrchestrationForbiddenProof,
    blockerReport: runtimeUltimateGovernanceBlockerReport,
  });

  const runtimeFinalOrchestrationReadinessChecklist = buildRuntimeFinalOrchestrationReadinessChecklist({
    reports,
    blockerReport: runtimeUltimateGovernanceBlockerReport,
    noEnforcementProof: runtimeUltimateNoEnforcementProof,
    forbiddenProof: runtimeOrchestrationForbiddenProof,
  });

  const runtimeUltimateGovernanceReviewSummary = {
    ...runtimeUltimateGovernanceReviewSummaryDraft,
    recommendations: mergeRuntimeLayerRecommendations([
      runtimeUltimateGovernanceReviewSummaryDraft,
      runtimeFinalOrchestrationReadinessBoundary,
      runtimeOrchestrationReadinessInputEnvelope,
      runtimeOrchestrationReadinessOutputEnvelope,
      runtimeUltimateNoEnforcementProof,
      runtimeOrchestrationForbiddenProof,
      runtimeFinalOrchestrationReadinessChecklist,
    ]),
  };

  return {
    runtimeUltimateGovernanceReviewSummary,
    runtimeFinalOrchestrationReadinessBoundary,
    runtimeOrchestrationReadinessInputEnvelope,
    runtimeOrchestrationReadinessOutputEnvelope,
    runtimeUltimateNoEnforcementProof,
    runtimeOrchestrationForbiddenProof,
    runtimeUltimateGovernanceBlockerReport,
    runtimeFinalOrchestrationReadinessChecklist,
  };
}
