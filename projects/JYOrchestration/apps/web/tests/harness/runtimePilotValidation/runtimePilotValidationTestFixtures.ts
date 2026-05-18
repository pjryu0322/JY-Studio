import { buildRuntimeControlledPilotExecutionCandidatePlanningReports } from "@/lib/harness/runtimeControlledPilotExecutionCandidate/buildRuntimeControlledPilotExecutionCandidatePlanningReports";
import { buildRuntimePilotValidationReadOnlyChainPlanningReports } from "@/lib/harness/runtimePilotValidation/buildRuntimePilotValidationReadOnlyChainPlanningReports";
import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type {
  RuntimeSemanticPlanningReportsBeforeControlledPilotExecutionCandidate,
  RuntimeSemanticPlanningReportsBeforePilotValidation,
} from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { stripRuntimePilotValidationLayer } from "../runtimePlanningReportStrip";
import {
  buildControlledPilotExecutionCandidateBaseReports,
  buildControlledPilotExecutionWatchScenarioPatches,
  buildFullSemanticForControlledPilotExecutionCandidate,
} from "../runtimeControlledPilotExecutionCandidate/runtimeControlledPilotExecutionCandidateTestFixtures";

export function buildFullSemanticForPilotValidation() {
  return buildFullSemanticForControlledPilotExecutionCandidate();
}

export function buildPilotValidationBaseReports() {
  return stripRuntimePilotValidationLayer(buildFullSemanticForPilotValidation());
}

export function mergePilotValidationPlanningReports<T extends RuntimeSemanticPlanningReportsBeforePilotValidation>(
  reports: T
): T & RuntimeSemanticPlanningReports {
  return { ...reports, ...buildRuntimePilotValidationReadOnlyChainPlanningReports(reports) };
}

export function buildPilotValidationPlanningWithControlledCandidatePatches(
  patches: Partial<RuntimeSemanticPlanningReportsBeforeControlledPilotExecutionCandidate> = {}
) {
  const base = buildControlledPilotExecutionCandidateBaseReports();
  const merged = { ...base, ...patches };
  const withCandidate = { ...merged, ...buildRuntimeControlledPilotExecutionCandidatePlanningReports(merged) };
  return mergePilotValidationPlanningReports(withCandidate);
}

export function buildPilotValidationPlanning(
  patches: Partial<RuntimeSemanticPlanningReportsBeforePilotValidation> = {}
) {
  const merged = { ...buildPilotValidationBaseReports(), ...patches };
  return mergePilotValidationPlanningReports(merged);
}

export {
  buildControlledPilotExecutionCandidateBaseReports,
  buildControlledPilotExecutionWatchScenarioPatches,
};
