/**
 * H12 — Runtime enforcement **stability planning** metadata(read-only).
 */

export type RuntimeStabilityLevel = "stable" | "watch" | "elevated" | "unstable";

export type CandidateConflictSeverity = "low" | "medium" | "high";

export type CandidateSaturationLevel = "low" | "medium" | "high";

export type RuntimeCandidateConflictKind =
  | "provider_routing_conflict"
  | "rollback_dependency_conflict"
  | "governance_dependency_conflict"
  | "review_security_overload"
  | "explainability_overload"
  | "resource_saturation";

export type RuntimeCandidateConflictRow = Readonly<{
  kind: RuntimeCandidateConflictKind;
  labelKo: string;
  severity: CandidateConflictSeverity;
  noteKo: string;
}>;

export type RuntimeCandidateConflictReport = Readonly<{
  mode: "runtime_candidate_conflict_report";
  actualRuntimeEnforcementEnabled: false;
  conflicts: readonly RuntimeCandidateConflictRow[];
  severity: CandidateConflictSeverity;
  blockedCandidates: readonly string[];
  recommendedCandidates: readonly string[];
  saturationLevel: CandidateSaturationLevel;
}>;

export type CandidateSaturationSummary = Readonly<{
  mode: "candidate_saturation_summary";
  actualRuntimeEnforcementEnabled: false;
  saturationLevel: CandidateSaturationLevel;
  factorNotesKo: readonly string[];
  estimatedCandidateCount: number;
  estimatedPlanningBlockCount: number;
}>;

export type RuntimeStabilitySummary = Readonly<{
  mode: "runtime_stability_summary";
  actualRuntimeEnforcementEnabled: false;
  stabilityLevel: RuntimeStabilityLevel;
  riskFactors: readonly string[];
  saturationLevel: CandidateSaturationLevel;
  criticalDependencies: readonly string[];
  recommendations: readonly string[];
}>;
