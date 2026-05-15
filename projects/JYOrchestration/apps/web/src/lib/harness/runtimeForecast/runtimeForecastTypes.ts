/**
 * H20 — Runtime **forecasting** & predictive orchestration intelligence metadata(read-only).
 */

export type RuntimeForecastSeverity = "low" | "medium" | "high" | "critical_candidate";

export type RuntimeForecastTrendKind =
  | "semantic_growth"
  | "governance_drift"
  | "warning_amplification"
  | "routing_instability"
  | "lifecycle_fragmentation";

export type RuntimeForecastTrend = Readonly<{
  kind: RuntimeForecastTrendKind;
  direction: "stable" | "rising" | "accelerating";
  severity: RuntimeForecastSeverity;
  labelKo: string;
  noteKo: string;
}>;

export type RuntimeForecastRisk = Readonly<{
  code: string;
  severity: RuntimeForecastSeverity;
  labelKo: string;
  saturationImplicationKo: string;
}>;

export type RuntimeForecastEscalationStep = Readonly<{
  stage: string;
  labelKo: string;
}>;

export type RuntimeForecastEscalation = Readonly<{
  mode: "runtime_forecast_escalation";
  actualRuntimeOrchestrationEnabled: false;
  chains: readonly string[];
  primaryChainKo: string;
  highRiskFirst: readonly string[];
}>;

export type RuntimeForecastStabilityOutlook = "stable" | "watch" | "degrading" | "critical_candidate";

export type RuntimeForecastStability = Readonly<{
  mode: "runtime_forecast_stability";
  actualRuntimeOrchestrationEnabled: false;
  outlook: RuntimeForecastStabilityOutlook;
  longitudinalNoteKo: string;
  coherenceDriftRiskKo: string;
  findings: readonly string[];
}>;

export type RuntimeForecastGovernanceDriftKind =
  | "wording_divergence"
  | "semantic_mismatch"
  | "recommendation_inconsistency"
  | "overlay_inconsistency";

export type RuntimeForecastGovernanceDrift = Readonly<{
  mode: "runtime_forecast_governance_drift";
  actualRuntimeOrchestrationEnabled: false;
  drifts: readonly Readonly<{
    kind: RuntimeForecastGovernanceDriftKind;
    severity: RuntimeForecastSeverity;
    labelKo: string;
  }>[];
  primaryDriftKo: string;
}>;

export type RuntimeForecastSnapshot = Readonly<{
  snapshotId: string;
  capturedAtLabel: string;
  topRiskLabelKo: string;
  saturationRiskKo: string;
  stabilityOutlook: RuntimeForecastStabilityOutlook;
  summaryKo: string;
}>;

export type RuntimeForecastSummary = Readonly<{
  mode: "runtime_forecast_summary";
  actualRuntimeOrchestrationEnabled: false;
  trends: readonly RuntimeForecastTrend[];
  topRisks: readonly RuntimeForecastRisk[];
  snapshot: RuntimeForecastSnapshot;
  primaryForecastKo: string;
  orchestrationSaturationRiskKo: string;
}>;

export type RuntimeForecastPlanningReports = Readonly<{
  runtimeForecastSummary: RuntimeForecastSummary;
  runtimeForecastEscalation: RuntimeForecastEscalation;
  runtimeForecastGovernanceDrift: RuntimeForecastGovernanceDrift;
  runtimeForecastStability: RuntimeForecastStability;
}>;
