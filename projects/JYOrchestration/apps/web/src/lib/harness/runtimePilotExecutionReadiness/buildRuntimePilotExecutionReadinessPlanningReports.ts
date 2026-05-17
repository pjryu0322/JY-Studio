/**
 * H44 — pilot execution readiness planning reports 일괄 산출(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforePilotExecutionReadiness } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { mergeRuntimeLayerRecommendations } from "@/lib/harness/runtimeShared/runtimeRecommendationHelpers";
import { buildRuntimeFinalPilotExecutionForbiddenProof } from "./buildRuntimeFinalPilotExecutionForbiddenProof";
import { buildRuntimeFinalPilotNoExecutionProof } from "./buildRuntimeFinalPilotNoExecutionProof";
import { buildRuntimePilotExecutionReadinessBoundary } from "./buildRuntimePilotExecutionReadinessBoundary";
import { buildRuntimePilotExecutionReadinessChecklist } from "./buildRuntimePilotExecutionReadinessChecklist";
import { buildRuntimePilotExecutionReadinessInputEnvelope } from "./buildRuntimePilotExecutionReadinessInputEnvelope";
import { buildRuntimePilotExecutionReadinessOutputEnvelope } from "./buildRuntimePilotExecutionReadinessOutputEnvelope";
import { buildRuntimePilotExecutionReadinessSummary } from "./buildRuntimePilotExecutionReadinessSummary";
import { detectRuntimePilotExecutionReadinessBlockers } from "./detectRuntimePilotExecutionReadinessBlockers";
import type { RuntimePilotExecutionReadinessPlanningReports } from "./runtimePilotExecutionReadinessTypes";

export type { RuntimePilotExecutionReadinessPlanningReports } from "./runtimePilotExecutionReadinessTypes";

export function buildRuntimePilotExecutionReadinessPlanningReports(
  reports: RuntimeSemanticPlanningReportsBeforePilotExecutionReadiness
): RuntimePilotExecutionReadinessPlanningReports {
  const runtimePilotExecutionReadinessBlockerReport = detectRuntimePilotExecutionReadinessBlockers(reports);
  const runtimePilotExecutionReadinessBoundary = buildRuntimePilotExecutionReadinessBoundary(reports);
  const runtimePilotExecutionReadinessInputEnvelope = buildRuntimePilotExecutionReadinessInputEnvelope(reports);
  const runtimeFinalPilotNoExecutionProof = buildRuntimeFinalPilotNoExecutionProof();
  const runtimeFinalPilotExecutionForbiddenProof = buildRuntimeFinalPilotExecutionForbiddenProof();

  const runtimePilotExecutionReadinessSummaryDraft = buildRuntimePilotExecutionReadinessSummary({
    reports,
    blockerReport: runtimePilotExecutionReadinessBlockerReport,
    noExecutionProof: runtimeFinalPilotNoExecutionProof,
    forbiddenProof: runtimeFinalPilotExecutionForbiddenProof,
  });

  const runtimePilotExecutionReadinessOutputEnvelope = buildRuntimePilotExecutionReadinessOutputEnvelope({
    summary: runtimePilotExecutionReadinessSummaryDraft,
    noExecutionProof: runtimeFinalPilotNoExecutionProof,
    forbiddenProof: runtimeFinalPilotExecutionForbiddenProof,
    blockerReport: runtimePilotExecutionReadinessBlockerReport,
  });

  const runtimePilotExecutionReadinessChecklist = buildRuntimePilotExecutionReadinessChecklist({
    reports,
    blockerReport: runtimePilotExecutionReadinessBlockerReport,
    noExecutionProof: runtimeFinalPilotNoExecutionProof,
    forbiddenProof: runtimeFinalPilotExecutionForbiddenProof,
  });

  const runtimePilotExecutionReadinessSummary = {
    ...runtimePilotExecutionReadinessSummaryDraft,
    readinessBlockers: mergeSortedUniqueKo([
      ...runtimePilotExecutionReadinessSummaryDraft.readinessBlockers,
      ...runtimePilotExecutionReadinessChecklist.blockers,
    ]),
    recommendations: mergeRuntimeLayerRecommendations([
      runtimePilotExecutionReadinessSummaryDraft,
      runtimePilotExecutionReadinessBoundary,
      runtimePilotExecutionReadinessInputEnvelope,
      runtimePilotExecutionReadinessOutputEnvelope,
      runtimeFinalPilotNoExecutionProof,
      runtimeFinalPilotExecutionForbiddenProof,
      runtimePilotExecutionReadinessBlockerReport,
      runtimePilotExecutionReadinessChecklist,
    ]),
  };

  return {
    runtimePilotExecutionReadinessSummary,
    runtimePilotExecutionReadinessBoundary,
    runtimePilotExecutionReadinessInputEnvelope,
    runtimePilotExecutionReadinessOutputEnvelope,
    runtimeFinalPilotNoExecutionProof,
    runtimeFinalPilotExecutionForbiddenProof,
    runtimePilotExecutionReadinessBlockerReport,
    runtimePilotExecutionReadinessChecklist,
  };
}
