/**
 * Pilot Validation Phase 2 — Safe Echo Adapter contract constants (no invocation).
 */

import { RUNTIME_PILOT_VALIDATION_ACTUAL_FLAGS_DISABLED } from "./runtimePilotValidationConstants";

export const RUNTIME_SAFE_ECHO_ADAPTER_ACTUAL_FLAGS_DISABLED = {
  actualAdapterInvocationEnabled: false as const,
  actualSandboxInvocationEnabled: false as const,
  actualDryRunRunnerInvocationEnabled: false as const,
  actualDryRunRunnerExecutionEnabled: false as const,
  actualPilotExecutionEnabled: false as const,
  actualExecutionEnabled: false as const,
};

export const SERIALIZED_RUNTIME_SAFE_ECHO_ADAPTER_ACTUAL_FLAGS = {
  ...RUNTIME_SAFE_ECHO_ADAPTER_ACTUAL_FLAGS_DISABLED,
};

export const SAFE_ECHO_ADAPTER_REQUIRED_INPUTS = [
  "projectId",
  "taskId 또는 validationRequestId",
  "runtimePilotValidationReadOnlyChainSummary.validationStatus",
  "runtimeControlledPilotExecutionCandidateFinalSafetyGate.finalGateStatus",
  "runtimeControlledPilotExecutionCandidateFinalSafetyGate.pilotValidationEntryReadiness",
  "operatorApprovalSnapshot",
  "rollbackReadinessSnapshot",
  "auditTraceCandidate",
  "requestedValidationMode",
] as const;

export const SAFE_ECHO_ADAPTER_ACCEPTED_INPUT_METADATA = [
  "read-only final gate metadata",
  "read-only proof summary",
  "read-only prohibited operation rows",
  "read-only user approval requirement",
  "read-only blocker summary",
  "read-only audit trace candidate",
] as const;

export const SAFE_ECHO_ADAPTER_PROHIBITED_INPUT_PAYLOADS = [
  "source code patch",
  "git command",
  "deployment command",
  "database migration",
  "shell command",
  "runner command",
  "adapter invocation payload",
  "sandbox invocation payload",
  "provider routing instruction",
  "queue control instruction",
] as const;

export const SAFE_ECHO_ADAPTER_INPUT_VALIDATION_RULES = [
  "contract-only: no actual adapter/sandbox/runner invocation",
  "read-only metadata only; no mutable source or infra payloads",
  "operator approval snapshot required before any future invocation phase",
] as const;

export const SAFE_ECHO_ADAPTER_EXPECTED_OUTPUTS = [
  "validationRequestAccepted",
  "validationRequestRejectedReason",
  "echoedInputMetadataHash",
  "safeEchoResultSummary",
  "auditTraceIdCandidate",
  "rollbackPlanCandidateId",
  "nextOperatorReviewRequired",
] as const;

export const SAFE_ECHO_ADAPTER_PROHIBITED_OUTPUTS = [
  "source file modification result",
  "git push result",
  "pull request merge result",
  "deployment result",
  "database migration result",
  "runner execution result",
  "adapter invocation result",
  "sandbox invocation result",
  "actual execution result",
] as const;

export const SAFE_ECHO_ADAPTER_AUDIT_METADATA_ROWS = [
  "auditTraceIdCandidate",
  "operatorApprovalSnapshotHash",
  "rollbackPlanCandidateId",
  "readOnlyChainValidationStatus",
  "contractStatus",
] as const;

export const SANDBOX_DRY_RUN_BOUNDARY_ALLOWED_SCOPES = [
  "safe_echo_contract_metadata",
  "read_only_validation_request_draft",
  "audit_trace_candidate",
  "rollback_plan_candidate",
] as const;

export const SANDBOX_DRY_RUN_BOUNDARY_FORBIDDEN_OPERATIONS = [
  "actual adapter invocation",
  "actual sandbox invocation",
  "actual dry-run runner invocation",
  "actual dry-run runner execution",
  "actual pilot activation",
  "actual pilot execution",
  "actual execution",
  "actual execution routing",
  "actual provider routing",
  "actual queue control",
  "actual rollback execution",
  "actual release enforcement",
  "actual approval enforcement",
  "actual prompt mutation",
  "actual source mutation",
  "git push",
  "pr merge",
  "deployment",
  "db migration",
] as const;

export const RUNTIME_SAFE_ECHO_ADAPTER_ACTUAL_FLAGS_FROM_PILOT_VALIDATION =
  RUNTIME_PILOT_VALIDATION_ACTUAL_FLAGS_DISABLED;
