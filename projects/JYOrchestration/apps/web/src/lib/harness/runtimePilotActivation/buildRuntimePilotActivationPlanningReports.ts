/**
 * H27 — pilot activation planning reports 일괄 산출(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforePilotActivation } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { buildRuntimePilotActivationPolicy } from "./buildRuntimePilotActivationPolicy";
import { buildRuntimePilotActivationReadinessChecklist } from "./buildRuntimePilotActivationReadinessChecklist";
import { buildRuntimePilotActivationScope } from "./buildRuntimePilotActivationScope";
import { detectRuntimePilotActivationBlockers } from "./detectRuntimePilotActivationBlockers";
import { evaluateRuntimePilotActivationCandidate } from "./evaluateRuntimePilotActivationCandidate";
import { resolveRuntimePilotActivationMode } from "./resolveRuntimePilotActivationMode";
import type {
  RuntimePilotActivationCandidateStatus,
  RuntimePilotActivationPlanningReports,
  RuntimePilotActivationSummary,
} from "./runtimePilotActivationTypes";

export type { RuntimePilotActivationPlanningReports } from "./runtimePilotActivationTypes";

function activationRationaleKo(status: RuntimePilotActivationCandidateStatus): string {
  switch (status) {
    case "activation_metadata_candidate":
      return "activation metadata 후보 — sandbox preflight·envelope 정렬(실제 pilot activation 없음).";
    case "watch":
      return "activation 주시 — sandbox watch·partial envelope(activation 금지).";
    case "blocked":
      return "activation 차단 — sandbox·approval·control·blocker 정렬 필요.";
    default:
      return "activation 미후보 — H26.5 sandbox preflight·envelope 선행.";
  }
}

export function buildRuntimePilotActivationPlanningReports(
  reports: RuntimeSemanticPlanningReportsBeforePilotActivation
): RuntimePilotActivationPlanningReports {
  const runtimePilotActivationBlockerReport = detectRuntimePilotActivationBlockers(reports);
  const candidateStatus = evaluateRuntimePilotActivationCandidate({
    reports,
    blockerReport: runtimePilotActivationBlockerReport,
  });
  const activationMode = resolveRuntimePilotActivationMode(candidateStatus);

  const runtimePilotActivationScope = buildRuntimePilotActivationScope(reports);
  const runtimePilotActivationPolicy = buildRuntimePilotActivationPolicy({ candidateStatus });
  const runtimePilotActivationReadinessChecklist = buildRuntimePilotActivationReadinessChecklist({
    reports,
    blockerReport: runtimePilotActivationBlockerReport,
  });

  const runtimePilotActivationSummary: RuntimePilotActivationSummary = {
    mode: "runtime_pilot_activation_summary",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotActivationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualSandboxInvocationEnabled: false,
    actualExecutionEnabled: false,
    actualProviderRoutingEnabled: false,
    actualQueueControlEnabled: false,
    actualRollbackExecutionEnabled: false,
    candidateStatus,
    activationMode,
    rationaleKo: activationRationaleKo(candidateStatus),
    activationBlockers: mergeSortedUniqueKo([
      ...runtimePilotActivationBlockerReport.blockers,
      ...runtimePilotActivationReadinessChecklist.blockers,
    ]),
    recommendations: mergeSortedUniqueKo([
      ...runtimePilotActivationBlockerReport.recommendations,
      ...runtimePilotActivationScope.recommendations,
      ...runtimePilotActivationPolicy.recommendations,
      ...runtimePilotActivationReadinessChecklist.recommendations,
    ]),
  };

  return {
    runtimePilotActivationSummary,
    runtimePilotActivationScope,
    runtimePilotActivationPolicy,
    runtimePilotActivationBlockerReport,
    runtimePilotActivationReadinessChecklist,
  };
}
