/**
 * H29 — Isolated **dry-run runner invocation candidate** metadata(read-only; actual invocation 없음).
 */

export type RuntimeRunnerInvocationCandidateStatus =
  | "not_candidate"
  | "invocation_metadata_candidate"
  | "watch"
  | "blocked";

export type RuntimeRunnerInvocationMode = "disabled" | "metadata_only" | "blocked";

export type RuntimeRunnerInvocationSummary = Readonly<{
  mode: "runtime_runner_invocation_summary";
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
  candidateStatus: RuntimeRunnerInvocationCandidateStatus;
  invocationMode: RuntimeRunnerInvocationMode;
  rationaleKo: string;
  invocationBlockers: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeRunnerInvocationScope = Readonly<{
  mode: "runtime_runner_invocation_scope";
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
  candidateSourceLayer: string;
  candidateTargetLayer: string;
  requiredInputMetadata: readonly string[];
  expectedOutputMetadata: readonly string[];
  allowedInvocationMetadataScopes: readonly string[];
  forbiddenInvocationOperations: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeRunnerInvocationPolicy = Readonly<{
  mode: "runtime_runner_invocation_policy";
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
  invocationAllowedMode: RuntimeRunnerInvocationMode;
  operatorReviewBeforeInvocation: true;
  rollbackReadinessRequired: true;
  auditTraceRequired: true;
  runnerContractRequired: true;
  runnerSafetyGuardRequired: true;
  runnerNoExecutionResultRequired: true;
  actualInvocationForbidden: true;
  recommendations: readonly string[];
}>;

export type RuntimeRunnerInvocationBlockerReport = Readonly<{
  mode: "runtime_runner_invocation_blocker_report";
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
  blockers: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeRunnerInvocationReadinessChecklist = Readonly<{
  mode: "runtime_runner_invocation_readiness_checklist";
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
  checklist: readonly string[];
  missingRows: readonly string[];
  blockers: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeRunnerInvocationPlanningReports = Readonly<{
  runtimeRunnerInvocationSummary: RuntimeRunnerInvocationSummary;
  runtimeRunnerInvocationScope: RuntimeRunnerInvocationScope;
  runtimeRunnerInvocationPolicy: RuntimeRunnerInvocationPolicy;
  runtimeRunnerInvocationBlockerReport: RuntimeRunnerInvocationBlockerReport;
  runtimeRunnerInvocationReadinessChecklist: RuntimeRunnerInvocationReadinessChecklist;
}>;
