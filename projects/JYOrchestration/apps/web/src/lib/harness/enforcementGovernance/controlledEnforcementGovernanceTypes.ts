/**
 * H11.5 — Controlled **enforcement governance** planning metadata(read-only).
 *
 * 실제 enforcement·승인·rollback 실행 없음.
 */

export type EnforcementGovernanceMode = "disabled" | "candidate_only" | "planning_only";

export type EnforcementApprovalRequirement = "operator_required" | "governance_required" | "auditability_required";

export type EnforcementRollbackDependency = "required" | "recommended" | "optional";

export type GovernanceRiskSummaryLevel = "stable" | "watch" | "elevated" | "high";

export type ControlledEnforcementGovernanceReport = Readonly<{
  mode: "controlled_enforcement_governance_planning";
  actualEnforcementGovernanceEnabled: false;
  governanceMode: EnforcementGovernanceMode;
  governanceReadinessEligible: boolean;
  eligibleCandidates: readonly string[];
  blockedCandidates: readonly string[];
  requiredGovernanceConditions: readonly string[];
  requiredRollbackConditions: readonly string[];
  requiredAuditabilityConditions: readonly string[];
  recommendations: readonly string[];
}>;

export type GovernanceDependencyKind =
  | "provider_routing"
  | "execution_gating"
  | "rollback"
  | "auditability"
  | "operator_approval";

export type GovernanceDependencyPlanningRow = Readonly<{
  kind: GovernanceDependencyKind;
  labelKo: string;
  approvalRequirement: EnforcementApprovalRequirement;
  rollbackDependency: EnforcementRollbackDependency;
  noteKo: string;
}>;

export type GovernanceDependencyPlanningReport = Readonly<{
  mode: "governance_dependency_planning_only";
  actualEnforcementEnabled: false;
  rows: readonly GovernanceDependencyPlanningRow[];
}>;

export type GovernanceRiskSummary = Readonly<{
  mode: "governance_risk_summary";
  governanceRiskLevel: GovernanceRiskSummaryLevel;
  factorNotesKo: readonly string[];
}>;
