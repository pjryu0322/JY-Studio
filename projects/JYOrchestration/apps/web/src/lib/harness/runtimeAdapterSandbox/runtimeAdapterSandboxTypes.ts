/**
 * H26 — Controlled runtime adapter **sandbox readiness**(read-only; sandbox·adapter 호출 없음).
 */

export type RuntimeAdapterSandboxReadiness =
  | "not_ready"
  | "sandbox_metadata_ready"
  | "watch"
  | "blocked";

export type RuntimeAdapterSandboxMode = "disabled" | "metadata_only" | "blocked";

export type RuntimeAdapterSandboxSummary = Readonly<{
  mode: "runtime_adapter_sandbox_summary";
  actualRuntimeOrchestrationEnabled: false;
  actualRuntimeAdapterInvocationEnabled: false;
  actualSandboxInvocationEnabled: false;
  actualExecutionEnabled: false;
  actualProviderRoutingEnabled: false;
  actualQueueControlEnabled: false;
  actualRollbackExecutionEnabled: false;
  sandboxReadiness: RuntimeAdapterSandboxReadiness;
  sandboxMode: RuntimeAdapterSandboxMode;
  rationaleKo: string;
  sandboxBlockers: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeAdapterSandboxInputEnvelope = Readonly<{
  mode: "runtime_adapter_sandbox_input_envelope";
  actualRuntimeOrchestrationEnabled: false;
  actualRuntimeAdapterInvocationEnabled: false;
  actualSandboxInvocationEnabled: false;
  envelopeRows: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeAdapterSandboxOutputEnvelope = Readonly<{
  mode: "runtime_adapter_sandbox_output_envelope";
  actualRuntimeOrchestrationEnabled: false;
  actualRuntimeAdapterInvocationEnabled: false;
  actualSandboxInvocationEnabled: false;
  acceptedMetadataRows: readonly string[];
  rejectedMetadataRows: readonly string[];
  safetyEnvelopeRows: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeAdapterSandboxPolicy = Readonly<{
  mode: "runtime_adapter_sandbox_policy";
  actualRuntimeOrchestrationEnabled: false;
  actualRuntimeAdapterInvocationEnabled: false;
  actualSandboxInvocationEnabled: false;
  allowedSandboxMetadataScopes: readonly string[];
  forbiddenSandboxOperations: readonly string[];
  sandboxActivationConditions: readonly string[];
  sandboxDeactivationConditions: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeAdapterSandboxResultMetadata = Readonly<{
  mode: "runtime_adapter_sandbox_result_metadata";
  actualRuntimeOrchestrationEnabled: false;
  actualRuntimeAdapterInvocationEnabled: false;
  actualSandboxInvocationEnabled: false;
  actualExecutionEnabled: false;
  actualProviderRoutingEnabled: false;
  actualQueueControlEnabled: false;
  actualRollbackExecutionEnabled: false;
  sandboxInvoked: false;
  adapterInvoked: false;
  executionPerformed: false;
  providerRoutingPerformed: false;
  queueControlPerformed: false;
  rollbackPerformed: false;
  diagnosticOnly: true;
  resultRows: readonly string[];
}>;

export type RuntimeAdapterSandboxBlockerReport = Readonly<{
  mode: "runtime_adapter_sandbox_blocker_report";
  actualRuntimeOrchestrationEnabled: false;
  actualRuntimeAdapterInvocationEnabled: false;
  actualSandboxInvocationEnabled: false;
  blockers: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeAdapterSandboxPlanningReports = Readonly<{
  runtimeAdapterSandboxSummary: RuntimeAdapterSandboxSummary;
  runtimeAdapterSandboxInputEnvelope: RuntimeAdapterSandboxInputEnvelope;
  runtimeAdapterSandboxOutputEnvelope: RuntimeAdapterSandboxOutputEnvelope;
  runtimeAdapterSandboxPolicy: RuntimeAdapterSandboxPolicy;
  runtimeAdapterSandboxResultMetadata: RuntimeAdapterSandboxResultMetadata;
  runtimeAdapterSandboxBlockerReport: RuntimeAdapterSandboxBlockerReport;
}>;
