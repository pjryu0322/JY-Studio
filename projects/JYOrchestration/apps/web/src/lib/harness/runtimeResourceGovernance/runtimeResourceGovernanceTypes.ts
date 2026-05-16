/**
 * H21 — Runtime **resource governance** metadata(read-only; planning policy interpretation only).
 */

export type RuntimeResourceGovernanceMode =
  | "observe_only"
  | "planning_only"
  | "trial_candidate"
  | "control_not_allowed";

export type RuntimeResourceGovernanceRisk = "stable" | "watch" | "elevated" | "critical_candidate";

export type RuntimeResourceOperatorReviewRequirement = "not_required" | "recommended" | "required";

export type RuntimeResourceAllocationReadiness =
  | "not_ready"
  | "planning_metadata_only"
  | "allocation_planning_candidate"
  | "trial_signal_blocked";

export type RuntimeResourcePolicyViolationRisk = "none" | "low" | "medium" | "high";

export type RuntimeResourcePolicyViolationCandidate = Readonly<{
  mode: "runtime_resource_policy_violation_candidate";
  actualRuntimeOrchestrationEnabled: false;
  risk: RuntimeResourcePolicyViolationRisk;
  summaryKo: string;
}>;

export type RuntimeResourcePolicyFindingKind =
  | "provider_saturation_candidate"
  | "member_workload_imbalance"
  | "queue_amplification_risk"
  | "bottleneck_propagation_risk"
  | "capacity_exhaustion_candidate"
  | "decision_forecast_governance_link";

export type RuntimeResourcePolicyFinding = Readonly<{
  kind: RuntimeResourcePolicyFindingKind;
  labelKo: string;
  messageKo: string;
}>;

export type RuntimeResourceGovernanceSummary = Readonly<{
  mode: "runtime_resource_governance_summary";
  actualRuntimeOrchestrationEnabled: false;
  governanceMode: RuntimeResourceGovernanceMode;
  governanceRisk: RuntimeResourceGovernanceRisk;
  operatorReviewRequirement: RuntimeResourceOperatorReviewRequirement;
  allocationReadiness: RuntimeResourceAllocationReadiness;
  policyViolationCandidate: RuntimeResourcePolicyViolationCandidate;
  policyFindings: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeResourceControlBoundary = Readonly<{
  mode: "runtime_resource_control_boundary";
  actualRuntimeOrchestrationEnabled: false;
  boundary: RuntimeResourceGovernanceMode;
  rationaleKo: string;
}>;

export type RuntimeResourceGovernancePlanningReports = Readonly<{
  runtimeResourceGovernanceSummary: RuntimeResourceGovernanceSummary;
  runtimeResourcePolicyFindings: readonly RuntimeResourcePolicyFinding[];
  runtimeResourceControlBoundary: RuntimeResourceControlBoundary;
}>;
