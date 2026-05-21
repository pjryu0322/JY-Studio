/**
 * Stage 6-B runtime execution model candidate constants (read-only).
 */

export const MODEL_CANDIDATE_VERSION = "runtime_execution_model_candidate_v1" as const;
export const MODEL_CANDIDATE_TITLE = "Stage 6-B Runtime Execution Model Candidate (Read-Only)";

export const REQUIRED_RUNTIME_EXECUTION_MODEL_CANDIDATE_KINDS = [
  "RuntimeExecutionRequest",
  "RuntimeExecutionPlan",
  "RuntimeExecutionStep",
  "RuntimeExecutionResult",
  "RuntimeExecutionFinding",
  "RuntimeExecutionApprovalState",
  "RuntimeExecutionRollbackPlan",
] as const;

export const STAGE6_B_SEPARATED_WORK_ITEMS = [
  "actual_runtime_execution_api",
  "actual_execution_runner_wire",
  "actual_runtime_execution_persistence",
  "actual_schema_migration_for_execution",
  "actual_cursor_execution_side_effects",
  "actual_github_operation_side_effects",
] as const;

export const STAGE6_B_RECOMMENDED_NEXT_PHASES = [
  "prepare_runtime_execution_schema_separate_pr",
  "prepare_runtime_execution_api_separate_pr",
  "prepare_connector_gateway_experiment_followup",
  "continue_read_only_runtime_execution_design",
] as const;

export const RUNTIME_EXECUTION_MODEL_CANDIDATE_FORBIDDEN_FIELDS = [
  "actualExecutionPayload",
  "connectorRoutingDelta",
  "prismaClientCall",
  "cursorApiToken",
] as const;
