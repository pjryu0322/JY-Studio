/**
 * H25 / H25.5 — No-op runtime adapter skeleton, contract verification, preflight(read-only; adapter 호출 없음).
 */

export type RuntimeNoopAdapterStatus = "not_available" | "contract_verified_noop" | "watch" | "blocked";

export type RuntimeNoopAdapterInvocationGuard = "always_blocked" | "noop_only" | "contract_metadata_only";

export type RuntimeNoopAdapterSummary = Readonly<{
  mode: "runtime_noop_adapter_summary";
  actualRuntimeOrchestrationEnabled: false;
  actualRuntimeAdapterInvocationEnabled: false;
  actualExecutionEnabled: false;
  actualProviderRoutingEnabled: false;
  actualQueueControlEnabled: false;
  actualRollbackExecutionEnabled: false;
  noopAdapterStatus: RuntimeNoopAdapterStatus;
  invocationGuard: RuntimeNoopAdapterInvocationGuard;
  rationaleKo: string;
  contractVerificationStatus: string;
  noopResultMetadata: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeNoopAdapterSkeleton = Readonly<{
  mode: "runtime_noop_adapter_skeleton";
  actualRuntimeOrchestrationEnabled: false;
  actualRuntimeAdapterInvocationEnabled: false;
  adapterName: string;
  adapterMode: "noop";
  acceptedContractInputs: readonly string[];
  expectedNoopOutputs: readonly string[];
  forbiddenOperations: readonly string[];
  noOpGuarantees: readonly string[];
}>;

export type RuntimePilotContractVerificationReport = Readonly<{
  mode: "runtime_pilot_contract_verification_report";
  actualRuntimeOrchestrationEnabled: false;
  actualRuntimeAdapterInvocationEnabled: false;
  verificationStatus: "failed" | "partial" | "verified_noop";
  missingRequiredInputs: readonly string[];
  outputContractAligned: boolean;
  boundaryAligned: boolean;
  handoffAligned: boolean;
  forbiddenOperationAligned: boolean;
  findings: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeNoopAdapterResultMetadata = Readonly<{
  mode: "runtime_noop_adapter_result_metadata";
  actualRuntimeOrchestrationEnabled: false;
  actualRuntimeAdapterInvocationEnabled: false;
  actualExecutionEnabled: false;
  actualProviderRoutingEnabled: false;
  actualQueueControlEnabled: false;
  actualRollbackExecutionEnabled: false;
  noopAccepted: false;
  adapterInvoked: false;
  executionPerformed: false;
  providerRoutingPerformed: false;
  queueControlPerformed: false;
  rollbackPerformed: false;
  diagnosticOnly: true;
  resultRows: readonly string[];
}>;

export type RuntimeAdapterInvocationGuardReport = Readonly<{
  mode: "runtime_adapter_invocation_guard_report";
  actualRuntimeOrchestrationEnabled: false;
  actualRuntimeAdapterInvocationEnabled: false;
  invocationGuard: RuntimeNoopAdapterInvocationGuard;
  rationaleKo: string;
  blockedReasons: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeNoopAdapterBoundaryViolationReport = Readonly<{
  mode: "runtime_noop_adapter_boundary_violation_report";
  actualRuntimeOrchestrationEnabled: false;
  actualRuntimeAdapterInvocationEnabled: false;
  actualFlagViolations: readonly string[];
  wordingRiskFindings: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeNoopAdapterPreflightReadiness = "ready_metadata" | "watch" | "blocked" | "not_ready";

export type RuntimeNoopAdapterPreflightSummary = Readonly<{
  mode: "runtime_noop_adapter_preflight_summary";
  actualRuntimeOrchestrationEnabled: false;
  actualRuntimeAdapterInvocationEnabled: false;
  preflightReadiness: RuntimeNoopAdapterPreflightReadiness;
  checklist: readonly string[];
  blockers: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimeNoopAdapterPlanningReports = Readonly<{
  runtimeNoopAdapterSummary: RuntimeNoopAdapterSummary;
  runtimeNoopAdapterSkeleton: RuntimeNoopAdapterSkeleton;
  runtimePilotContractVerificationReport: RuntimePilotContractVerificationReport;
  runtimeNoopAdapterResultMetadata: RuntimeNoopAdapterResultMetadata;
  runtimeAdapterInvocationGuardReport: RuntimeAdapterInvocationGuardReport;
  runtimeNoopAdapterBoundaryViolationReport: RuntimeNoopAdapterBoundaryViolationReport;
  runtimeNoopAdapterPreflightSummary: RuntimeNoopAdapterPreflightSummary;
}>;
