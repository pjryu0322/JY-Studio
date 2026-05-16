/**
 * H30 — Isolated **dry-run runner no-op harness** metadata(read-only; actual invocation 없음).
 */

export type RuntimeRunnerNoopHarnessReadiness =
  | "not_ready"
  | "noop_harness_metadata_ready"
  | "watch"
  | "blocked";

export type RuntimeRunnerNoopHarnessMode = "disabled" | "noop_contract_only" | "blocked";

export type RuntimeRunnerNoopHarnessPreflightReadiness =
  | "not_ready"
  | "ready_metadata"
  | "watch"
  | "blocked";

export type RuntimeRunnerNoopHarnessContractVerificationStatus =
  | "verified_metadata"
  | "partial"
  | "failed";

export type RuntimeRunnerNoopHarnessSummary = Readonly<{
  mode: "runtime_runner_noop_harness_summary";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualIsolatedRunnerInvocationEnabled: false;
  actualIsolatedRunnerExecutionEnabled: false;
  actualDryRunRunnerInvocationEnabled: false;
  actualDryRunRunnerExecutionEnabled: false;
  actualRuntimeAdapterInvocationEnabled: false;
  actualExecutionEnabled: false;
  actualProviderRoutingEnabled: false;
  actualQueueControlEnabled: false;
  actualRollbackExecutionEnabled: false;
  harnessReadiness: RuntimeRunnerNoopHarnessReadiness;
  harnessMode: RuntimeRunnerNoopHarnessMode;
  rationaleKo: string;
  harnessBlockers: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeRunnerNoopInvocationEnvelope = Readonly<{
  mode: "runtime_runner_noop_invocation_envelope";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualIsolatedRunnerInvocationEnabled: false;
  actualIsolatedRunnerExecutionEnabled: false;
  actualDryRunRunnerInvocationEnabled: false;
  actualDryRunRunnerExecutionEnabled: false;
  actualRuntimeAdapterInvocationEnabled: false;
  actualExecutionEnabled: false;
  actualProviderRoutingEnabled: false;
  actualQueueControlEnabled: false;
  actualRollbackExecutionEnabled: false;
  envelopeRows: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeRunnerNoopResultMetadata = Readonly<{
  mode: "runtime_runner_noop_result_metadata";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualIsolatedRunnerInvocationEnabled: false;
  actualIsolatedRunnerExecutionEnabled: false;
  actualDryRunRunnerInvocationEnabled: false;
  actualDryRunRunnerExecutionEnabled: false;
  actualRuntimeAdapterInvocationEnabled: false;
  actualExecutionEnabled: false;
  actualProviderRoutingEnabled: false;
  actualQueueControlEnabled: false;
  actualRollbackExecutionEnabled: false;
  isolatedRunnerInvoked: false;
  isolatedRunnerExecuted: false;
  dryRunRunnerInvoked: false;
  dryRunRunnerExecuted: false;
  runtimeAdapterInvoked: false;
  executionPerformed: false;
  providerRoutingPerformed: false;
  queueControlPerformed: false;
  rollbackPerformed: false;
  promptMutated: false;
  diagnosticOnly: true;
  resultRows: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeRunnerNoopHarnessSafetyGuard = Readonly<{
  mode: "runtime_runner_noop_harness_safety_guard";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualIsolatedRunnerInvocationEnabled: false;
  actualIsolatedRunnerExecutionEnabled: false;
  actualDryRunRunnerInvocationEnabled: false;
  actualDryRunRunnerExecutionEnabled: false;
  actualRuntimeAdapterInvocationEnabled: false;
  actualExecutionEnabled: false;
  actualProviderRoutingEnabled: false;
  actualQueueControlEnabled: false;
  actualRollbackExecutionEnabled: false;
  actualInvocationForbidden: true;
  actualExecutionForbidden: true;
  actualAdapterInvocationForbidden: true;
  actualProviderRoutingForbidden: true;
  actualQueueControlForbidden: true;
  actualRollbackForbidden: true;
  actualPromptMutationForbidden: true;
  guardRows: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeRunnerNoopHarnessContractVerificationReport = Readonly<{
  mode: "runtime_runner_noop_harness_contract_verification_report";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualIsolatedRunnerInvocationEnabled: false;
  actualDryRunRunnerInvocationEnabled: false;
  verificationStatus: RuntimeRunnerNoopHarnessContractVerificationStatus;
  findings: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeRunnerNoopHarnessBoundaryViolationReport = Readonly<{
  mode: "runtime_runner_noop_harness_boundary_violation_report";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualIsolatedRunnerInvocationEnabled: false;
  actualDryRunRunnerInvocationEnabled: false;
  actualFlagViolations: readonly string[];
  wordingRiskFindings: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeRunnerNoopHarnessFinalGateStatus =
  | "ready_metadata"
  | "watch"
  | "blocked"
  | "not_ready";

export type RuntimeRunnerNoopHarnessReadinessVerificationStatus =
  | "verified_metadata"
  | "partial"
  | "failed";

export type RuntimeRunnerNoopHarnessAlignmentStatus = "aligned_metadata" | "partial" | "failed";

export type RuntimeRunnerNoopHarnessFinalSafetyGate = Readonly<{
  mode: "runtime_runner_noop_harness_final_safety_gate";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualIsolatedRunnerInvocationEnabled: false;
  actualIsolatedRunnerExecutionEnabled: false;
  actualDryRunRunnerInvocationEnabled: false;
  actualDryRunRunnerExecutionEnabled: false;
  actualRuntimeAdapterInvocationEnabled: false;
  actualExecutionEnabled: false;
  actualProviderRoutingEnabled: false;
  actualQueueControlEnabled: false;
  actualRollbackExecutionEnabled: false;
  finalGateStatus: RuntimeRunnerNoopHarnessFinalGateStatus;
  h31EntryReadiness: RuntimeRunnerNoopHarnessFinalGateStatus;
  checklist: readonly string[];
  blockers: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeRunnerNoopHarnessReadinessVerificationReport = Readonly<{
  mode: "runtime_runner_noop_harness_readiness_verification_report";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualIsolatedRunnerInvocationEnabled: false;
  actualDryRunRunnerInvocationEnabled: false;
  verificationStatus: RuntimeRunnerNoopHarnessReadinessVerificationStatus;
  findings: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeRunnerNoopHarnessAlignmentReport = Readonly<{
  mode: "runtime_runner_noop_harness_alignment_report";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualIsolatedRunnerInvocationEnabled: false;
  actualDryRunRunnerInvocationEnabled: false;
  alignmentStatus: RuntimeRunnerNoopHarnessAlignmentStatus;
  findings: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeRunnerNoopHarnessPreflightSummary = Readonly<{
  mode: "runtime_runner_noop_harness_preflight_summary";
  actualRuntimeOrchestrationEnabled: false;
  actualPilotExecutionEnabled: false;
  actualIsolatedRunnerInvocationEnabled: false;
  actualIsolatedRunnerExecutionEnabled: false;
  actualDryRunRunnerInvocationEnabled: false;
  actualDryRunRunnerExecutionEnabled: false;
  preflightReadiness: RuntimeRunnerNoopHarnessPreflightReadiness;
  checklist: readonly string[];
  blockers: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeRunnerNoopHarnessPlanningReports = Readonly<{
  runtimeRunnerNoopHarnessSummary: RuntimeRunnerNoopHarnessSummary;
  runtimeRunnerNoopInvocationEnvelope: RuntimeRunnerNoopInvocationEnvelope;
  runtimeRunnerNoopResultMetadata: RuntimeRunnerNoopResultMetadata;
  runtimeRunnerNoopHarnessSafetyGuard: RuntimeRunnerNoopHarnessSafetyGuard;
  runtimeRunnerNoopHarnessContractVerificationReport: RuntimeRunnerNoopHarnessContractVerificationReport;
  runtimeRunnerNoopHarnessBoundaryViolationReport: RuntimeRunnerNoopHarnessBoundaryViolationReport;
  runtimeRunnerNoopHarnessPreflightSummary: RuntimeRunnerNoopHarnessPreflightSummary;
  runtimeRunnerNoopHarnessReadinessVerificationReport: RuntimeRunnerNoopHarnessReadinessVerificationReport;
  runtimeRunnerNoopHarnessAlignmentReport: RuntimeRunnerNoopHarnessAlignmentReport;
  runtimeRunnerNoopHarnessFinalSafetyGate: RuntimeRunnerNoopHarnessFinalSafetyGate;
}>;
