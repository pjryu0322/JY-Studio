/**
 * Stage 6-A runtime execution model baseline constants (read-only).
 */

import type { RuntimeExecutionBoundary } from "@/lib/agents/runtimeExecutionModelBaselineTypes";

export const MODEL_BASELINE_VERSION = "runtime_execution_model_baseline_v1" as const;
export const MODEL_BASELINE_TITLE = "Stage 6-A Runtime Execution Model Baseline (Read-Only)";

export const DEFAULT_RUNTIME_EXECUTION_UNIT_KINDS = [
  "agent_task_execution",
  "cursor_code_assistant_execution",
  "github_operation",
  "review_gate",
  "security_gate",
  "operator_approval_gate",
] as const;

export const DEFAULT_RUNTIME_EXECUTION_BOUNDARIES: readonly RuntimeExecutionBoundary[] = [
  "design_only",
  "approval_required",
  "no_direct_execution",
  "no_db_write",
  "no_external_side_effect",
];

export const REQUIRED_STAGE6_A_MODEL_BASELINE_CONFIRMATIONS = [
  "stage6ModelReviewConfirmed",
  "stage6NoActualExecutionConfirmed",
  "stage6NoConnectorRoutingChangeConfirmed",
  "stage6NoDbMigrationConfirmed",
  "stage6NoFeatureFlagWireConfirmed",
] as const;

export const STAGE6_A_SEPARATED_WORK_ITEMS = [
  "actual_runtime_execution_api",
  "actual_execution_runner",
  "actual_cursor_execution_wire",
  "actual_github_operation_wire",
  "actual_connector_gateway_routing_change",
  "actual_feature_flag_wire",
  "actual_db_write",
  "actual_execution_record_persistence",
  "actual_operator_approval_audit_persistence",
] as const;

export const STAGE6_A_RECOMMENDED_NEXT_PHASES = [
  "prepare_runtime_execution_model_candidate_review",
  "prepare_agent_execution_record_schema_separate_pr",
  "prepare_operator_approval_audit_schema_separate_pr",
  "continue_read_only_runtime_model_hardening",
] as const;
