/**
 * H10.5 — Controlled Runtime **Governance** planning metadata(read-only).
 *
 * 실제 승인·롤백·강제·감사 로그 저장 없음.
 */

export type RuntimeApprovalMode = "manual_only" | "operator_review_required" | "disabled";

export type RuntimeRollbackReadiness = "not_ready" | "planning_only" | "dry_run_ready";

export type RuntimeGovernanceAuditabilityLevel = "none" | "basic_planning" | "extended_planning";

export type RuntimeGovernanceRiskLevel = "low" | "medium" | "high";

export type RuntimeOperatorReviewReadiness = "not_ready" | "recommended" | "required";

export type RuntimeGovernanceSummary = Readonly<{
  mode: "controlled_runtime_governance_planning";
  actualGovernanceEnforcementEnabled: false;
  actualApprovalEnforcementEnabled: false;
  actualRollbackExecutionEnabled: false;
  approvalMode: RuntimeApprovalMode;
  rollbackReadiness: RuntimeRollbackReadiness;
  auditabilityLevel: RuntimeGovernanceAuditabilityLevel;
  governanceRisk: RuntimeGovernanceRiskLevel;
  operatorReviewReadiness: RuntimeOperatorReviewReadiness;
  blockers: readonly string[];
  recommendations: readonly string[];
}>;

export type RollbackSafetyRiskLevel = "stable" | "watch" | "high";

export type RollbackSafetyPlanningReport = Readonly<{
  mode: "rollback_safety_planning_only";
  actualRollbackExecutionEnabled: false;
  rollbackRisk: RollbackSafetyRiskLevel;
  factorsKo: readonly string[];
}>;

export type PlannedAuditTraceTargetKind =
  | "prompt_assembly"
  | "provider_selection"
  | "operator_override"
  | "rollback_request"
  | "execution_safety";

export type RuntimeAuditabilityPlannedRow = Readonly<{
  kind: PlannedAuditTraceTargetKind;
  labelKo: string;
  planningNoteKo: string;
}>;

export type RuntimeAuditabilitySummary = Readonly<{
  mode: "auditability_planning_only";
  actualAuditPersistenceEnabled: false;
  disclaimerKo: string;
  plannedTraceTargets: readonly RuntimeAuditabilityPlannedRow[];
}>;
