/**
 * Pilot Validation Phase 0 — read-only chain validation planning reports.
 */

import type { RuntimeSemanticPlanningReportsBeforePilotValidation } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { buildRuntimePilotValidationReadOnlyChainSummary } from "./buildRuntimePilotValidationReadOnlyChainSummary";
import type { RuntimePilotValidationPlanningReports } from "./runtimePilotValidationTypes";

export function buildRuntimePilotValidationReadOnlyChainPlanningReports(
  reports: RuntimeSemanticPlanningReportsBeforePilotValidation
): RuntimePilotValidationPlanningReports {
  return {
    runtimePilotValidationReadOnlyChainSummary: buildRuntimePilotValidationReadOnlyChainSummary(reports),
  };
}

export type { RuntimePilotValidationPlanningReports } from "./runtimePilotValidationTypes";
