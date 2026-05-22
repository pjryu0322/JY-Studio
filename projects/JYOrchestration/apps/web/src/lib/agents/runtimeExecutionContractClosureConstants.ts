/**
 * Stage 6-F runtime execution contract closure constants (read-only).
 */

export const RUNTIME_EXECUTION_CONTRACT_CLOSURE_VERSION =
  "runtime_execution_contract_closure_v1" as const;

export const RUNTIME_EXECUTION_CONTRACT_CLOSURE_TITLE = "Runtime Execution Contract Closure" as const;

export const REQUIRED_STAGE6_F_CONTRACT_CLOSURE_CONFIRMATIONS = [
  "runtimeExecutionContractClosureConfirmed",
  "runtimeExecutionNoActualRunnerConfirmed",
  "runtimeExecutionNoPersistenceConfirmed",
  "runtimeExecutionSeparatedWorkReviewed",
  "runtimeExecutionStage7HandoffReviewed",
] as const;

export const STAGE6_CLOSED_STAGES = [
  "stage_6_a_runtime_execution_model_baseline",
  "stage_6_b_runtime_execution_model_candidate",
  "stage_6_c_runtime_execution_model_review_gate",
  "stage_6_d_runtime_execution_contract_candidate",
  "stage_6_e_runtime_execution_dry_run_contract",
] as const;

export const STAGE6_F_RECOMMENDED_NEXT_PHASES = [
  "stage_7_runtime_execution_implementation_pr_planning",
  "separate_pr_runtime_execution_api_design",
  "separate_pr_dry_run_runner_design",
  "separate_pr_runtime_persistence_design",
] as const;

export const STAGE6_F_SEPARATED_WORK_ITEMS = [
  "actual_runtime_execution_api",
  "actual_execution_runner",
  "actual_dry_run_runner",
  "actual_cursor_execution_wire",
  "actual_github_operation_wire",
  "actual_connector_gateway_routing_change",
  "actual_feature_flag_wire",
  "actual_db_write",
  "actual_persistence_implementation",
  "actual_schema_migration",
  "actual_runtime_execution_ui",
  "actual_rag_retrieval_wire",
  "actual_prompt_injection_wire",
] as const;
