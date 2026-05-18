/**
 * H37 / H37.5 — execution governance boundary planning reports 일괄 산출(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeExecutionGovernanceBoundary } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { buildRuntimeExecutionGovernanceBoundaryAlignmentReport } from "./buildRuntimeExecutionGovernanceBoundaryAlignmentReport";
import { buildRuntimeExecutionGovernanceBoundaryFinalSafetyGate } from "./buildRuntimeExecutionGovernanceBoundaryFinalSafetyGate";
import { buildRuntimeExecutionGovernanceBoundaryPolicy } from "./buildRuntimeExecutionGovernanceBoundaryPolicy";
import { buildRuntimeExecutionGovernanceBoundaryReadinessChecklist } from "./buildRuntimeExecutionGovernanceBoundaryReadinessChecklist";
import { buildRuntimeExecutionGovernanceBoundaryScope } from "./buildRuntimeExecutionGovernanceBoundaryScope";
import { detectRuntimeExecutionGovernanceBoundaryBlockers } from "./detectRuntimeExecutionGovernanceBoundaryBlockers";
import { detectRuntimeExecutionGovernanceBoundaryViolations } from "./detectRuntimeExecutionGovernanceBoundaryViolations";
import { evaluateRuntimeExecutionGovernanceBoundaryCandidate } from "./evaluateRuntimeExecutionGovernanceBoundaryCandidate";
import { resolveRuntimeExecutionGovernanceBoundaryHardeningReadiness } from "./resolveRuntimeExecutionGovernanceBoundaryHardeningReadiness";
import { resolveRuntimeExecutionGovernanceBoundaryMode } from "./resolveRuntimeExecutionGovernanceBoundaryMode";
import { verifyRuntimeExecutionGovernanceBoundaryReadiness } from "./verifyRuntimeExecutionGovernanceBoundaryReadiness";
import type {
  RuntimeExecutionGovernanceBoundaryCandidateStatus,
  RuntimeExecutionGovernanceBoundaryPlanningReports,
} from "./runtimeExecutionGovernanceBoundaryTypes";

export type { RuntimeExecutionGovernanceBoundaryPlanningReports } from "./runtimeExecutionGovernanceBoundaryTypes";

function governanceRationaleKo(status: RuntimeExecutionGovernanceBoundaryCandidateStatus): string {
  switch (status) {
    case "governance_boundary_metadata_candidate":
      return "final execution governance boundary 후보 — execution boundary shell final gate·alignment 정렬(실제 execution·governance enforcement 없음).";
    case "watch":
      return "governance boundary 주시 — shell watch·partial verification(execution·routing 금지).";
    case "blocked":
      return "governance boundary 차단 — shell final gate·blocker 정렬 필요.";
    default:
      return "governance boundary 미후보 — H36.5 execution boundary shell final gate 선행.";
  }
}

function mergeGovernanceLayerRecommendations(
  parts: readonly { readonly recommendations: readonly string[] }[]
): readonly string[] {
  return mergeSortedUniqueKo(parts.flatMap((part) => [...part.recommendations]));
}

export function buildRuntimeExecutionGovernanceBoundaryPlanningReports(
  reports: RuntimeSemanticPlanningReportsBeforeExecutionGovernanceBoundary
): RuntimeExecutionGovernanceBoundaryPlanningReports {
  const runtimeExecutionGovernanceBoundaryBlockerReport = detectRuntimeExecutionGovernanceBoundaryBlockers(reports);
  const candidateStatus = evaluateRuntimeExecutionGovernanceBoundaryCandidate({
    reports,
    blockerReport: runtimeExecutionGovernanceBoundaryBlockerReport,
  });
  const governanceMode = resolveRuntimeExecutionGovernanceBoundaryMode(candidateStatus);
  const hardeningReadiness = resolveRuntimeExecutionGovernanceBoundaryHardeningReadiness(candidateStatus);

  const runtimeExecutionGovernanceBoundaryScope = buildRuntimeExecutionGovernanceBoundaryScope(reports);
  const runtimeExecutionGovernanceBoundaryPolicy = buildRuntimeExecutionGovernanceBoundaryPolicy({ candidateStatus });
  const runtimeExecutionGovernanceBoundaryReadinessChecklist = buildRuntimeExecutionGovernanceBoundaryReadinessChecklist({
    reports,
    blockerReport: runtimeExecutionGovernanceBoundaryBlockerReport,
  });

  const runtimeExecutionGovernanceBoundarySummaryDraft = {
    mode: "runtime_execution_governance_boundary_summary" as const,
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
    candidateStatus,
    governanceMode,
    hardeningReadiness,
    rationaleKo: governanceRationaleKo(candidateStatus),
    governanceBlockers: mergeSortedUniqueKo([
      ...runtimeExecutionGovernanceBoundaryBlockerReport.blockers,
      ...runtimeExecutionGovernanceBoundaryReadinessChecklist.blockers,
      ...reports.runtimeExecutionBoundaryShellSummary.shellBlockers.slice(0, 3),
    ]),
    recommendations: mergeSortedUniqueKo([
      ...runtimeExecutionGovernanceBoundaryBlockerReport.recommendations,
      ...runtimeExecutionGovernanceBoundaryScope.recommendations,
      ...runtimeExecutionGovernanceBoundaryPolicy.recommendations,
      ...runtimeExecutionGovernanceBoundaryReadinessChecklist.recommendations,
    ]),
  };

  const runtimeExecutionGovernanceBoundaryViolationReport = detectRuntimeExecutionGovernanceBoundaryViolations({
    summary: runtimeExecutionGovernanceBoundarySummaryDraft,
    policy: runtimeExecutionGovernanceBoundaryPolicy,
  });

  const runtimeExecutionGovernanceBoundaryReadinessVerificationReport =
    verifyRuntimeExecutionGovernanceBoundaryReadiness({
      summary: runtimeExecutionGovernanceBoundarySummaryDraft,
      scope: runtimeExecutionGovernanceBoundaryScope,
      policy: runtimeExecutionGovernanceBoundaryPolicy,
      checklist: runtimeExecutionGovernanceBoundaryReadinessChecklist,
      blockerReport: runtimeExecutionGovernanceBoundaryBlockerReport,
    });

  const runtimeExecutionGovernanceBoundaryAlignmentReport = buildRuntimeExecutionGovernanceBoundaryAlignmentReport({
    summary: runtimeExecutionGovernanceBoundarySummaryDraft,
    scope: runtimeExecutionGovernanceBoundaryScope,
    policy: runtimeExecutionGovernanceBoundaryPolicy,
    checklist: runtimeExecutionGovernanceBoundaryReadinessChecklist,
    blockerReport: runtimeExecutionGovernanceBoundaryBlockerReport,
    boundaryViolation: runtimeExecutionGovernanceBoundaryViolationReport,
  });

  const runtimeExecutionGovernanceBoundaryFinalSafetyGate = buildRuntimeExecutionGovernanceBoundaryFinalSafetyGate({
    summary: runtimeExecutionGovernanceBoundarySummaryDraft,
    blockerReport: runtimeExecutionGovernanceBoundaryBlockerReport,
    boundaryViolation: runtimeExecutionGovernanceBoundaryViolationReport,
    readinessVerification: runtimeExecutionGovernanceBoundaryReadinessVerificationReport,
    alignmentReport: runtimeExecutionGovernanceBoundaryAlignmentReport,
  });

  const runtimeExecutionGovernanceBoundarySummary = {
    ...runtimeExecutionGovernanceBoundarySummaryDraft,
    recommendations: mergeGovernanceLayerRecommendations([
      runtimeExecutionGovernanceBoundarySummaryDraft,
      runtimeExecutionGovernanceBoundaryViolationReport,
      runtimeExecutionGovernanceBoundaryReadinessVerificationReport,
      runtimeExecutionGovernanceBoundaryAlignmentReport,
      runtimeExecutionGovernanceBoundaryFinalSafetyGate,
    ]),
  };

  return {
    runtimeExecutionGovernanceBoundarySummary,
    runtimeExecutionGovernanceBoundaryScope,
    runtimeExecutionGovernanceBoundaryPolicy,
    runtimeExecutionGovernanceBoundaryBlockerReport,
    runtimeExecutionGovernanceBoundaryReadinessChecklist,
    runtimeExecutionGovernanceBoundaryViolationReport,
    runtimeExecutionGovernanceBoundaryReadinessVerificationReport,
    runtimeExecutionGovernanceBoundaryAlignmentReport,
    runtimeExecutionGovernanceBoundaryFinalSafetyGate,
  };
}
