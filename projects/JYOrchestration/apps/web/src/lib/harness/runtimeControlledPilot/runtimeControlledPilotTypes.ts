/**
 * H24 — Controlled orchestration **runtime pilot** metadata(read-only; actual pilot·routing·실행 없음).
 */

export type RuntimeControlledPilotReadiness = "not_ready" | "metadata_ready" | "watch" | "blocked";

export type RuntimeControlledPilotScope = "none" | "single_flow_metadata" | "diagnostic_only" | "blocked";

export type RuntimeControlledPilotSummary = Readonly<{
  mode: "runtime_controlled_pilot_summary";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualExecutionEnabled: false;
  actualProviderRoutingEnabled: false;
  actualQueueControlEnabled: false;
  actualRollbackExecutionEnabled: false;
  readiness: RuntimeControlledPilotReadiness;
  pilotScope: RuntimeControlledPilotScope;
  rationaleKo: string;
  candidateFlowKo: string;
  safetyBlockers: readonly string[];
  fallbackRequirements: readonly string[];
  abortConditionMetadata: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeControlledPilotSafetyEnvelope = Readonly<{
  mode: "runtime_controlled_pilot_safety_envelope";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualExecutionEnabled: false;
  actualProviderRoutingEnabled: false;
  actualQueueControlEnabled: false;
  actualRollbackExecutionEnabled: false;
  allowedPilotMetadataScopes: readonly string[];
  forbiddenPilotExecutionScopes: readonly string[];
  safetyBlockers: readonly string[];
  safetyWarnings: readonly string[];
}>;

export type RuntimeControlledPilotFallbackPlan = Readonly<{
  mode: "runtime_controlled_pilot_fallback_plan";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualRollbackExecutionEnabled: false;
  fallbackPrerequisites: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeControlledPilotAbortConditions = Readonly<{
  mode: "runtime_controlled_pilot_abort_conditions";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotExecutionEnabled: false;
  abortConditions: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeControlledPilotPlanningReports = Readonly<{
  runtimeControlledPilotSummary: RuntimeControlledPilotSummary;
  runtimeControlledPilotSafetyEnvelope: RuntimeControlledPilotSafetyEnvelope;
  runtimeControlledPilotFallbackPlan: RuntimeControlledPilotFallbackPlan;
  runtimeControlledPilotAbortConditions: RuntimeControlledPilotAbortConditions;
}>;
