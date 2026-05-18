/**
 * H41 / H41.5 — controlled activation candidate planning reports 일괄 산출(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeControlledActivationCandidate } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { mergeRuntimeLayerRecommendations } from "@/lib/harness/runtimeShared/runtimeRecommendationHelpers";
import { buildRuntimeControlHandoffBoundary } from "./buildRuntimeControlHandoffBoundary";
import { buildRuntimeControlledActivationCandidateAlignmentReport } from "./buildRuntimeControlledActivationCandidateAlignmentReport";
import { buildRuntimeControlledActivationCandidateFinalSafetyGate } from "./buildRuntimeControlledActivationCandidateFinalSafetyGate";
import { buildRuntimeControlledActivationCandidatePolicy } from "./buildRuntimeControlledActivationCandidatePolicy";
import { buildRuntimeControlledActivationCandidateScope } from "./buildRuntimeControlledActivationCandidateScope";
import { buildRuntimeControlledActivationReadinessChecklist } from "./buildRuntimeControlledActivationReadinessChecklist";
import { detectRuntimeControlledActivationCandidateBlockers } from "./detectRuntimeControlledActivationCandidateBlockers";
import { detectRuntimeControlledActivationCandidateViolations } from "./detectRuntimeControlledActivationCandidateViolations";
import { evaluateRuntimeControlledActivationCandidate } from "./evaluateRuntimeControlledActivationCandidate";
import { resolveRuntimeControlledActivationMode } from "./resolveRuntimeControlledActivationMode";
import { verifyRuntimeControlledActivationCandidateReadiness } from "./verifyRuntimeControlledActivationCandidateReadiness";
import { RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_ACTUAL_FLAGS_DISABLED } from "./runtimeControlledActivationCandidateConstants";
import type {
  RuntimeControlledActivationCandidatePlanningReports,
  RuntimeControlledActivationCandidateStatus,
} from "./runtimeControlledActivationCandidateTypes";

export type { RuntimeControlledActivationCandidatePlanningReports } from "./runtimeControlledActivationCandidateTypes";

function activationRationaleKo(status: RuntimeControlledActivationCandidateStatus): string {
  switch (status) {
    case "controlled_activation_metadata_candidate":
      return "ultimate governance final gate·H41 entry readiness 정렬 — controlled activation 메타 후보(실제 activation·orchestration·execution 없음).";
    case "watch":
      return "controlled activation candidate 주시 — ultimate governance partial·wording risk(activation·blocking 금지).";
    case "blocked":
      return "controlled activation candidate 차단 — ultimate governance final gate·blocker 정렬 필요.";
    default:
      return "controlled activation 미후보 — ultimate governance review final safety gate 선행.";
  }
}

export function buildRuntimeControlledActivationCandidatePlanningReports(
  reports: RuntimeSemanticPlanningReportsBeforeControlledActivationCandidate
): RuntimeControlledActivationCandidatePlanningReports {
  const runtimeControlledActivationCandidateBlockerReport =
    detectRuntimeControlledActivationCandidateBlockers(reports);
  const candidateStatus = evaluateRuntimeControlledActivationCandidate({
    reports,
    blockerReport: runtimeControlledActivationCandidateBlockerReport,
  });
  const activationMode = resolveRuntimeControlledActivationMode(candidateStatus);

  const runtimeControlHandoffBoundary = buildRuntimeControlHandoffBoundary(reports);
  const runtimeControlledActivationCandidateScope = buildRuntimeControlledActivationCandidateScope(reports);
  const runtimeControlledActivationCandidatePolicy = buildRuntimeControlledActivationCandidatePolicy({
    candidateStatus,
  });
  const runtimeControlledActivationReadinessChecklist = buildRuntimeControlledActivationReadinessChecklist({
    reports,
    blockerReport: runtimeControlledActivationCandidateBlockerReport,
  });

  const runtimeControlledActivationCandidateSummaryDraft = {
    mode: "runtime_controlled_activation_candidate_summary" as const,
    ...RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_ACTUAL_FLAGS_DISABLED,
    candidateStatus,
    activationMode,
    rationaleKo: activationRationaleKo(candidateStatus),
    activationBlockers: mergeSortedUniqueKo([
      ...runtimeControlledActivationCandidateBlockerReport.blockers,
      ...runtimeControlledActivationReadinessChecklist.blockers,
      ...reports.runtimeUltimateGovernanceReviewSummary.reviewBlockers.slice(0, 3),
    ]),
    recommendations: mergeRuntimeLayerRecommendations([
      runtimeControlledActivationCandidateBlockerReport,
      runtimeControlHandoffBoundary,
      runtimeControlledActivationCandidateScope,
      runtimeControlledActivationCandidatePolicy,
      runtimeControlledActivationReadinessChecklist,
    ]),
  };

  const runtimeControlledActivationCandidateViolationReport = detectRuntimeControlledActivationCandidateViolations({
    summary: runtimeControlledActivationCandidateSummaryDraft,
    policy: runtimeControlledActivationCandidatePolicy,
  });

  const runtimeControlledActivationCandidateVerificationReport =
    verifyRuntimeControlledActivationCandidateReadiness({
      summary: runtimeControlledActivationCandidateSummaryDraft,
      handoff: runtimeControlHandoffBoundary,
      scope: runtimeControlledActivationCandidateScope,
      policy: runtimeControlledActivationCandidatePolicy,
      checklist: runtimeControlledActivationReadinessChecklist,
      blockerReport: runtimeControlledActivationCandidateBlockerReport,
    });

  const runtimeControlledActivationCandidateAlignmentReport =
    buildRuntimeControlledActivationCandidateAlignmentReport({
      reports,
      summary: runtimeControlledActivationCandidateSummaryDraft,
      handoff: runtimeControlHandoffBoundary,
      scope: runtimeControlledActivationCandidateScope,
      policy: runtimeControlledActivationCandidatePolicy,
      checklist: runtimeControlledActivationReadinessChecklist,
      blockerReport: runtimeControlledActivationCandidateBlockerReport,
      boundaryViolation: runtimeControlledActivationCandidateViolationReport,
    });

  const runtimeControlledActivationCandidateFinalSafetyGate = buildRuntimeControlledActivationCandidateFinalSafetyGate({
    summary: runtimeControlledActivationCandidateSummaryDraft,
    blockerReport: runtimeControlledActivationCandidateBlockerReport,
    boundaryViolation: runtimeControlledActivationCandidateViolationReport,
    readinessVerification: runtimeControlledActivationCandidateVerificationReport,
    alignmentReport: runtimeControlledActivationCandidateAlignmentReport,
  });

  const runtimeControlledActivationCandidateSummary = {
    ...runtimeControlledActivationCandidateSummaryDraft,
    recommendations: mergeRuntimeLayerRecommendations([
      runtimeControlledActivationCandidateSummaryDraft,
      runtimeControlHandoffBoundary,
      runtimeControlledActivationCandidateScope,
      runtimeControlledActivationCandidatePolicy,
      runtimeControlledActivationReadinessChecklist,
      runtimeControlledActivationCandidateViolationReport,
      runtimeControlledActivationCandidateVerificationReport,
      runtimeControlledActivationCandidateAlignmentReport,
      runtimeControlledActivationCandidateFinalSafetyGate,
    ]),
  };

  return {
    runtimeControlledActivationCandidateSummary,
    runtimeControlHandoffBoundary,
    runtimeControlledActivationCandidateScope,
    runtimeControlledActivationCandidatePolicy,
    runtimeControlledActivationCandidateBlockerReport,
    runtimeControlledActivationReadinessChecklist,
    runtimeControlledActivationCandidateViolationReport,
    runtimeControlledActivationCandidateVerificationReport,
    runtimeControlledActivationCandidateAlignmentReport,
    runtimeControlledActivationCandidateFinalSafetyGate,
  };
}
