/**
 * H13.5 — Runtime planning **lifecycle governance** metadata(read-only).
 */

export type RuntimePlanningFreshness = "fresh" | "aging" | "stale";

export type RuntimePlanningLifecycleState = "active" | "watch" | "stale" | "invalidated";

export type RuntimePlanningDriftSeverity = "low" | "medium" | "high";

export type RuntimePlanningFreshnessSummary = Readonly<{
  mode: "runtime_planning_freshness_summary";
  actualRuntimeOrchestrationEnabled: false;
  freshnessLevel: RuntimePlanningFreshness;
  lifecycleState: RuntimePlanningLifecycleState;
  agingFactors: readonly string[];
  staleFactors: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimePlanningDriftReport = Readonly<{
  mode: "runtime_planning_drift_report";
  actualRuntimeOrchestrationEnabled: false;
  driftAreas: readonly string[];
  driftSeverity: RuntimePlanningDriftSeverity;
  driftReasons: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimePlanningInvalidationSummary = Readonly<{
  mode: "runtime_planning_invalidation_summary";
  actualRuntimeOrchestrationEnabled: false;
  lifecycleState: RuntimePlanningLifecycleState;
  invalidationCandidates: readonly string[];
  staleDependencies: readonly string[];
  stalePlanningAreas: readonly string[];
  recommendations: readonly string[];
}>;
