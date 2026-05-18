/**
 * H24 — controlled runtime pilot planning reports 일괄 산출(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeControlledPilot } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { buildRuntimeControlledPilotAbortConditions } from "./buildRuntimeControlledPilotAbortConditions";
import { buildRuntimeControlledPilotFallbackPlan } from "./buildRuntimeControlledPilotFallbackPlan";
import { buildRuntimeControlledPilotSafetyEnvelope } from "./buildRuntimeControlledPilotSafetyEnvelope";
import { evaluateRuntimeControlledPilotReadiness } from "./evaluateRuntimeControlledPilotReadiness";
import type { RuntimeControlledPilotPlanningReports, RuntimeControlledPilotSummary } from "./runtimeControlledPilotTypes";

export type { RuntimeControlledPilotPlanningReports } from "./runtimeControlledPilotTypes";

export function buildRuntimeControlledPilotPlanningReports(
  reports: RuntimeSemanticPlanningReportsBeforeControlledPilot
): RuntimeControlledPilotPlanningReports {
  const evaluated = evaluateRuntimeControlledPilotReadiness(reports);
  const runtimeControlledPilotSafetyEnvelope = buildRuntimeControlledPilotSafetyEnvelope(reports);
  const runtimeControlledPilotFallbackPlan = buildRuntimeControlledPilotFallbackPlan(reports);
  const runtimeControlledPilotAbortConditions = buildRuntimeControlledPilotAbortConditions(reports);

  const safetyBlockers = mergeSortedUniqueKo([...runtimeControlledPilotSafetyEnvelope.safetyBlockers]);

  const fallbackRequirements = mergeSortedUniqueKo([...runtimeControlledPilotFallbackPlan.fallbackPrerequisites]);

  const abortConditionMetadata = mergeSortedUniqueKo([...runtimeControlledPilotAbortConditions.abortConditions]);

  const recommendations = mergeSortedUniqueKo([
    ...evaluated.recommendationExtras,
    ...runtimeControlledPilotSafetyEnvelope.safetyWarnings,
    ...runtimeControlledPilotFallbackPlan.recommendations,
    ...runtimeControlledPilotAbortConditions.recommendations,
  ]);

  const runtimeControlledPilotSummary: RuntimeControlledPilotSummary = {
    mode: "runtime_controlled_pilot_summary",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualExecutionEnabled: false,
    actualProviderRoutingEnabled: false,
    actualQueueControlEnabled: false,
    actualRollbackExecutionEnabled: false,
    readiness: evaluated.readiness,
    pilotScope: evaluated.pilotScope,
    rationaleKo: evaluated.rationaleKo,
    candidateFlowKo: evaluated.candidateFlowKo,
    safetyBlockers,
    fallbackRequirements,
    abortConditionMetadata,
    recommendations,
  };

  return {
    runtimeControlledPilotSummary,
    runtimeControlledPilotSafetyEnvelope,
    runtimeControlledPilotFallbackPlan,
    runtimeControlledPilotAbortConditions,
  };
}
