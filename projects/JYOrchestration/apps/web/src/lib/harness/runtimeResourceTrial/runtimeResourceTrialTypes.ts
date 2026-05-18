/**
 * H22 — Controlled **resource allocation trial** metadata(read-only dry-run; 실제 trial 실행·할당 없음).
 */

export type RuntimeResourceTrialMode =
  | "not_applicable"
  | "dry_run_ready"
  | "dry_run_watch"
  | "dry_run_blocked";

export type RuntimeResourceTrialConsistency = "consistent" | "watch" | "drift_detected" | "blocked";

export type RuntimeTrialDriftLevel = "none" | "watch" | "elevated" | "blocked";

export type RuntimeResourceAllocationTrialReport = Readonly<{
  mode: "runtime_resource_allocation_trial_report";
  actualRuntimeOrchestrationEnabled: false;
  actualResourceAllocationEnabled: false;
  actualTrialExecutionEnabled: false;
  trialMode: RuntimeResourceTrialMode;
  consistency: RuntimeResourceTrialConsistency;
  readinessKo: string;
  blockedReasons: readonly string[];
  satisfiedConditions: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeResourceTrialForecastComparison = Readonly<{
  mode: "runtime_allocation_forecast_comparison";
  actualRuntimeOrchestrationEnabled: false;
  actualResourceAllocationEnabled: false;
  actualTrialExecutionEnabled: false;
  stabilityOutlookKo: string;
  escalationSummaryKo: string;
  governanceDriftSummaryKo: string;
  allocationModeContextKo: string;
  aligned: boolean;
  observations: readonly string[];
}>;

export type RuntimeResourceTrialGovernanceComparison = Readonly<{
  mode: "runtime_allocation_governance_comparison";
  actualRuntimeOrchestrationEnabled: false;
  actualResourceAllocationEnabled: false;
  actualTrialExecutionEnabled: false;
  governanceModeKo: string;
  boundaryKo: string;
  operatorReviewKo: string;
  allocationReadinessKo: string;
  aligned: boolean;
  observations: readonly string[];
}>;

export type RuntimeAllocationTrialDriftSummary = Readonly<{
  mode: "runtime_allocation_trial_drift_summary";
  actualRuntimeOrchestrationEnabled: false;
  actualResourceAllocationEnabled: false;
  actualTrialExecutionEnabled: false;
  driftLevel: RuntimeTrialDriftLevel;
  driftFindings: readonly string[];
}>;

export type RuntimeResourceTrialPlanningReports = Readonly<{
  runtimeResourceAllocationTrialReport: RuntimeResourceAllocationTrialReport;
  runtimeAllocationForecastComparison: RuntimeResourceTrialForecastComparison;
  runtimeAllocationGovernanceComparison: RuntimeResourceTrialGovernanceComparison;
  runtimeAllocationTrialDriftSummary: RuntimeAllocationTrialDriftSummary;
}>;
