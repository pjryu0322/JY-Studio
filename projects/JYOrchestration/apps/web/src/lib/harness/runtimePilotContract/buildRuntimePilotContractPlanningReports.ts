/**
 * H24.5 — pilot contract·adapter boundary planning reports 일괄 산출(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforePilotContract } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { buildRuntimePilotContractInputSchema } from "./buildRuntimePilotContractInputSchema";
import { buildRuntimePilotContractOutputSchema } from "./buildRuntimePilotContractOutputSchema";
import { buildRuntimePilotContractSummary } from "./buildRuntimePilotContractSummary";
import { buildRuntimePilotHandoffReadiness } from "./buildRuntimePilotHandoffReadiness";
import { detectRuntimeAdapterForbiddenOperations } from "./detectRuntimeAdapterForbiddenOperations";
import { evaluateRuntimeAdapterBoundary } from "./evaluateRuntimeAdapterBoundary";
import type { RuntimePilotContractPlanningReports } from "./runtimePilotContractTypes";

export type { RuntimePilotContractPlanningReports } from "./runtimePilotContractTypes";

export function buildRuntimePilotContractPlanningReports(
  reports: RuntimeSemanticPlanningReportsBeforePilotContract
): RuntimePilotContractPlanningReports {
  const runtimeAdapterBoundarySummary = evaluateRuntimeAdapterBoundary(reports);
  const runtimePilotContractSummary = buildRuntimePilotContractSummary(reports);
  const runtimePilotContractInputSchema = buildRuntimePilotContractInputSchema(reports);
  const runtimePilotContractOutputSchema = buildRuntimePilotContractOutputSchema();
  const runtimeAdapterForbiddenOperationReport = detectRuntimeAdapterForbiddenOperations(reports);
  const runtimePilotHandoffReadiness = buildRuntimePilotHandoffReadiness(
    reports,
    runtimePilotContractSummary,
    runtimeAdapterBoundarySummary,
    runtimeAdapterForbiddenOperationReport
  );

  return {
    runtimePilotContractSummary,
    runtimePilotContractInputSchema,
    runtimePilotContractOutputSchema,
    runtimeAdapterBoundarySummary,
    runtimeAdapterForbiddenOperationReport,
    runtimePilotHandoffReadiness,
  };
}
