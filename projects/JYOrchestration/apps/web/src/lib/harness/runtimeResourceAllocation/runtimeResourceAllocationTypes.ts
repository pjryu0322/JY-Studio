/**
 * H21.5 — Runtime **resource allocation planning** metadata(read-only; 실제 할당·큐 제어 없음).
 */

export type RuntimeAllocationMode =
  | "not_needed"
  | "planning_only"
  | "dry_run_candidate"
  | "blocked_by_governance";

export type RuntimeMemberAllocationPlanEntry = Readonly<{
  memberId: string;
  allocationMode: RuntimeAllocationMode;
  priorityRank: number;
  tokenBudgetHintKo: string;
  congestionHintKo: string;
  timingHintKo: string;
}>;

export type RuntimeResourceAllocationPlan = Readonly<{
  mode: "runtime_resource_allocation_plan";
  actualRuntimeOrchestrationEnabled: false;
  actualResourceAllocationEnabled: false;
  globalAllocationMode: RuntimeAllocationMode;
  memberPlans: readonly RuntimeMemberAllocationPlanEntry[];
  recommendationRows: readonly string[];
}>;

export type RuntimeAllocationEligibilitySummary = Readonly<{
  mode: "runtime_allocation_eligibility_summary";
  actualRuntimeOrchestrationEnabled: false;
  actualResourceAllocationEnabled: false;
  effectiveAllocationMode: RuntimeAllocationMode;
  governanceBoundaryLinkKo: string;
  executionCandidateKo: string;
  recommendations: readonly string[];
}>;

export type RuntimeProviderSlotPlan = Readonly<{
  mode: "runtime_provider_slot_plan";
  actualRuntimeOrchestrationEnabled: false;
  actualResourceAllocationEnabled: false;
  providerSlotHintKo: string;
  providerPressureLinkKo: string;
  recommendations: readonly string[];
}>;

export type RuntimeExecutionSlotPlan = Readonly<{
  mode: "runtime_execution_slot_plan";
  actualRuntimeOrchestrationEnabled: false;
  actualResourceAllocationEnabled: false;
  executionSlotHintKo: string;
  queueAndBottleneckLinkKo: string;
  recommendations: readonly string[];
}>;

export type RuntimeResourceAllocationPlanningReports = Readonly<{
  runtimeResourceAllocationPlan: RuntimeResourceAllocationPlan;
  runtimeAllocationEligibilitySummary: RuntimeAllocationEligibilitySummary;
  runtimeProviderSlotPlan: RuntimeProviderSlotPlan;
  runtimeExecutionSlotPlan: RuntimeExecutionSlotPlan;
}>;
