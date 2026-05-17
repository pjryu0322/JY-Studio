/**
 * H39 / H39.5 — final release governance gate planning reports 일괄 산출(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeFinalReleaseGovernanceGate } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { buildRuntimeFinalReleaseGovernanceGateAlignmentReport } from "./buildRuntimeFinalReleaseGovernanceGateAlignmentReport";
import { buildRuntimeFinalReleaseGovernanceGateFinalSafetyGate } from "./buildRuntimeFinalReleaseGovernanceGateFinalSafetyGate";
import { buildRuntimeFinalReleaseGovernanceGatePolicy } from "./buildRuntimeFinalReleaseGovernanceGatePolicy";
import { buildRuntimeFinalReleaseGovernanceGateReadinessChecklist } from "./buildRuntimeFinalReleaseGovernanceGateReadinessChecklist";
import { buildRuntimeFinalReleaseGovernanceGateScope } from "./buildRuntimeFinalReleaseGovernanceGateScope";
import { detectRuntimeFinalReleaseGovernanceGateBlockers } from "./detectRuntimeFinalReleaseGovernanceGateBlockers";
import { detectRuntimeFinalReleaseGovernanceGateViolations } from "./detectRuntimeFinalReleaseGovernanceGateViolations";
import { evaluateRuntimeFinalReleaseGovernanceGateCandidate } from "./evaluateRuntimeFinalReleaseGovernanceGateCandidate";
import { resolveRuntimeFinalReleaseGovernanceGateMode } from "./resolveRuntimeFinalReleaseGovernanceGateMode";
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

function mergeFinalReleaseGateLayerRecommendations(
  parts: readonly { readonly recommendations: readonly string[] }[]
): readonly string[] {
  return mergeSortedUniqueKo(parts.flatMap((part) => [...part.recommendations]));
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
    actualRuntimeOrchestrationEnabled: false as const,
    actualPilotExecutionEnabled: false as const,
    actualNoopShellExecutionEnabled: false as const,
    actualExecutionShellExecutionEnabled: false as const,
    actualReleaseEnforcementEnabled: false as const,
    actualRuntimeAdapterInvocationEnabled: false as const,
    actualExecutionEnabled: false as const,
    actualExecutionRoutingEnabled: false as const,
    actualProviderRoutingEnabled: false as const,
    actualQueueControlEnabled: false as const,
    actualRollbackExecutionEnabled: false as const,
    actualApprovalEnforcementEnabled: false as const,
    actualExecutionBlockingEnabled: false as const,
    actualMergeBlockingEnabled: false as const,
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
    recommendations: mergeFinalReleaseGateLayerRecommendations([
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
