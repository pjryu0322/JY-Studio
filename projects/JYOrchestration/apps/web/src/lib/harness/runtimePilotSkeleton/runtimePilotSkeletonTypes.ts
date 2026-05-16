/**
 * H28 — Isolated runtime **pilot skeleton** & dry-run runner contract(read-only; runner 실행 없음).
 */

export type RuntimePilotSkeletonReadiness = "not_ready" | "skeleton_metadata_ready" | "watch" | "blocked";

export type RuntimePilotRunnerMode = "disabled" | "dry_run_contract_only" | "blocked";

export type RuntimePilotSkeletonSummary = Readonly<{
  mode: "runtime_pilot_skeleton_summary";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotActivationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualIsolatedRunnerExecutionEnabled: false;
  actualDryRunRunnerExecutionEnabled: false;
  actualRuntimeAdapterInvocationEnabled: false;
  actualExecutionEnabled: false;
  actualProviderRoutingEnabled: false;
  actualQueueControlEnabled: false;
  actualRollbackExecutionEnabled: false;
  skeletonReadiness: RuntimePilotSkeletonReadiness;
  runnerMode: RuntimePilotRunnerMode;
  rationaleKo: string;
  skeletonBlockers: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeDryRunRunnerContract = Readonly<{
  mode: "runtime_dry_run_runner_contract";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotActivationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualIsolatedRunnerExecutionEnabled: false;
  actualDryRunRunnerExecutionEnabled: false;
  runnerName: string;
  runnerMode: "dry_run_contract_only";
  requiredInputMetadata: readonly string[];
  expectedOutputMetadata: readonly string[];
  forbiddenRunnerOperations: readonly string[];
  runnerNoExecutionGuarantees: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimePilotRunnerInputEnvelope = Readonly<{
  mode: "runtime_pilot_runner_input_envelope";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotActivationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualIsolatedRunnerExecutionEnabled: false;
  actualDryRunRunnerExecutionEnabled: false;
  envelopeRows: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimePilotRunnerOutputEnvelope = Readonly<{
  mode: "runtime_pilot_runner_output_envelope";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotActivationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualIsolatedRunnerExecutionEnabled: false;
  actualDryRunRunnerExecutionEnabled: false;
  acceptedMetadataRows: readonly string[];
  rejectedMetadataRows: readonly string[];
  safetyEnvelopeRows: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimePilotRunnerSafetyGuard = Readonly<{
  mode: "runtime_pilot_runner_safety_guard";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotActivationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualIsolatedRunnerExecutionEnabled: false;
  actualDryRunRunnerExecutionEnabled: false;
  actualExecutionForbidden: true;
  actualAdapterInvocationForbidden: true;
  actualProviderRoutingForbidden: true;
  actualQueueControlForbidden: true;
  actualRollbackForbidden: true;
  actualPromptMutationForbidden: true;
  guardRows: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimePilotSkeletonBlockerReport = Readonly<{
  mode: "runtime_pilot_skeleton_blocker_report";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotActivationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualIsolatedRunnerExecutionEnabled: false;
  actualDryRunRunnerExecutionEnabled: false;
  blockers: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimePilotSkeletonPreflightReadiness = "ready_metadata" | "watch" | "blocked" | "not_ready";

export type RuntimePilotRunnerContractVerificationStatus = "verified_metadata" | "partial" | "failed";

export type RuntimePilotRunnerContractVerificationReport = Readonly<{
  mode: "runtime_pilot_runner_contract_verification_report";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualIsolatedRunnerExecutionEnabled: false;
  actualDryRunRunnerExecutionEnabled: false;
  verificationStatus: RuntimePilotRunnerContractVerificationStatus;
  findings: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimePilotRunnerBoundaryViolationReport = Readonly<{
  mode: "runtime_pilot_runner_boundary_violation_report";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualIsolatedRunnerExecutionEnabled: false;
  actualDryRunRunnerExecutionEnabled: false;
  actualFlagViolations: readonly string[];
  wordingRiskFindings: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimePilotRunnerNoExecutionResultMetadata = Readonly<{
  mode: "runtime_pilot_runner_no_execution_result_metadata";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualIsolatedRunnerExecutionEnabled: false;
  actualDryRunRunnerExecutionEnabled: false;
  actualRuntimeAdapterInvocationEnabled: false;
  actualExecutionEnabled: false;
  actualProviderRoutingEnabled: false;
  actualQueueControlEnabled: false;
  actualRollbackExecutionEnabled: false;
  runnerExecuted: false;
  dryRunRunnerExecuted: false;
  adapterInvoked: false;
  executionPerformed: false;
  providerRoutingPerformed: false;
  queueControlPerformed: false;
  rollbackPerformed: false;
  diagnosticOnly: true;
  resultRows: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimePilotSkeletonPreflightSummary = Readonly<{
  mode: "runtime_pilot_skeleton_preflight_summary";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualIsolatedRunnerExecutionEnabled: false;
  actualDryRunRunnerExecutionEnabled: false;
  preflightReadiness: RuntimePilotSkeletonPreflightReadiness;
  checklist: readonly string[];
  blockers: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimePilotSkeletonPlanningReports = Readonly<{
  runtimePilotSkeletonSummary: RuntimePilotSkeletonSummary;
  runtimeDryRunRunnerContract: RuntimeDryRunRunnerContract;
  runtimePilotRunnerInputEnvelope: RuntimePilotRunnerInputEnvelope;
  runtimePilotRunnerOutputEnvelope: RuntimePilotRunnerOutputEnvelope;
  runtimePilotRunnerSafetyGuard: RuntimePilotRunnerSafetyGuard;
  runtimePilotSkeletonBlockerReport: RuntimePilotSkeletonBlockerReport;
  runtimePilotRunnerContractVerificationReport: RuntimePilotRunnerContractVerificationReport;
  runtimePilotRunnerBoundaryViolationReport: RuntimePilotRunnerBoundaryViolationReport;
  runtimePilotRunnerNoExecutionResultMetadata: RuntimePilotRunnerNoExecutionResultMetadata;
  runtimePilotSkeletonPreflightSummary: RuntimePilotSkeletonPreflightSummary;
}>;
