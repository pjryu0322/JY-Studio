/**
 * H29 — runner invocation planning reports 일괄 산출(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeRunnerInvocation } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { buildRuntimeRunnerInvocationPolicy } from "./buildRuntimeRunnerInvocationPolicy";
import { buildRuntimeRunnerInvocationReadinessChecklist } from "./buildRuntimeRunnerInvocationReadinessChecklist";
import { buildRuntimeRunnerInvocationScope } from "./buildRuntimeRunnerInvocationScope";
import { detectRuntimeRunnerInvocationBlockers } from "./detectRuntimeRunnerInvocationBlockers";
import { evaluateRuntimeRunnerInvocationCandidate } from "./evaluateRuntimeRunnerInvocationCandidate";
import { resolveRuntimeRunnerInvocationMode } from "./resolveRuntimeRunnerInvocationMode";
import type {
  RuntimeRunnerInvocationCandidateStatus,
  RuntimeRunnerInvocationPlanningReports,
  RuntimeRunnerInvocationSummary,
} from "./runtimeRunnerInvocationTypes";

export type { RuntimeRunnerInvocationPlanningReports } from "./runtimeRunnerInvocationTypes";

function invocationRationaleKo(status: RuntimeRunnerInvocationCandidateStatus): string {
  switch (status) {
    case "invocation_metadata_candidate":
      return "runner invocation metadata 후보 — skeleton preflight·contract 정렬(실제 runner invocation 없음).";
    case "watch":
      return "runner invocation 주시 — skeleton watch·partial contract(invocation 금지).";
    case "blocked":
      return "runner invocation 차단 — skeleton·contract·blocker 정렬 필요.";
    default:
      return "runner invocation 미후보 — H28.5 skeleton preflight·contract 선행.";
  }
}

export function buildRuntimeRunnerInvocationPlanningReports(
  reports: RuntimeSemanticPlanningReportsBeforeRunnerInvocation
): RuntimeRunnerInvocationPlanningReports {
  const runtimeRunnerInvocationBlockerReport = detectRuntimeRunnerInvocationBlockers(reports);
  const candidateStatus = evaluateRuntimeRunnerInvocationCandidate({
    reports,
    blockerReport: runtimeRunnerInvocationBlockerReport,
  });
  const invocationMode = resolveRuntimeRunnerInvocationMode(candidateStatus);

  const runtimeRunnerInvocationScope = buildRuntimeRunnerInvocationScope(reports);
  const runtimeRunnerInvocationPolicy = buildRuntimeRunnerInvocationPolicy({ candidateStatus });
  const runtimeRunnerInvocationReadinessChecklist = buildRuntimeRunnerInvocationReadinessChecklist({
    reports,
    blockerReport: runtimeRunnerInvocationBlockerReport,
  });

  const runtimeRunnerInvocationSummary: RuntimeRunnerInvocationSummary = {
    mode: "runtime_runner_invocation_summary",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualIsolatedRunnerInvocationEnabled: false,
    actualIsolatedRunnerExecutionEnabled: false,
    actualDryRunRunnerInvocationEnabled: false,
    actualDryRunRunnerExecutionEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualExecutionEnabled: false,
    actualProviderRoutingEnabled: false,
    actualQueueControlEnabled: false,
    actualRollbackExecutionEnabled: false,
    candidateStatus,
    invocationMode,
    rationaleKo: invocationRationaleKo(candidateStatus),
    invocationBlockers: mergeSortedUniqueKo([
      ...runtimeRunnerInvocationBlockerReport.blockers,
      ...runtimeRunnerInvocationReadinessChecklist.blockers,
    ]),
    recommendations: mergeSortedUniqueKo([
      ...runtimeRunnerInvocationBlockerReport.recommendations,
      ...runtimeRunnerInvocationScope.recommendations,
      ...runtimeRunnerInvocationPolicy.recommendations,
      ...runtimeRunnerInvocationReadinessChecklist.recommendations,
    ]),
  };

  return {
    runtimeRunnerInvocationSummary,
    runtimeRunnerInvocationScope,
    runtimeRunnerInvocationPolicy,
    runtimeRunnerInvocationBlockerReport,
    runtimeRunnerInvocationReadinessChecklist,
  };
}
