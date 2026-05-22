/**
 * Stage 6-C runtime execution model review gate constants (read-only).
 */

export const RUNTIME_EXECUTION_MODEL_REVIEW_GATE_VERSION =
  "runtime_execution_model_review_gate_v1" as const;

export const RUNTIME_EXECUTION_MODEL_REVIEW_GATE_TITLE = "Runtime Execution Model Review Gate" as const;

export const REQUIRED_STAGE6_C_MODEL_REVIEW_GATE_CONFIRMATIONS = [
  "runtimeModelReviewGateConfirmed",
  "runtimeModelFieldContractReviewed",
  "runtimeModelNoRunBoundaryReviewed",
  "runtimeModelPersistenceBoundaryReviewed",
  "runtimeModelApprovalBoundaryReviewed",
] as const;

export const STAGE6_C_SEPARATED_WORK_ITEMS = [
  "actual_runtime_execution_api",
  "actual_execution_runner",
  "actual_cursor_execution_wire",
  "actual_github_operation_wire",
  "actual_connector_gateway_routing_change",
  "actual_feature_flag_wire",
  "actual_db_write",
  "actual_persistence_implementation",
  "actual_schema_migration",
  "actual_runtime_execution_ui",
] as const;

export const STAGE6_C_RECOMMENDED_NEXT_PHASES = [
  "stage_6_d_runtime_execution_contract_candidate",
  "stage_6_e_runtime_execution_dry_run_contract",
  "stage_6_f_runtime_execution_model_closure",
] as const;
