/**
 * H42 — limited pilot boundary planning reports 일괄 산출(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeLimitedPilotBoundary } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { mergeRuntimeLayerRecommendations } from "@/lib/harness/runtimeShared/runtimeRecommendationHelpers";
import { buildRuntimeLimitedPilotBoundaryPolicy } from "./buildRuntimeLimitedPilotBoundaryPolicy";
import { buildRuntimeLimitedPilotBoundaryScope } from "./buildRuntimeLimitedPilotBoundaryScope";
import { buildRuntimeLimitedPilotInputContract } from "./buildRuntimeLimitedPilotInputContract";
import { buildRuntimeLimitedPilotOutputContract } from "./buildRuntimeLimitedPilotOutputContract";
import { buildRuntimeLimitedPilotReadinessChecklist } from "./buildRuntimeLimitedPilotReadinessChecklist";
import { detectRuntimeLimitedPilotBoundaryBlockers } from "./detectRuntimeLimitedPilotBoundaryBlockers";
import { evaluateRuntimeLimitedPilotBoundaryCandidate } from "./evaluateRuntimeLimitedPilotBoundaryCandidate";
import { resolveRuntimeLimitedPilotBoundaryMode } from "./resolveRuntimeLimitedPilotBoundaryMode";
import { RUNTIME_LIMITED_PILOT_BOUNDARY_ACTUAL_FLAGS_DISABLED } from "./runtimeLimitedPilotBoundaryConstants";
import type {
  RuntimeLimitedPilotBoundaryCandidateStatus,
  RuntimeLimitedPilotBoundaryPlanningReports,
} from "./runtimeLimitedPilotBoundaryTypes";

export type { RuntimeLimitedPilotBoundaryPlanningReports } from "./runtimeLimitedPilotBoundaryTypes";

function pilotBoundaryRationaleKo(status: RuntimeLimitedPilotBoundaryCandidateStatus): string {
  switch (status) {
    case "limited_pilot_boundary_metadata_candidate":
      return "controlled activation final gate·H42 entry readiness 정렬 — limited pilot boundary 메타 후보(실제 pilot activation·execution 없음).";
    case "watch":
      return "limited pilot boundary 주시 — controlled activation partial·wording risk(pilot·blocking 금지).";
    case "blocked":
      return "limited pilot boundary 차단 — controlled activation final gate·blocker 정렬 필요.";
    default:
      return "limited pilot boundary 미후보 — controlled activation candidate final safety gate 선행.";
  }
}

export function buildRuntimeLimitedPilotBoundaryPlanningReports(
  reports: RuntimeSemanticPlanningReportsBeforeLimitedPilotBoundary
): RuntimeLimitedPilotBoundaryPlanningReports {
  const runtimeLimitedPilotBoundaryBlockerReport = detectRuntimeLimitedPilotBoundaryBlockers(reports);
  const candidateStatus = evaluateRuntimeLimitedPilotBoundaryCandidate({
    reports,
    blockerReport: runtimeLimitedPilotBoundaryBlockerReport,
  });
  const pilotBoundaryMode = resolveRuntimeLimitedPilotBoundaryMode(candidateStatus);

  const runtimeLimitedPilotBoundaryScope = buildRuntimeLimitedPilotBoundaryScope(reports);
  const runtimeLimitedPilotBoundaryPolicy = buildRuntimeLimitedPilotBoundaryPolicy({ candidateStatus });
  const runtimeLimitedPilotInputContract = buildRuntimeLimitedPilotInputContract(reports);
  const runtimeLimitedPilotReadinessChecklist = buildRuntimeLimitedPilotReadinessChecklist({
    reports,
    blockerReport: runtimeLimitedPilotBoundaryBlockerReport,
  });

  const runtimeLimitedPilotBoundarySummaryDraft = {
    mode: "runtime_limited_pilot_boundary_summary" as const,
    ...RUNTIME_LIMITED_PILOT_BOUNDARY_ACTUAL_FLAGS_DISABLED,
    candidateStatus,
    pilotBoundaryMode,
    rationaleKo: pilotBoundaryRationaleKo(candidateStatus),
    pilotBoundaryBlockers: mergeSortedUniqueKo([
      ...runtimeLimitedPilotBoundaryBlockerReport.blockers,
      ...runtimeLimitedPilotReadinessChecklist.blockers,
      ...reports.runtimeControlledActivationCandidateSummary.activationBlockers.slice(0, 3),
    ]),
    recommendations: mergeRuntimeLayerRecommendations([
      runtimeLimitedPilotBoundaryBlockerReport,
      runtimeLimitedPilotBoundaryScope,
      runtimeLimitedPilotBoundaryPolicy,
      runtimeLimitedPilotInputContract,
      runtimeLimitedPilotReadinessChecklist,
    ]),
  };

  const runtimeLimitedPilotOutputContract = buildRuntimeLimitedPilotOutputContract({
    summary: runtimeLimitedPilotBoundarySummaryDraft,
    policy: runtimeLimitedPilotBoundaryPolicy,
    blockerReport: runtimeLimitedPilotBoundaryBlockerReport,
    checklist: runtimeLimitedPilotReadinessChecklist,
  });

  const runtimeLimitedPilotBoundarySummary = {
    ...runtimeLimitedPilotBoundarySummaryDraft,
    recommendations: mergeRuntimeLayerRecommendations([
      runtimeLimitedPilotBoundarySummaryDraft,
      runtimeLimitedPilotOutputContract,
    ]),
  };

  return {
    runtimeLimitedPilotBoundarySummary,
    runtimeLimitedPilotBoundaryScope,
    runtimeLimitedPilotBoundaryPolicy,
    runtimeLimitedPilotInputContract,
    runtimeLimitedPilotOutputContract,
    runtimeLimitedPilotBoundaryBlockerReport,
    runtimeLimitedPilotReadinessChecklist,
  };
}
