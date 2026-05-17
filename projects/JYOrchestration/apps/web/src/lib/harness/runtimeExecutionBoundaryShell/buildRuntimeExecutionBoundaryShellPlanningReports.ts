/**
 * H36 / H36.5 — execution boundary metadata shell planning reports 일괄 산출(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeExecutionBoundaryShell } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { buildRuntimeExecutionBoundaryShellAlignmentReport } from "./buildRuntimeExecutionBoundaryShellAlignmentReport";
import { buildRuntimeExecutionBoundaryShellFinalSafetyGate } from "./buildRuntimeExecutionBoundaryShellFinalSafetyGate";
import { buildRuntimeExecutionBoundaryShellPolicy } from "./buildRuntimeExecutionBoundaryShellPolicy";
import { buildRuntimeExecutionBoundaryShellReadinessChecklist } from "./buildRuntimeExecutionBoundaryShellReadinessChecklist";
import { buildRuntimeExecutionBoundaryShellScope } from "./buildRuntimeExecutionBoundaryShellScope";
import { detectRuntimeExecutionBoundaryShellBlockers } from "./detectRuntimeExecutionBoundaryShellBlockers";
import { detectRuntimeExecutionBoundaryShellBoundaryViolations } from "./detectRuntimeExecutionBoundaryShellBoundaryViolations";
import { evaluateRuntimeExecutionBoundaryShellCandidate } from "./evaluateRuntimeExecutionBoundaryShellCandidate";
import { resolveRuntimeExecutionBoundaryShellMode } from "./resolveRuntimeExecutionBoundaryShellMode";
import { verifyRuntimeExecutionBoundaryShellReadiness } from "./verifyRuntimeExecutionBoundaryShellReadiness";
import type {
  RuntimeExecutionBoundaryShellCandidateStatus,
  RuntimeExecutionBoundaryShellPlanningReports,
} from "./runtimeExecutionBoundaryShellTypes";

export type { RuntimeExecutionBoundaryShellPlanningReports } from "./runtimeExecutionBoundaryShellTypes";

function shellRationaleKo(status: RuntimeExecutionBoundaryShellCandidateStatus): string {
  switch (status) {
    case "boundary_shell_metadata_candidate":
      return "execution boundary metadata shell 후보 — preflight final gate·alignment 정렬(실제 execution·routing 없음).";
    case "watch":
      return "execution boundary shell 주시 — preflight watch·partial verification(execution 금지).";
    case "blocked":
      return "execution boundary shell 차단 — preflight·blocker 정렬 필요.";
    default:
      return "execution boundary shell 미후보 — H35.5 preflight final gate 선행.";
  }
}

function mergeShellLayerRecommendations(
  parts: readonly { readonly recommendations: readonly string[] }[]
): readonly string[] {
  return mergeSortedUniqueKo(parts.flatMap((part) => [...part.recommendations]));
}

export function buildRuntimeExecutionBoundaryShellPlanningReports(
  reports: RuntimeSemanticPlanningReportsBeforeExecutionBoundaryShell
): RuntimeExecutionBoundaryShellPlanningReports {
  const runtimeExecutionBoundaryShellBlockerReport = detectRuntimeExecutionBoundaryShellBlockers(reports);
  const candidateStatus = evaluateRuntimeExecutionBoundaryShellCandidate({
    reports,
    blockerReport: runtimeExecutionBoundaryShellBlockerReport,
  });
  const shellMode = resolveRuntimeExecutionBoundaryShellMode(candidateStatus);

  const runtimeExecutionBoundaryShellScope = buildRuntimeExecutionBoundaryShellScope(reports);
  const runtimeExecutionBoundaryShellPolicy = buildRuntimeExecutionBoundaryShellPolicy({ candidateStatus });
  const runtimeExecutionBoundaryShellReadinessChecklist = buildRuntimeExecutionBoundaryShellReadinessChecklist({
    reports,
    blockerReport: runtimeExecutionBoundaryShellBlockerReport,
  });

  const runtimeExecutionBoundaryShellSummaryDraft = {
    mode: "runtime_execution_boundary_shell_summary" as const,
    actualRuntimeOrchestrationEnabled: false as const,
    actualPilotExecutionEnabled: false as const,
    actualNoopShellExecutionEnabled: false as const,
    actualExecutionShellExecutionEnabled: false as const,
    actualReleaseEnforcementEnabled: false as const,
    actualRuntimeAdapterInvocationEnabled: false as const,
    actualExecutionEnabled: false as const,
    actualProviderRoutingEnabled: false as const,
    actualQueueControlEnabled: false as const,
    actualRollbackExecutionEnabled: false as const,
    candidateStatus,
    shellMode,
    rationaleKo: shellRationaleKo(candidateStatus),
    shellBlockers: mergeSortedUniqueKo([
      ...runtimeExecutionBoundaryShellBlockerReport.blockers,
      ...runtimeExecutionBoundaryShellReadinessChecklist.blockers,
      ...reports.runtimeReleaseGatePreflightSummary.preflightBlockers.slice(0, 3),
    ]),
    recommendations: mergeSortedUniqueKo([
      ...runtimeExecutionBoundaryShellBlockerReport.recommendations,
      ...runtimeExecutionBoundaryShellScope.recommendations,
      ...runtimeExecutionBoundaryShellPolicy.recommendations,
      ...runtimeExecutionBoundaryShellReadinessChecklist.recommendations,
    ]),
  };

  const runtimeExecutionBoundaryShellBoundaryViolationReport = detectRuntimeExecutionBoundaryShellBoundaryViolations({
    summary: runtimeExecutionBoundaryShellSummaryDraft,
    policy: runtimeExecutionBoundaryShellPolicy,
  });

  const runtimeExecutionBoundaryShellReadinessVerificationReport = verifyRuntimeExecutionBoundaryShellReadiness({
    summary: runtimeExecutionBoundaryShellSummaryDraft,
    scope: runtimeExecutionBoundaryShellScope,
    policy: runtimeExecutionBoundaryShellPolicy,
    checklist: runtimeExecutionBoundaryShellReadinessChecklist,
    blockerReport: runtimeExecutionBoundaryShellBlockerReport,
  });

  const runtimeExecutionBoundaryShellAlignmentReport = buildRuntimeExecutionBoundaryShellAlignmentReport({
    summary: runtimeExecutionBoundaryShellSummaryDraft,
    scope: runtimeExecutionBoundaryShellScope,
    policy: runtimeExecutionBoundaryShellPolicy,
    checklist: runtimeExecutionBoundaryShellReadinessChecklist,
    blockerReport: runtimeExecutionBoundaryShellBlockerReport,
    boundaryViolation: runtimeExecutionBoundaryShellBoundaryViolationReport,
  });

  const runtimeExecutionBoundaryShellFinalSafetyGate = buildRuntimeExecutionBoundaryShellFinalSafetyGate({
    summary: runtimeExecutionBoundaryShellSummaryDraft,
    blockerReport: runtimeExecutionBoundaryShellBlockerReport,
    boundaryViolation: runtimeExecutionBoundaryShellBoundaryViolationReport,
    readinessVerification: runtimeExecutionBoundaryShellReadinessVerificationReport,
    alignmentReport: runtimeExecutionBoundaryShellAlignmentReport,
  });

  const runtimeExecutionBoundaryShellSummary = {
    ...runtimeExecutionBoundaryShellSummaryDraft,
    recommendations: mergeShellLayerRecommendations([
      runtimeExecutionBoundaryShellSummaryDraft,
      runtimeExecutionBoundaryShellBoundaryViolationReport,
      runtimeExecutionBoundaryShellReadinessVerificationReport,
      runtimeExecutionBoundaryShellAlignmentReport,
      runtimeExecutionBoundaryShellFinalSafetyGate,
    ]),
  };

  return {
    runtimeExecutionBoundaryShellSummary,
    runtimeExecutionBoundaryShellScope,
    runtimeExecutionBoundaryShellPolicy,
    runtimeExecutionBoundaryShellBlockerReport,
    runtimeExecutionBoundaryShellReadinessChecklist,
    runtimeExecutionBoundaryShellBoundaryViolationReport,
    runtimeExecutionBoundaryShellReadinessVerificationReport,
    runtimeExecutionBoundaryShellAlignmentReport,
    runtimeExecutionBoundaryShellFinalSafetyGate,
  };
}
