/**
 * H31 / H31.5 — no-op execution shell planning reports 일괄 산출(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeNoopExecutionShell } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { buildRuntimeNoopExecutionShellPolicy } from "./buildRuntimeNoopExecutionShellPolicy";
import { buildRuntimeNoopExecutionShellReadinessChecklist } from "./buildRuntimeNoopExecutionShellReadinessChecklist";
import { buildRuntimeNoopExecutionShellScope } from "./buildRuntimeNoopExecutionShellScope";
import { detectRuntimeNoopExecutionShellBlockers } from "./detectRuntimeNoopExecutionShellBlockers";
import { evaluateRuntimeNoopExecutionShellCandidate } from "./evaluateRuntimeNoopExecutionShellCandidate";
import { resolveRuntimeNoopExecutionShellMode } from "./resolveRuntimeNoopExecutionShellMode";
import { detectRuntimeNoopExecutionShellBoundaryViolations } from "./detectRuntimeNoopExecutionShellBoundaryViolations";
import { verifyRuntimeNoopExecutionShellReadiness } from "./verifyRuntimeNoopExecutionShellReadiness";
import { buildRuntimeNoopExecutionShellFinalSafetyGate } from "./buildRuntimeNoopExecutionShellFinalSafetyGate";
import type {
  RuntimeNoopExecutionShellBlockerReport,
  RuntimeNoopExecutionShellCandidateStatus,
  RuntimeNoopExecutionShellPlanningReports,
  RuntimeNoopExecutionShellPolicy,
  RuntimeNoopExecutionShellReadinessChecklist,
  RuntimeNoopExecutionShellScope,
  RuntimeNoopExecutionShellSummary,
} from "./runtimeNoopExecutionShellTypes";

function buildNoopExecutionShellStabilizationReports(input: {
  readonly summary: RuntimeNoopExecutionShellSummary;
  readonly scope: RuntimeNoopExecutionShellScope;
  readonly policy: RuntimeNoopExecutionShellPolicy;
  readonly checklist: RuntimeNoopExecutionShellReadinessChecklist;
  readonly blockerReport: RuntimeNoopExecutionShellBlockerReport;
}) {
  const runtimeNoopExecutionShellBoundaryViolationReport = detectRuntimeNoopExecutionShellBoundaryViolations({
    summary: input.summary,
    scope: input.scope,
    policy: input.policy,
    checklist: input.checklist,
  });
  const runtimeNoopExecutionShellReadinessVerificationReport = verifyRuntimeNoopExecutionShellReadiness({
    summary: input.summary,
    scope: input.scope,
    policy: input.policy,
    checklist: input.checklist,
    blockerReport: input.blockerReport,
  });
  const runtimeNoopExecutionShellFinalSafetyGate = buildRuntimeNoopExecutionShellFinalSafetyGate({
    summary: input.summary,
    blockerReport: input.blockerReport,
    boundaryViolation: runtimeNoopExecutionShellBoundaryViolationReport,
    readinessVerification: runtimeNoopExecutionShellReadinessVerificationReport,
  });
  return {
    runtimeNoopExecutionShellBoundaryViolationReport,
    runtimeNoopExecutionShellReadinessVerificationReport,
    runtimeNoopExecutionShellFinalSafetyGate,
  };
}

export type { RuntimeNoopExecutionShellPlanningReports } from "./runtimeNoopExecutionShellTypes";

function shellRationaleKo(status: RuntimeNoopExecutionShellCandidateStatus): string {
  switch (status) {
    case "shell_metadata_candidate":
      return "no-op execution shell metadata 후보 — harness final gate·alignment 정렬(실제 shell execution 없음).";
    case "watch":
      return "execution shell 주시 — harness watch·partial verification(execution 금지).";
    case "blocked":
      return "execution shell 차단 — harness·blocker 정렬 필요.";
    default:
      return "execution shell 미후보 — H30.5 harness final gate 선행.";
  }
}

export function buildRuntimeNoopExecutionShellPlanningReports(
  reports: RuntimeSemanticPlanningReportsBeforeNoopExecutionShell
): RuntimeNoopExecutionShellPlanningReports {
  const runtimeNoopExecutionShellBlockerReport = detectRuntimeNoopExecutionShellBlockers(reports);
  const candidateStatus = evaluateRuntimeNoopExecutionShellCandidate({
    reports,
    blockerReport: runtimeNoopExecutionShellBlockerReport,
  });
  const shellMode = resolveRuntimeNoopExecutionShellMode(candidateStatus);

  const runtimeNoopExecutionShellScope = buildRuntimeNoopExecutionShellScope(reports);
  const runtimeNoopExecutionShellPolicy = buildRuntimeNoopExecutionShellPolicy({ candidateStatus });
  const runtimeNoopExecutionShellReadinessChecklist = buildRuntimeNoopExecutionShellReadinessChecklist({
    reports,
    blockerReport: runtimeNoopExecutionShellBlockerReport,
  });

  const runtimeNoopExecutionShellSummary: RuntimeNoopExecutionShellSummary = {
    mode: "runtime_noop_execution_shell_summary",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualIsolatedRunnerInvocationEnabled: false,
    actualIsolatedRunnerExecutionEnabled: false,
    actualDryRunRunnerInvocationEnabled: false,
    actualDryRunRunnerExecutionEnabled: false,
    actualNoopShellExecutionEnabled: false,
    actualExecutionShellExecutionEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualExecutionEnabled: false,
    actualProviderRoutingEnabled: false,
    actualQueueControlEnabled: false,
    actualRollbackExecutionEnabled: false,
    candidateStatus,
    shellMode,
    rationaleKo: shellRationaleKo(candidateStatus),
    shellBlockers: mergeSortedUniqueKo([
      ...runtimeNoopExecutionShellBlockerReport.blockers,
      ...runtimeNoopExecutionShellReadinessChecklist.blockers,
      ...reports.runtimeRunnerNoopHarnessSummary.harnessBlockers.slice(0, 3),
    ]),
    recommendations: mergeSortedUniqueKo([
      ...runtimeNoopExecutionShellBlockerReport.recommendations,
      ...runtimeNoopExecutionShellScope.recommendations,
      ...runtimeNoopExecutionShellPolicy.recommendations,
      ...runtimeNoopExecutionShellReadinessChecklist.recommendations,
    ]),
  };

  const {
    runtimeNoopExecutionShellBoundaryViolationReport,
    runtimeNoopExecutionShellReadinessVerificationReport,
    runtimeNoopExecutionShellFinalSafetyGate,
  } = buildNoopExecutionShellStabilizationReports({
    summary: runtimeNoopExecutionShellSummary,
    scope: runtimeNoopExecutionShellScope,
    policy: runtimeNoopExecutionShellPolicy,
    checklist: runtimeNoopExecutionShellReadinessChecklist,
    blockerReport: runtimeNoopExecutionShellBlockerReport,
  });

  return {
    runtimeNoopExecutionShellSummary,
    runtimeNoopExecutionShellScope,
    runtimeNoopExecutionShellPolicy,
    runtimeNoopExecutionShellBlockerReport,
    runtimeNoopExecutionShellReadinessChecklist,
    runtimeNoopExecutionShellFinalSafetyGate,
    runtimeNoopExecutionShellBoundaryViolationReport,
    runtimeNoopExecutionShellReadinessVerificationReport,
  };
}
