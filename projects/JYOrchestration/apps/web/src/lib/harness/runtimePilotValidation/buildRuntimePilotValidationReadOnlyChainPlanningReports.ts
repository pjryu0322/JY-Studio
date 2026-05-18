/**
 * Pilot Validation Phase 0 — read-only chain validation planning reports.
 */

import type { RuntimeSemanticPlanningReportsBeforePilotValidation } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { buildRuntimePilotValidationReadOnlyChainSummary } from "./buildRuntimePilotValidationReadOnlyChainSummary";
import { buildRuntimeSafeEchoAdapterContractReports } from "./buildRuntimeSafeEchoAdapterContractReports";
import { buildRuntimePilotValidationRequestDraftReports } from "./buildRuntimePilotValidationRequestDraftReports";
import { buildRuntimeSafeEchoInvocationSimulatorReports } from "./buildRuntimeSafeEchoInvocationSimulatorReports";
import type { RuntimePilotValidationPlanningReports } from "./runtimePilotValidationTypes";

export function buildRuntimePilotValidationReadOnlyChainPlanningReports(
  reports: RuntimeSemanticPlanningReportsBeforePilotValidation
): RuntimePilotValidationPlanningReports {
  const runtimePilotValidationReadOnlyChainSummary = buildRuntimePilotValidationReadOnlyChainSummary(reports);
  const safeEchoReports = buildRuntimeSafeEchoAdapterContractReports(
    reports,
    runtimePilotValidationReadOnlyChainSummary
  );
  const requestDraftReports = buildRuntimePilotValidationRequestDraftReports(
    reports,
    runtimePilotValidationReadOnlyChainSummary,
    safeEchoReports
  );
  return {
    runtimePilotValidationReadOnlyChainSummary,
    ...safeEchoReports,
    ...requestDraftReports,
    ...buildRuntimeSafeEchoInvocationSimulatorReports(
      reports,
      runtimePilotValidationReadOnlyChainSummary,
      safeEchoReports,
      requestDraftReports
    ),
  };
}

export type { RuntimePilotValidationPlanningReports } from "./runtimePilotValidationTypes";
