/**
 * H45 — controlled pilot execution candidate planning reports 일괄 산출(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeControlledPilotExecutionCandidate } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { mergeRuntimeLayerRecommendations } from "@/lib/harness/runtimeShared/runtimeRecommendationHelpers";
import { buildRuntimeFinalRuntimeHandoffBoundary } from "./buildRuntimeFinalRuntimeHandoffBoundary";
import { buildRuntimeControlledPilotExecutionCandidatePolicy } from "./buildRuntimeControlledPilotExecutionCandidatePolicy";
import { buildRuntimeControlledPilotExecutionCandidateScope } from "./buildRuntimeControlledPilotExecutionCandidateScope";
import { buildRuntimeControlledPilotExecutionInputContract } from "./buildRuntimeControlledPilotExecutionInputContract";
import { buildRuntimeControlledPilotExecutionOutputContract } from "./buildRuntimeControlledPilotExecutionOutputContract";
import { buildRuntimeControlledPilotExecutionReadinessChecklist } from "./buildRuntimeControlledPilotExecutionReadinessChecklist";
import { detectRuntimeControlledPilotExecutionCandidateBlockers } from "./detectRuntimeControlledPilotExecutionCandidateBlockers";
import { evaluateRuntimeControlledPilotExecutionCandidate } from "./evaluateRuntimeControlledPilotExecutionCandidate";
import { resolveRuntimeControlledPilotExecutionMode } from "./resolveRuntimeControlledPilotExecutionMode";
import { RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_ACTUAL_FLAGS_DISABLED } from "./runtimeControlledPilotExecutionCandidateConstants";
import type {
  RuntimeControlledPilotExecutionCandidatePlanningReports,
  RuntimeControlledPilotExecutionCandidateStatus,
} from "./runtimeControlledPilotExecutionCandidateTypes";

export type { RuntimeControlledPilotExecutionCandidatePlanningReports } from "./runtimeControlledPilotExecutionCandidateTypes";

function candidateRationaleKo(status: RuntimeControlledPilotExecutionCandidateStatus): string {
  switch (status) {
    case "controlled_pilot_execution_metadata_candidate":
      return "pilot execution readiness final gate·H45 entry readiness 정렬 — controlled pilot execution 메타 후보(실제 pilot activation·execution·runner·adapter·sandbox 없음).";
    case "watch":
      return "controlled pilot execution candidate 주시 — execution readiness partial·wording risk(pilot·execution 금지).";
    case "blocked":
      return "controlled pilot execution candidate 차단 — pilot execution readiness final gate·blocker·violation 정렬 필요.";
    default:
      return "controlled pilot execution 미후보 — pilot execution readiness final safety gate 선행.";
  }
}

export function buildRuntimeControlledPilotExecutionCandidatePlanningReports(
  reports: RuntimeSemanticPlanningReportsBeforeControlledPilotExecutionCandidate
): RuntimeControlledPilotExecutionCandidatePlanningReports {
  const runtimeControlledPilotExecutionCandidateBlockerReport =
    detectRuntimeControlledPilotExecutionCandidateBlockers(reports);
  const candidateStatus = evaluateRuntimeControlledPilotExecutionCandidate({
    reports,
    blockerReport: runtimeControlledPilotExecutionCandidateBlockerReport,
  });
  const executionMode = resolveRuntimeControlledPilotExecutionMode(candidateStatus);

  const runtimeFinalRuntimeHandoffBoundary = buildRuntimeFinalRuntimeHandoffBoundary(reports);
  const runtimeControlledPilotExecutionCandidateScope = buildRuntimeControlledPilotExecutionCandidateScope(reports);
  const runtimeControlledPilotExecutionCandidatePolicy = buildRuntimeControlledPilotExecutionCandidatePolicy({
    candidateStatus,
  });
  const runtimeControlledPilotExecutionInputContract = buildRuntimeControlledPilotExecutionInputContract(reports);
  const runtimeControlledPilotExecutionReadinessChecklist = buildRuntimeControlledPilotExecutionReadinessChecklist({
    reports,
    blockerReport: runtimeControlledPilotExecutionCandidateBlockerReport,
  });

  const runtimeControlledPilotExecutionCandidateSummaryDraft = {
    mode: "runtime_controlled_pilot_execution_candidate_summary" as const,
    ...RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_ACTUAL_FLAGS_DISABLED,
    candidateStatus,
    executionMode,
    rationaleKo: candidateRationaleKo(candidateStatus),
    executionBlockers: mergeSortedUniqueKo([
      ...runtimeControlledPilotExecutionCandidateBlockerReport.blockers,
      ...runtimeControlledPilotExecutionReadinessChecklist.blockers,
      ...reports.runtimePilotExecutionReadinessSummary.readinessBlockers.slice(0, 3),
    ]),
    recommendations: mergeRuntimeLayerRecommendations([
      runtimeControlledPilotExecutionCandidateBlockerReport,
      runtimeFinalRuntimeHandoffBoundary,
      runtimeControlledPilotExecutionCandidateScope,
      runtimeControlledPilotExecutionCandidatePolicy,
      runtimeControlledPilotExecutionInputContract,
      runtimeControlledPilotExecutionReadinessChecklist,
    ]),
  };

  const runtimeControlledPilotExecutionOutputContract = buildRuntimeControlledPilotExecutionOutputContract({
    summary: runtimeControlledPilotExecutionCandidateSummaryDraft,
    policy: runtimeControlledPilotExecutionCandidatePolicy,
    blockerReport: runtimeControlledPilotExecutionCandidateBlockerReport,
    checklist: runtimeControlledPilotExecutionReadinessChecklist,
  });

  const runtimeControlledPilotExecutionCandidateSummary = {
    ...runtimeControlledPilotExecutionCandidateSummaryDraft,
    recommendations: mergeRuntimeLayerRecommendations([
      runtimeControlledPilotExecutionCandidateSummaryDraft,
      runtimeFinalRuntimeHandoffBoundary,
      runtimeControlledPilotExecutionCandidateScope,
      runtimeControlledPilotExecutionCandidatePolicy,
      runtimeControlledPilotExecutionInputContract,
      runtimeControlledPilotExecutionOutputContract,
      runtimeControlledPilotExecutionReadinessChecklist,
    ]),
  };

  return {
    runtimeControlledPilotExecutionCandidateSummary,
    runtimeFinalRuntimeHandoffBoundary,
    runtimeControlledPilotExecutionCandidateScope,
    runtimeControlledPilotExecutionCandidatePolicy,
    runtimeControlledPilotExecutionInputContract,
    runtimeControlledPilotExecutionOutputContract,
    runtimeControlledPilotExecutionCandidateBlockerReport,
    runtimeControlledPilotExecutionReadinessChecklist,
  };
}
