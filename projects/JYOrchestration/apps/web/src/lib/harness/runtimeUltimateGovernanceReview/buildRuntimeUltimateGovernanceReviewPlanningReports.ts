/**
 * H40 / H40.5 — ultimate governance review planning reports 일괄 산출(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeUltimateGovernanceReview } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeRuntimeLayerRecommendations } from "@/lib/harness/runtimeShared/runtimeRecommendationHelpers";
import { buildRuntimeFinalOrchestrationReadinessBoundary } from "./buildRuntimeFinalOrchestrationReadinessBoundary";
import { buildRuntimeFinalOrchestrationReadinessChecklist } from "./buildRuntimeFinalOrchestrationReadinessChecklist";
import { buildRuntimeOrchestrationForbiddenProof } from "./buildRuntimeOrchestrationForbiddenProof";
import { buildRuntimeOrchestrationReadinessInputEnvelope } from "./buildRuntimeOrchestrationReadinessInputEnvelope";
import { buildRuntimeOrchestrationReadinessOutputEnvelope } from "./buildRuntimeOrchestrationReadinessOutputEnvelope";
import { buildRuntimeUltimateGovernanceReviewAlignmentReport } from "./buildRuntimeUltimateGovernanceReviewAlignmentReport";
import { buildRuntimeUltimateGovernanceReviewFinalSafetyGate } from "./buildRuntimeUltimateGovernanceReviewFinalSafetyGate";
import { buildRuntimeUltimateGovernanceReviewSummary } from "./buildRuntimeUltimateGovernanceReviewSummary";
import { buildRuntimeUltimateNoEnforcementProof } from "./buildRuntimeUltimateNoEnforcementProof";
import { detectRuntimeUltimateGovernanceBlockers } from "./detectRuntimeUltimateGovernanceBlockers";
import { detectRuntimeUltimateGovernanceReviewViolations } from "./detectRuntimeUltimateGovernanceReviewViolations";
import { verifyRuntimeUltimateGovernanceReviewReadiness } from "./verifyRuntimeUltimateGovernanceReviewReadiness";
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

  const runtimeUltimateGovernanceReviewViolationReport = detectRuntimeUltimateGovernanceReviewViolations({
    summary: runtimeUltimateGovernanceReviewSummaryDraft,
    noEnforcementProof: runtimeUltimateNoEnforcementProof,
    forbiddenProof: runtimeOrchestrationForbiddenProof,
  });

  const runtimeUltimateGovernanceReviewVerificationReport = verifyRuntimeUltimateGovernanceReviewReadiness({
    summary: runtimeUltimateGovernanceReviewSummaryDraft,
    boundary: runtimeFinalOrchestrationReadinessBoundary,
    inputEnvelope: runtimeOrchestrationReadinessInputEnvelope,
    outputEnvelope: runtimeOrchestrationReadinessOutputEnvelope,
    noEnforcementProof: runtimeUltimateNoEnforcementProof,
    forbiddenProof: runtimeOrchestrationForbiddenProof,
    checklist: runtimeFinalOrchestrationReadinessChecklist,
    blockerReport: runtimeUltimateGovernanceBlockerReport,
  });

  const runtimeUltimateGovernanceReviewAlignmentReport = buildRuntimeUltimateGovernanceReviewAlignmentReport({
    reports,
    summary: runtimeUltimateGovernanceReviewSummaryDraft,
    boundary: runtimeFinalOrchestrationReadinessBoundary,
    inputEnvelope: runtimeOrchestrationReadinessInputEnvelope,
    outputEnvelope: runtimeOrchestrationReadinessOutputEnvelope,
    noEnforcementProof: runtimeUltimateNoEnforcementProof,
    forbiddenProof: runtimeOrchestrationForbiddenProof,
    checklist: runtimeFinalOrchestrationReadinessChecklist,
    blockerReport: runtimeUltimateGovernanceBlockerReport,
    boundaryViolation: runtimeUltimateGovernanceReviewViolationReport,
  });

  const runtimeUltimateGovernanceReviewFinalSafetyGate = buildRuntimeUltimateGovernanceReviewFinalSafetyGate({
    summary: runtimeUltimateGovernanceReviewSummaryDraft,
    blockerReport: runtimeUltimateGovernanceBlockerReport,
    boundaryViolation: runtimeUltimateGovernanceReviewViolationReport,
    readinessVerification: runtimeUltimateGovernanceReviewVerificationReport,
    alignmentReport: runtimeUltimateGovernanceReviewAlignmentReport,
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
      runtimeUltimateGovernanceReviewViolationReport,
      runtimeUltimateGovernanceReviewVerificationReport,
      runtimeUltimateGovernanceReviewAlignmentReport,
      runtimeUltimateGovernanceReviewFinalSafetyGate,
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
    runtimeUltimateGovernanceReviewViolationReport,
    runtimeUltimateGovernanceReviewVerificationReport,
    runtimeUltimateGovernanceReviewAlignmentReport,
    runtimeUltimateGovernanceReviewFinalSafetyGate,
  };
}
