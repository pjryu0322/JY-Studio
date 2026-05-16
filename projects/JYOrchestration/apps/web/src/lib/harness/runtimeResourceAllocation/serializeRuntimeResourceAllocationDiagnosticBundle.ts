/**
 * H21.5 — resource allocation planning 진단 **직렬화 전용**(report 재빌드 없음).
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import type {
  RuntimeAllocationEligibilitySummary,
  RuntimeExecutionSlotPlan,
  RuntimeProviderSlotPlan,
  RuntimeResourceAllocationPlan,
} from "./runtimeResourceAllocationTypes";

function serializePlan(plan: RuntimeResourceAllocationPlan): Readonly<Record<string, unknown>> {
  return {
    mode: plan.mode,
    actualRuntimeOrchestrationEnabled: plan.actualRuntimeOrchestrationEnabled,
    actualResourceAllocationEnabled: plan.actualResourceAllocationEnabled,
    globalAllocationMode: plan.globalAllocationMode,
    memberPlans: plan.memberPlans.map((m) => ({ ...m })),
    recommendationRows: [...plan.recommendationRows].sort((a, b) => a.localeCompare(b, "ko")),
  };
}

function serializeEligibility(s: RuntimeAllocationEligibilitySummary): Readonly<Record<string, unknown>> {
  return {
    mode: s.mode,
    actualRuntimeOrchestrationEnabled: s.actualRuntimeOrchestrationEnabled,
    actualResourceAllocationEnabled: s.actualResourceAllocationEnabled,
    effectiveAllocationMode: s.effectiveAllocationMode,
    governanceBoundaryLinkKo: s.governanceBoundaryLinkKo,
    executionCandidateKo: s.executionCandidateKo,
    recommendations: [...s.recommendations].sort((a, b) => a.localeCompare(b, "ko")),
  };
}

function serializeProvider(p: RuntimeProviderSlotPlan): Readonly<Record<string, unknown>> {
  return {
    mode: p.mode,
    actualRuntimeOrchestrationEnabled: p.actualRuntimeOrchestrationEnabled,
    actualResourceAllocationEnabled: p.actualResourceAllocationEnabled,
    providerSlotHintKo: p.providerSlotHintKo,
    providerPressureLinkKo: p.providerPressureLinkKo,
    recommendations: [...p.recommendations].sort((a, b) => a.localeCompare(b, "ko")),
  };
}

function serializeExecution(e: RuntimeExecutionSlotPlan): Readonly<Record<string, unknown>> {
  return {
    mode: e.mode,
    actualRuntimeOrchestrationEnabled: e.actualRuntimeOrchestrationEnabled,
    actualResourceAllocationEnabled: e.actualResourceAllocationEnabled,
    executionSlotHintKo: e.executionSlotHintKo,
    queueAndBottleneckLinkKo: e.queueAndBottleneckLinkKo,
    recommendations: [...e.recommendations].sort((a, b) => a.localeCompare(b, "ko")),
  };
}

export function serializeRuntimeResourceAllocationDiagnosticBundleFromSemanticReports(
  reports: RuntimeSemanticPlanningReports
): Readonly<{
  runtimeResourceAllocationPlan: ReturnType<typeof serializePlan>;
  runtimeAllocationEligibilitySummary: ReturnType<typeof serializeEligibility>;
  runtimeProviderSlotPlan: ReturnType<typeof serializeProvider>;
  runtimeExecutionSlotPlan: ReturnType<typeof serializeExecution>;
}> {
  return {
    runtimeResourceAllocationPlan: serializePlan(reports.runtimeResourceAllocationPlan),
    runtimeAllocationEligibilitySummary: serializeEligibility(reports.runtimeAllocationEligibilitySummary),
    runtimeProviderSlotPlan: serializeProvider(reports.runtimeProviderSlotPlan),
    runtimeExecutionSlotPlan: serializeExecution(reports.runtimeExecutionSlotPlan),
  };
}
