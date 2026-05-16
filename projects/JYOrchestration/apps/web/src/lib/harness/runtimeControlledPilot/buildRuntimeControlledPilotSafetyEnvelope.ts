/**
 * H24 — Pilot **safety envelope** 메타(read-only; 실제 제어·실행 없음).
 */

import type { RuntimeSemanticPlanningReportsBeforeControlledPilot } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeControlledPilotSafetyEnvelope } from "./runtimeControlledPilotTypes";

const STATIC_FORBIDDEN_PILOT_SCOPES = [
  "actual provider routing 금지",
  "actual queue control 금지",
  "actual execution blocking 금지",
  "actual rollback execution 금지",
  "actual prompt mutation 금지",
  "actual token enforcement 금지",
] as const;

export function buildRuntimeControlledPilotSafetyEnvelope(
  reports: RuntimeSemanticPlanningReportsBeforeControlledPilot
): RuntimeControlledPilotSafetyEnvelope {
  const ecs = reports.runtimeExecutionCandidateSummary;
  const sc = reports.runtimeExecutionCandidateScope;
  const b = reports.runtimeControlBoundarySummary;
  const v = reports.runtimeControlBoundaryViolationReport;

  const allowedPilotMetadataScopes = mergeSortedUniqueKo([
    ...b.allowedMetadataScopes,
    ...sc.allowedMetadataScopes,
    "overlay-runtime diagnostic serialization 경로(읽기 전용)",
  ]);

  const forbiddenPilotExecutionScopes = mergeSortedUniqueKo([
    ...STATIC_FORBIDDEN_PILOT_SCOPES,
    ...sc.forbiddenExecutionScopes,
    ...b.forbiddenControlScopes,
  ]);

  const safetyBlockers = mergeSortedUniqueKo([
    ...ecs.candidateBlockers,
    ...(b.boundaryRisk === "blocked" ? ["control boundary risk blocked(메타)"] : []),
    ...(v.actualFlagViolations.length > 0 ? ["actual* 플래그 위반 후보 감지(메타)"] : []),
  ]);

  const safetyWarnings = mergeSortedUniqueKo([
    ...v.wordingRiskFindings,
    ...(ecs.candidateRisk === "elevated" ? ["execution candidate risk elevated(메타)"] : []),
  ]);

  return {
    mode: "runtime_controlled_pilot_safety_envelope",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualExecutionEnabled: false,
    actualProviderRoutingEnabled: false,
    actualQueueControlEnabled: false,
    actualRollbackExecutionEnabled: false,
    allowedPilotMetadataScopes,
    forbiddenPilotExecutionScopes,
    safetyBlockers,
    safetyWarnings,
  };
}
