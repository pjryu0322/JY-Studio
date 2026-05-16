/**
 * H21.5 — provider **slot planning** 힌트(read-only; 라우팅·스위칭 없음).
 */

import type { RuntimeSemanticPlanningReportsBeforeAllocation } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import type { RuntimeProviderSlotPlan } from "./runtimeResourceAllocationTypes";

export function buildRuntimeProviderSlotPlan(
  reports: RuntimeSemanticPlanningReportsBeforeAllocation
): RuntimeProviderSlotPlan {
  const pp = reports.runtimeResourceSummary.providerPressure;
  const gov = reports.runtimeResourceGovernanceSummary;
  const recommendations = [
    `providerPressure.severity=${pp.severity}`,
    `governanceMode=${gov.governanceMode}`,
    `allocationReadiness=${gov.allocationReadiness}`,
  ].sort((a, b) => a.localeCompare(b, "ko"));

  return {
    mode: "runtime_provider_slot_plan",
    actualRuntimeOrchestrationEnabled: false,
    actualResourceAllocationEnabled: false,
    providerSlotHintKo: `${pp.summaryKo} — provider 슬롯은 planning 메타만`,
    providerPressureLinkKo: `H20.5 providerPressure ↔ H21 governanceRisk=${gov.governanceRisk}`,
    recommendations,
  };
}
