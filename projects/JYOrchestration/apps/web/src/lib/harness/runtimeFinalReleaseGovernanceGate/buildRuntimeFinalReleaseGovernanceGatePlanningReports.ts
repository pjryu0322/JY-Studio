/**
 * H39 / H39.5 — final release governance gate planning reports 일괄 산출(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeFinalReleaseGovernanceGate } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { mergeRuntimeLayerRecommendations } from "@/lib/harness/runtimeShared/runtimeRecommendationHelpers";
import { buildRuntimeFinalReleaseGovernanceGateAlignmentReport } from "./buildRuntimeFinalReleaseGovernanceGateAlignmentReport";
import { buildRuntimeFinalReleaseGovernanceGateFinalSafetyGate } from "./buildRuntimeFinalReleaseGovernanceGateFinalSafetyGate";
import { buildRuntimeFinalReleaseGovernanceGatePolicy } from "./buildRuntimeFinalReleaseGovernanceGatePolicy";
import { buildRuntimeFinalReleaseGovernanceGateReadinessChecklist } from "./buildRuntimeFinalReleaseGovernanceGateReadinessChecklist";
import { buildRuntimeFinalReleaseGovernanceGateScope } from "./buildRuntimeFinalReleaseGovernanceGateScope";
import { detectRuntimeFinalReleaseGovernanceGateBlockers } from "./detectRuntimeFinalReleaseGovernanceGateBlockers";
import { detectRuntimeFinalReleaseGovernanceGateViolations } from "./detectRuntimeFinalReleaseGovernanceGateViolations";
import { evaluateRuntimeFinalReleaseGovernanceGateCandidate } from "./evaluateRuntimeFinalReleaseGovernanceGateCandidate";
import { resolveRuntimeFinalReleaseGovernanceGateMode } from "./resolveRuntimeFinalReleaseGovernanceGateMode";
import { RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_ACTUAL_FLAGS_DISABLED } from "./runtimeFinalReleaseGovernanceGateConstants";
import { verifyRuntimeFinalReleaseGovernanceGateReadiness } from "./verifyRuntimeFinalReleaseGovernanceGateReadiness";
import type {
  RuntimeFinalReleaseGovernanceGateCandidateStatus,
  RuntimeFinalReleaseGovernanceGatePlanningReports,
} from "./runtimeFinalReleaseGovernanceGateTypes";

export type { RuntimeFinalReleaseGovernanceGatePlanningReports } from "./runtimeFinalReleaseGovernanceGateTypes";

function gateRationaleKo(status: RuntimeFinalReleaseGovernanceGateCandidateStatus): string {
  switch (status) {
    case "final_release_governance_gate_metadata_candidate":
      return "governance release-readiness final gate·H39 entry readiness 정렬 — final release governance gate 메타 후보(실제 release·execution·approval enforcement 없음).";
    case "watch":
      return "final release governance gate 주시 — release-readiness partial·wording risk(집행·blocking 금지).";
    case "blocked":
      return "final release governance gate 차단 — release-readiness final gate·blocker 정렬 필요.";
    default:
      return "final release governance gate 미후보 — governance release-readiness final safety gate 선행.";
  }
}

export function buildRuntimeFinalReleaseGovernanceGatePlanningReports(
  reports: RuntimeSemanticPlanningReportsBeforeFinalReleaseGovernanceGate
): RuntimeFinalReleaseGovernanceGatePlanningReports {
  const runtimeFinalReleaseGovernanceGateBlockerReport = detectRuntimeFinalReleaseGovernanceGateBlockers(reports);
  const candidateStatus = evaluateRuntimeFinalReleaseGovernanceGateCandidate({
    reports,
    blockerReport: runtimeFinalReleaseGovernanceGateBlockerReport,
  });
  const gateMode = resolveRuntimeFinalReleaseGovernanceGateMode(candidateStatus);

  const runtimeFinalReleaseGovernanceGateScope = buildRuntimeFinalReleaseGovernanceGateScope(reports);
  const runtimeFinalReleaseGovernanceGatePolicy = buildRuntimeFinalReleaseGovernanceGatePolicy({ candidateStatus });
  const runtimeFinalReleaseGovernanceGateReadinessChecklist = buildRuntimeFinalReleaseGovernanceGateReadinessChecklist({
    reports,
    blockerReport: runtimeFinalReleaseGovernanceGateBlockerReport,
  });

  const runtimeFinalReleaseGovernanceGateSummaryDraft = {
    mode: "runtime_final_release_governance_gate_summary" as const,
    ...RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_ACTUAL_FLAGS_DISABLED,
    candidateStatus,
    gateMode,
    rationaleKo: gateRationaleKo(candidateStatus),
    gateBlockers: mergeSortedUniqueKo([
      ...runtimeFinalReleaseGovernanceGateBlockerReport.blockers,
      ...runtimeFinalReleaseGovernanceGateReadinessChecklist.blockers,
      ...reports.runtimeGovernanceReleaseReadinessSummary.readinessBlockers.slice(0, 3),
    ]),
    recommendations: mergeSortedUniqueKo([
      ...runtimeFinalReleaseGovernanceGateBlockerReport.recommendations,
      ...runtimeFinalReleaseGovernanceGateScope.recommendations,
      ...runtimeFinalReleaseGovernanceGatePolicy.recommendations,
      ...runtimeFinalReleaseGovernanceGateReadinessChecklist.recommendations,
    ]),
  };

  const runtimeFinalReleaseGovernanceGateViolationReport = detectRuntimeFinalReleaseGovernanceGateViolations({
    summary: runtimeFinalReleaseGovernanceGateSummaryDraft,
    policy: runtimeFinalReleaseGovernanceGatePolicy,
  });

  const runtimeFinalReleaseGovernanceGateVerificationReport = verifyRuntimeFinalReleaseGovernanceGateReadiness({
    summary: runtimeFinalReleaseGovernanceGateSummaryDraft,
    scope: runtimeFinalReleaseGovernanceGateScope,
    policy: runtimeFinalReleaseGovernanceGatePolicy,
    checklist: runtimeFinalReleaseGovernanceGateReadinessChecklist,
    blockerReport: runtimeFinalReleaseGovernanceGateBlockerReport,
  });

  const runtimeFinalReleaseGovernanceGateAlignmentReport = buildRuntimeFinalReleaseGovernanceGateAlignmentReport({
    reports,
    summary: runtimeFinalReleaseGovernanceGateSummaryDraft,
    scope: runtimeFinalReleaseGovernanceGateScope,
    policy: runtimeFinalReleaseGovernanceGatePolicy,
    checklist: runtimeFinalReleaseGovernanceGateReadinessChecklist,
    blockerReport: runtimeFinalReleaseGovernanceGateBlockerReport,
    boundaryViolation: runtimeFinalReleaseGovernanceGateViolationReport,
  });

  const runtimeFinalReleaseGovernanceGateFinalSafetyGate = buildRuntimeFinalReleaseGovernanceGateFinalSafetyGate({
    summary: runtimeFinalReleaseGovernanceGateSummaryDraft,
    blockerReport: runtimeFinalReleaseGovernanceGateBlockerReport,
    boundaryViolation: runtimeFinalReleaseGovernanceGateViolationReport,
    readinessVerification: runtimeFinalReleaseGovernanceGateVerificationReport,
    alignmentReport: runtimeFinalReleaseGovernanceGateAlignmentReport,
  });

  const runtimeFinalReleaseGovernanceGateSummary = {
    ...runtimeFinalReleaseGovernanceGateSummaryDraft,
    recommendations: mergeRuntimeLayerRecommendations([
      runtimeFinalReleaseGovernanceGateSummaryDraft,
      runtimeFinalReleaseGovernanceGateScope,
      runtimeFinalReleaseGovernanceGatePolicy,
      runtimeFinalReleaseGovernanceGateReadinessChecklist,
      runtimeFinalReleaseGovernanceGateViolationReport,
      runtimeFinalReleaseGovernanceGateVerificationReport,
      runtimeFinalReleaseGovernanceGateAlignmentReport,
      runtimeFinalReleaseGovernanceGateFinalSafetyGate,
    ]),
  };

  return {
    runtimeFinalReleaseGovernanceGateSummary,
    runtimeFinalReleaseGovernanceGateScope,
    runtimeFinalReleaseGovernanceGatePolicy,
    runtimeFinalReleaseGovernanceGateBlockerReport,
    runtimeFinalReleaseGovernanceGateReadinessChecklist,
    runtimeFinalReleaseGovernanceGateViolationReport,
    runtimeFinalReleaseGovernanceGateVerificationReport,
    runtimeFinalReleaseGovernanceGateAlignmentReport,
    runtimeFinalReleaseGovernanceGateFinalSafetyGate,
  };
}
