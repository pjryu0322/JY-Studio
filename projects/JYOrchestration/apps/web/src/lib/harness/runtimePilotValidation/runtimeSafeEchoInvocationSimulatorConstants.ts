/**
 * Pilot Validation Phase 4 — simulator contract constants (no invocation).
 */

export const SAFE_ECHO_SIMULATOR_ACCEPTED_INPUT_ROWS = [
  "validationRequestIdCandidate",
  "requestedValidationMode",
  "operatorApprovalSnapshotStatus",
  "auditTraceIdCandidate",
  "rollbackPlanCandidateId",
  "safeEchoAdapterContractStatus",
  "sandboxDryRunBoundaryStatus",
  "readOnlyChainValidationStatus",
] as const;

export const SAFE_ECHO_SIMULATOR_REJECTED_INPUT_ROWS = [
  "source patch",
  "git command",
  "shell command",
  "adapter invocation payload",
  "sandbox invocation payload",
  "runner command",
  "deployment command",
  "db migration",
  "provider routing instruction",
  "queue control instruction",
] as const;

export const SAFE_ECHO_SIMULATOR_EXPECTED_OUTPUTS = [
  "simulationAccepted",
  "simulationRejectedReason",
  "echoedValidationRequestIdCandidate",
  "echoedAuditTraceIdCandidate",
  "echoedRollbackPlanCandidateId",
  "nextOperatorReviewRequired",
  "simulatorNoInvocationProof",
] as const;

export const SAFE_ECHO_SIMULATOR_PROHIBITED_OUTPUTS = [
  "adapter invocation result",
  "sandbox invocation result",
  "runner execution result",
  "source modification result",
  "git push result",
  "deployment result",
  "database migration result",
  "actual execution result",
] as const;

export const SAFE_ECHO_SIMULATOR_BOUNDARY_ALLOWED_SCOPES = [
  "read_only_echo_simulation_contract",
  "validation_request_draft_metadata",
  "approval_snapshot_metadata",
  "audit_trace_candidate_metadata",
  "rollback_plan_candidate_metadata",
] as const;

export const SAFE_ECHO_SIMULATOR_BOUNDARY_FORBIDDEN_OPERATIONS = [
  "actual adapter invocation",
  "actual sandbox invocation",
  "actual dry-run runner invocation",
  "actual dry-run runner execution",
  "actual pilot execution",
  "actual execution",
  "actual execution routing",
  "actual provider routing",
  "actual queue control",
  "actual rollback execution",
  "actual release enforcement",
  "actual approval enforcement",
  "actual source mutation",
  "actual prompt mutation",
  "git push",
  "pr merge",
  "deployment",
  "db migration",
] as const;
