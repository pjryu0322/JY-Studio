/**
 * H27 / H27.5 — Controlled runtime **pilot activation candidate** metadata(read-only; actual activation 없음).
 */

export type RuntimePilotActivationCandidateStatus =
  | "not_candidate"
  | "activation_metadata_candidate"
  | "watch"
  | "blocked";

export type RuntimePilotActivationMode = "disabled" | "metadata_only" | "blocked";

export type RuntimePilotActivationSummary = Readonly<{
  mode: "runtime_pilot_activation_summary";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotActivationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualRuntimeAdapterInvocationEnabled: false;
  actualSandboxInvocationEnabled: false;
  actualExecutionEnabled: false;
  actualProviderRoutingEnabled: false;
  actualQueueControlEnabled: false;
  actualRollbackExecutionEnabled: false;
  candidateStatus: RuntimePilotActivationCandidateStatus;
  activationMode: RuntimePilotActivationMode;
  rationaleKo: string;
  activationBlockers: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimePilotActivationScope = Readonly<{
  mode: "runtime_pilot_activation_scope";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotActivationEnabled: false;
  actualPilotExecutionEnabled: false;
  candidateSourceLayer: string;
  candidateTargetLayer: string;
  requiredInputMetadata: readonly string[];
  expectedOutputMetadata: readonly string[];
  allowedActivationMetadataScopes: readonly string[];
  forbiddenActivationOperations: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimePilotActivationPolicy = Readonly<{
  mode: "runtime_pilot_activation_policy";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotActivationEnabled: false;
  actualPilotExecutionEnabled: false;
  activationAllowedMode: RuntimePilotActivationMode;
  operatorReviewBeforeActivation: boolean;
  rollbackReadinessRequired: boolean;
  auditTraceRequired: boolean;
  sandboxPreflightRequired: boolean;
  actualActivationForbidden: true;
  recommendations: readonly string[];
}>;

export type RuntimePilotActivationBlockerReport = Readonly<{
  mode: "runtime_pilot_activation_blocker_report";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotActivationEnabled: false;
  actualPilotExecutionEnabled: false;
  blockers: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimePilotActivationReadinessChecklist = Readonly<{
  mode: "runtime_pilot_activation_readiness_checklist";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotActivationEnabled: false;
  actualPilotExecutionEnabled: false;
  checklist: readonly string[];
  blockers: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimePilotActivationFinalGateStatus = "ready_metadata" | "watch" | "blocked" | "not_ready";

export type RuntimePilotActivationFinalSafetyGate = Readonly<{
  mode: "runtime_pilot_activation_final_safety_gate";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotActivationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualRuntimeAdapterInvocationEnabled: false;
  actualSandboxInvocationEnabled: false;
  actualExecutionEnabled: false;
  actualProviderRoutingEnabled: false;
  actualQueueControlEnabled: false;
  actualRollbackExecutionEnabled: false;
  finalGateStatus: RuntimePilotActivationFinalGateStatus;
  h28EntryReadiness: RuntimePilotActivationFinalGateStatus;
  checklist: readonly string[];
  blockers: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimePilotActivationBoundaryViolationReport = Readonly<{
  mode: "runtime_pilot_activation_boundary_violation_report";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotActivationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualFlagViolations: readonly string[];
  wordingRiskFindings: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimePilotActivationReadinessVerificationReport = Readonly<{
  mode: "runtime_pilot_activation_readiness_verification_report";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotActivationEnabled: false;
  actualPilotExecutionEnabled: false;
  verificationStatus: "verified_metadata" | "partial" | "failed";
  findings: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimePilotActivationPlanningReports = Readonly<{
  runtimePilotActivationSummary: RuntimePilotActivationSummary;
  runtimePilotActivationScope: RuntimePilotActivationScope;
  runtimePilotActivationPolicy: RuntimePilotActivationPolicy;
  runtimePilotActivationBlockerReport: RuntimePilotActivationBlockerReport;
  runtimePilotActivationReadinessChecklist: RuntimePilotActivationReadinessChecklist;
  runtimePilotActivationFinalSafetyGate: RuntimePilotActivationFinalSafetyGate;
  runtimePilotActivationBoundaryViolationReport: RuntimePilotActivationBoundaryViolationReport;
  runtimePilotActivationReadinessVerificationReport: RuntimePilotActivationReadinessVerificationReport;
}>;
