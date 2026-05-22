/**
 * Stage 6-D runtime execution contract candidate constants (read-only).
 */

export const RUNTIME_EXECUTION_CONTRACT_CANDIDATE_VERSION =
  "runtime_execution_contract_candidate_v1" as const;

export const RUNTIME_EXECUTION_CONTRACT_CANDIDATE_TITLE = "Runtime Execution Contract Candidate" as const;

export const REQUIRED_STAGE6_D_CONTRACT_CANDIDATE_CONFIRMATIONS = [
  "runtimeExecutionContractCandidateConfirmed",
  "runtimeExecutionBoundaryContractReviewed",
  "runtimeExecutionDryRunContractReviewed",
  "runtimeExecutionRollbackContractReviewed",
  "runtimeExecutionApprovalContractReviewed",
] as const;

export const REQUIRED_RUNTIME_EXECUTION_CONTRACT_IDS = [
  "runtime-execution-request-contract",
  "runtime-execution-plan-contract",
  "runtime-execution-step-contract",
  "runtime-execution-result-contract",
  "runtime-execution-finding-contract",
  "runtime-execution-approval-contract",
  "runtime-execution-rollback-contract",
] as const;

export const STAGE6_D_SEPARATED_WORK_ITEMS = [
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
  "actual_rag_retrieval_wire",
  "actual_prompt_injection_wire",
] as const;

export const STAGE6_D_RECOMMENDED_NEXT_PHASES = [
  "stage_6_e_runtime_execution_dry_run_contract",
  "stage_6_f_runtime_execution_contract_closure",
] as const;

export const COMMON_CONTRACT_BOUNDARY_RULES = [
  "contract_candidate_only",
  "no_runtime_execution_api_in_this_step",
  "no_db_write_in_this_step",
  "no_schema_migration_in_this_step",
] as const;
