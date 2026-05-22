/**
 * Stage 9-A runtime execution API MVP constants.
 */

export const RUNTIME_EXECUTION_API_MVP_VERSION = "runtime_execution_api_mvp_v1" as const;

export const RUNTIME_EXECUTION_API_MVP_TITLE =
  "Stage 9-A Runtime Execution API + In-memory Store MVP" as const;

export const REQUIRED_STAGE9_A_CONFIRMATIONS = [
  "operatorStage9ApprovalConfirmed",
  "apiRouteScopeConfirmed",
  "inMemoryStoreConfirmed",
  "mockRunnerAdapterConfirmed",
  "noDbPersistenceConfirmed",
  "noExternalExecutionConfirmed",
] as const;

export const STAGE9_A_SUPPORTED_ACTIONS = [
  "create",
  "get",
  "list",
  "approve",
  "mock_run",
  "audit",
] as const;

export const STAGE9_A_ENDPOINT_CONTRACTS = [
  "POST /api/jyo/runtime-executions",
  "GET /api/jyo/runtime-executions",
  "GET /api/jyo/runtime-executions/:executionId",
  "POST /api/jyo/runtime-executions/:executionId/approve",
  "POST /api/jyo/runtime-executions/:executionId/mock-run",
  "GET /api/jyo/runtime-executions/:executionId/audit",
] as const;

export const STAGE9_A_RECOMMENDED_NEXT_PHASES = [
  "stage_9_b_runtime_execution_runner_adapter_hardening",
  "stage_9_c_runtime_execution_ui_status_panel_design",
] as const;

export const STAGE9_A_SEPARATED_WORK_ITEMS = [
  "actual_cursor_github_execution",
  "actual_connector_gateway_routing_change",
  "actual_db_schema_migration",
  "actual_persistent_database_write",
  "actual_background_worker_queue",
  "actual_production_runner",
  "full_runtime_ui",
] as const;

export const STAGE9_A_DEFAULT_NOW_ISO = "2026-05-19T00:00:00.000Z" as const;
