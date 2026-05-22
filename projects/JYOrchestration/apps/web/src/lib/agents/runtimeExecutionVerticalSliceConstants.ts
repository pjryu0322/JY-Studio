/**
 * Stage 8-A runtime execution vertical slice constants.
 */

export const RUNTIME_EXECUTION_VERTICAL_SLICE_VERSION = "runtime_execution_vertical_slice_v1" as const;

export const RUNTIME_EXECUTION_VERTICAL_SLICE_TITLE =
  "Stage 8-A Minimal Runtime Execution Vertical Slice" as const;

export const REQUIRED_STAGE8_A_CONFIRMATIONS = [
  "operatorStage8ApprovalConfirmed",
  "scopeBoundaryConfirmed",
  "mockRunnerOnlyConfirmed",
  "inMemoryOnlyConfirmed",
  "noExternalSideEffectConfirmed",
] as const;

export const STAGE8_A_RECOMMENDED_NEXT_PHASES = [
  "stage_8_b_runtime_execution_api_route_design",
  "stage_8_c_runtime_execution_runner_adapter_design",
] as const;

export const STAGE8_A_SEPARATED_WORK_ITEMS = [
  "actual_api_route_handlers",
  "actual_execution_runner_side_effects",
  "actual_cursor_github_call",
  "actual_connector_gateway_routing_change",
  "actual_db_write",
  "actual_schema_migration",
  "actual_ui",
] as const;

export const STAGE8_A_ALLOWED_STATUSES = [
  "requested",
  "validated",
  "mock_running",
  "mock_completed",
  "mock_failed",
  "cancelled",
  "rollback_requested",
] as const;

export const STAGE8_A_DEFAULT_NOW_ISO = "2026-05-19T00:00:00.000Z" as const;
