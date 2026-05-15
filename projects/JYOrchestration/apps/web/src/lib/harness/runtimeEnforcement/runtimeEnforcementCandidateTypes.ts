/**
 * H11 — Runtime **enforcement candidate** planning metadata(read-only).
 *
 * 실제 enforcement·라우팅·차단·payload 변경 없음.
 */

export type EnforcementCandidateMode = "disabled" | "candidate_only" | "planning_only";

export type EnforcementCandidateRisk = "low" | "medium" | "high";

export type RuntimeEnforcementCandidateReport = Readonly<{
  mode: "runtime_enforcement_candidate_planning";
  actualRuntimeEnforcementEnabled: false;
  candidateMode: EnforcementCandidateMode;
  candidateEligible: boolean;
  riskLevel: EnforcementCandidateRisk;
  blockedCapabilities: readonly string[];
  candidateCapabilities: readonly string[];
  recommendations: readonly string[];
  governanceDependencySummaryKo: string;
  rollbackDependencySummaryKo: string;
}>;

export type EnforcementRiskSummaryLevel = "stable" | "watch" | "elevated" | "high";

export type RuntimeEnforcementRiskSummary = Readonly<{
  mode: "runtime_enforcement_risk_summary";
  enforcementRiskLevel: EnforcementRiskSummaryLevel;
  factorNotesKo: readonly string[];
}>;

export type CandidateCapabilityKind =
  | "provider_routing"
  | "retrieval_orchestration"
  | "execution_gating"
  | "approval_gating"
  | "rollback";

export type CandidateCapabilityStatus = "blocked" | "candidate" | "planning_only";

export type CandidateCapabilityPlanningRow = Readonly<{
  kind: CandidateCapabilityKind;
  labelKo: string;
  status: CandidateCapabilityStatus;
  noteKo: string;
}>;

export type CandidateCapabilityPlanningReport = Readonly<{
  mode: "candidate_capability_planning_only";
  actualEnforcementEnabled: false;
  rows: readonly CandidateCapabilityPlanningRow[];
}>;
