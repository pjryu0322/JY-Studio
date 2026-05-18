/**
 * Pilot Validation Phase 0 — read-only chain validation planning reports.
 */

import type { RuntimeSemanticPlanningReportsBeforePilotValidation } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { buildRuntimePilotValidationReadOnlyChainSummary } from "./buildRuntimePilotValidationReadOnlyChainSummary";
import { buildRuntimeSafeEchoAdapterContractReports } from "./buildRuntimeSafeEchoAdapterContractReports";
import type { RuntimePilotValidationPlanningReports } from "./runtimePilotValidationTypes";

export function buildRuntimePilotValidationReadOnlyChainPlanningReports(
  reports: RuntimeSemanticPlanningReportsBeforePilotValidation
): RuntimePilotValidationPlanningReports {
  const runtimePilotValidationReadOnlyChainSummary = buildRuntimePilotValidationReadOnlyChainSummary(reports);
  return {
    runtimePilotValidationReadOnlyChainSummary,
    ...buildRuntimeSafeEchoAdapterContractReports(reports, runtimePilotValidationReadOnlyChainSummary),
  };
}

export type { RuntimePilotValidationPlanningReports } from "./runtimePilotValidationTypes";
