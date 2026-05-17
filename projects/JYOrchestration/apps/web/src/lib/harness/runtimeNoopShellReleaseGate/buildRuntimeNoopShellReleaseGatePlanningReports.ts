/**
 * H34 — no-op shell release-gate planning reports 일괄 산출(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeNoopShellReleaseGate } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { buildRuntimeNoopShellReleaseGatePolicy } from "./buildRuntimeNoopShellReleaseGatePolicy";
import { buildRuntimeNoopShellReleaseGateReadinessChecklist } from "./buildRuntimeNoopShellReleaseGateReadinessChecklist";
import { buildRuntimeNoopShellReleaseGateScope } from "./buildRuntimeNoopShellReleaseGateScope";
import { detectRuntimeNoopShellReleaseGateBlockers } from "./detectRuntimeNoopShellReleaseGateBlockers";
import { evaluateRuntimeNoopShellReleaseGateCandidate } from "./evaluateRuntimeNoopShellReleaseGateCandidate";
import { resolveRuntimeNoopShellReleaseGateMode } from "./resolveRuntimeNoopShellReleaseGateMode";
import type {
  RuntimeNoopShellReleaseGateCandidateStatus,
  RuntimeNoopShellReleaseGatePlanningReports,
} from "./runtimeNoopShellReleaseGateTypes";

export type { RuntimeNoopShellReleaseGatePlanningReports } from "./runtimeNoopShellReleaseGateTypes";

function releaseGateRationaleKo(status: RuntimeNoopShellReleaseGateCandidateStatus): string {
  switch (status) {
    case "release_gate_metadata_candidate":
      return "controlled release-gate metadata 후보 — hardening final gate·alignment 정렬(실제 release enforcement·shell execution 없음).";
    case "watch":
      return "release-gate 주시 — hardening watch·partial verification(release enforcement 금지).";
    case "blocked":
      return "release-gate 차단 — hardening·blocker 정렬 필요.";
    default:
      return "release-gate 미후보 — H33.5 hardening final gate 선행.";
  }
}

export function buildRuntimeNoopShellReleaseGatePlanningReports(
  reports: RuntimeSemanticPlanningReportsBeforeNoopShellReleaseGate
): RuntimeNoopShellReleaseGatePlanningReports {
  const runtimeNoopShellReleaseGateBlockerReport = detectRuntimeNoopShellReleaseGateBlockers(reports);
  const candidateStatus = evaluateRuntimeNoopShellReleaseGateCandidate({
    reports,
    blockerReport: runtimeNoopShellReleaseGateBlockerReport,
  });
  const releaseGateMode = resolveRuntimeNoopShellReleaseGateMode(candidateStatus);

  const runtimeNoopShellReleaseGateScope = buildRuntimeNoopShellReleaseGateScope(reports);
  const runtimeNoopShellReleaseGatePolicy = buildRuntimeNoopShellReleaseGatePolicy({ candidateStatus });
  const runtimeNoopShellReleaseGateReadinessChecklist = buildRuntimeNoopShellReleaseGateReadinessChecklist({
    reports,
    blockerReport: runtimeNoopShellReleaseGateBlockerReport,
  });

  const runtimeNoopShellReleaseGateSummary = {
    mode: "runtime_noop_shell_release_gate_summary" as const,
    actualRuntimeOrchestrationEnabled: false as const,
    actualPilotExecutionEnabled: false as const,
    actualNoopShellExecutionEnabled: false as const,
    actualExecutionShellExecutionEnabled: false as const,
    actualRuntimeAdapterInvocationEnabled: false as const,
    actualExecutionEnabled: false as const,
    actualProviderRoutingEnabled: false as const,
    actualQueueControlEnabled: false as const,
    actualRollbackExecutionEnabled: false as const,
    candidateStatus,
    releaseGateMode,
    rationaleKo: releaseGateRationaleKo(candidateStatus),
    releaseGateBlockers: mergeSortedUniqueKo([
      ...runtimeNoopShellReleaseGateBlockerReport.blockers,
      ...runtimeNoopShellReleaseGateReadinessChecklist.blockers,
      ...reports.runtimeNoopShellHardeningSummary.hardeningBlockers.slice(0, 3),
    ]),
    recommendations: mergeSortedUniqueKo([
      ...runtimeNoopShellReleaseGateBlockerReport.recommendations,
      ...runtimeNoopShellReleaseGateScope.recommendations,
      ...runtimeNoopShellReleaseGatePolicy.recommendations,
      ...runtimeNoopShellReleaseGateReadinessChecklist.recommendations,
    ]),
  };

  return {
    runtimeNoopShellReleaseGateSummary,
    runtimeNoopShellReleaseGateScope,
    runtimeNoopShellReleaseGatePolicy,
    runtimeNoopShellReleaseGateBlockerReport,
    runtimeNoopShellReleaseGateReadinessChecklist,
  };
}
