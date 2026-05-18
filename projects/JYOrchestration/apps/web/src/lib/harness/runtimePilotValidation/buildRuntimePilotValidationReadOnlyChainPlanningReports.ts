/**
 * Pilot Validation Phase 0 — read-only chain validation planning reports.
 */

import type { RuntimeSemanticPlanningReportsBeforePilotValidation } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { buildRuntimePilotValidationReadOnlyChainSummary } from "./buildRuntimePilotValidationReadOnlyChainSummary";
import { buildRuntimeSafeEchoAdapterContractReports } from "./buildRuntimeSafeEchoAdapterContractReports";
import { buildRuntimePilotValidationRequestDraftReports } from "./buildRuntimePilotValidationRequestDraftReports";
import type { RuntimePilotValidationPlanningReports } from "./runtimePilotValidationTypes";

export function buildRuntimePilotValidationReadOnlyChainPlanningReports(
  reports: RuntimeSemanticPlanningReportsBeforePilotValidation
): RuntimePilotValidationPlanningReports {
  const runtimePilotValidationReadOnlyChainSummary = buildRuntimePilotValidationReadOnlyChainSummary(reports);
  const safeEchoReports = buildRuntimeSafeEchoAdapterContractReports(
    reports,
    runtimePilotValidationReadOnlyChainSummary
  );
  return {
    runtimePilotValidationReadOnlyChainSummary,
    ...safeEchoReports,
    ...buildRuntimePilotValidationRequestDraftReports(
      reports,
      runtimePilotValidationReadOnlyChainSummary,
      safeEchoReports
    ),
  };
}

export type { RuntimePilotValidationPlanningReports } from "./runtimePilotValidationTypes";
