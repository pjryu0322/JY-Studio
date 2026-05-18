/**
 * H23 — execution candidate planning reports 일괄 산출(read-only; 상위 report 재계산 없음).
 */

import type { RuntimeSemanticPlanningReportsBeforeExecutionCandidate } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { buildRuntimeExecutionCandidatePreconditions } from "./buildRuntimeExecutionCandidatePreconditions";
import { buildRuntimeExecutionCandidateScope } from "./buildRuntimeExecutionCandidateScope";
import { detectRuntimeExecutionCandidateBlockers } from "./detectRuntimeExecutionCandidateBlockers";
import { evaluateRuntimeExecutionCandidate } from "./evaluateRuntimeExecutionCandidate";
import type {
  RuntimeExecutionCandidateBlockersReport,
  RuntimeExecutionCandidatePlanningReports,
  RuntimeExecutionCandidatePreconditions,
  RuntimeExecutionCandidateSummary,
} from "./runtimeExecutionCandidateTypes";
import { mergeSortedUniqueKo } from "./runtimeExecutionCandidateMerge";

export type { RuntimeExecutionCandidatePlanningReports } from "./runtimeExecutionCandidateTypes";

export function buildRuntimeExecutionCandidatePlanningReports(
  reports: RuntimeSemanticPlanningReportsBeforeExecutionCandidate
): RuntimeExecutionCandidatePlanningReports {
  const preconditionsList = buildRuntimeExecutionCandidatePreconditions(reports);
  const blockersList = detectRuntimeExecutionCandidateBlockers(reports);
  const evaluated = evaluateRuntimeExecutionCandidate(reports, blockersList);

  const runtimeExecutionCandidatePreconditions: RuntimeExecutionCandidatePreconditions = {
    mode: "runtime_execution_candidate_preconditions",
    actualRuntimeOrchestrationEnabled: false,
    actualExecutionEnabled: false,
    preconditions: preconditionsList,
  };

  const runtimeExecutionCandidateBlockers: RuntimeExecutionCandidateBlockersReport = {
    mode: "runtime_execution_candidate_blockers",
    actualRuntimeOrchestrationEnabled: false,
    actualExecutionEnabled: false,
    blockers: blockersList,
  };

  const runtimeExecutionCandidateScope = buildRuntimeExecutionCandidateScope({
    reports,
    candidateStatus: evaluated.candidateStatus,
  });

  const recommendations = mergeSortedUniqueKo([
    ...reports.runtimeResourceAllocationTrialReport.recommendations,
    ...reports.runtimeResourceGovernanceSummary.recommendations,
    ...reports.runtimeControlBoundarySummary.recommendations,
    ...evaluated.recommendationExtras,
  ]);

  const runtimeExecutionCandidateSummary: RuntimeExecutionCandidateSummary = {
    mode: "runtime_execution_candidate_summary",
    actualRuntimeOrchestrationEnabled: false,
    actualExecutionEnabled: false,
    candidateStatus: evaluated.candidateStatus,
    candidateRisk: evaluated.candidateRisk,
    rationaleKo: evaluated.rationaleKo,
    candidatePreconditions: preconditionsList,
    candidateBlockers: blockersList,
    requiredApprovals: evaluated.requiredApprovals,
    rollbackPrerequisites: evaluated.rollbackPrerequisites,
    recommendations,
  };

  return {
    runtimeExecutionCandidateSummary,
    runtimeExecutionCandidateScope,
    runtimeExecutionCandidatePreconditions,
    runtimeExecutionCandidateBlockers,
  };
}
