/**
 * H20.5 — Runtime **resource orchestration intelligence** metadata(read-only).
 */

export type RuntimeResourceSeverity = "low" | "medium" | "high" | "critical_candidate";

export type RuntimeResourcePressureKind =
  | "token_pressure"
  | "provider_saturation"
  | "queue_overload"
  | "routing_congestion"
  | "parallel_execution_pressure"
  | "orchestration_congestion";

export type RuntimeResourcePressure = Readonly<{
  kind: RuntimeResourcePressureKind;
  severity: RuntimeResourceSeverity;
  labelKo: string;
  noteKo: string;
}>;

export type RuntimeResourceSaturation = Readonly<{
  mode: "runtime_resource_saturation";
  actualRuntimeOrchestrationEnabled: false;
  providerSaturationLevel: RuntimeResourceSeverity;
  queueSaturationLevel: RuntimeResourceSeverity;
  primarySaturationKo: string;
}>;

export type RuntimeResourceQueue = Readonly<{
  mode: "runtime_resource_queue";
  actualRuntimeOrchestrationEnabled: false;
  queueDepthLabel: string;
  overloadRiskKo: string;
}>;

export type RuntimeResourceCapacityOutlook = "comfortable" | "tight" | "strained" | "exhaustion_candidate";

export type RuntimeResourceCapacity = Readonly<{
  mode: "runtime_resource_capacity";
  actualRuntimeOrchestrationEnabled: false;
  outlook: RuntimeResourceCapacityOutlook;
  bottleneckLabelKo: string;
  findings: readonly string[];
}>;

export type RuntimeResourceForecast = Readonly<{
  mode: "runtime_resource_forecast";
  actualRuntimeOrchestrationEnabled: false;
  predictions: readonly string[];
  primaryPredictionKo: string;
}>;

export type RuntimeMemberWorkloadEntry = Readonly<{
  memberId: string;
  labelKo: string;
  workloadLevel: "idle" | "balanced" | "elevated" | "saturated";
  saturationRisk: RuntimeResourceSeverity;
  noteKo: string;
}>;

export type RuntimeMemberWorkload = Readonly<{
  mode: "runtime_member_workload";
  actualRuntimeOrchestrationEnabled: false;
  members: readonly RuntimeMemberWorkloadEntry[];
  imbalanceNoteKo: string;
  primaryOverloadKo: string;
}>;

export type RuntimeResourceExplainability = Readonly<{
  mode: "runtime_resource_explainability";
  actualRuntimeOrchestrationEnabled: false;
  causalChainKo: string;
  findings: readonly string[];
}>;

export type RuntimeResourceSummary = Readonly<{
  mode: "runtime_resource_summary";
  actualRuntimeOrchestrationEnabled: false;
  pressures: readonly RuntimeResourcePressure[];
  overloadSummaryKo: string;
  primaryPressureKo: string;
  saturation: RuntimeResourceSaturation;
  queue: RuntimeResourceQueue;
}>;

export type RuntimeResourcePlanningReports = Readonly<{
  runtimeResourceSummary: RuntimeResourceSummary;
  runtimeResourceForecast: RuntimeResourceForecast;
  runtimeResourceCapacity: RuntimeResourceCapacity;
  runtimeMemberWorkload: RuntimeMemberWorkload;
  runtimeResourceExplainability: RuntimeResourceExplainability;
}>;
