/**
 * Stage 6-E runtime execution dry-run contract constants (read-only).
 */

import type { RuntimeExecutionContractArea } from "@/lib/agents/runtimeExecutionContractCandidateTypes";
import type { RuntimeExecutionDryRunContractArea } from "@/lib/agents/runtimeExecutionDryRunContractTypes";

export const RUNTIME_EXECUTION_DRY_RUN_CONTRACT_VERSION =
  "runtime_execution_dry_run_contract_v1" as const;

export const RUNTIME_EXECUTION_DRY_RUN_CONTRACT_TITLE = "Runtime Execution Dry-run Contract" as const;

export const REQUIRED_STAGE6_E_DRY_RUN_CONTRACT_CONFIRMATIONS = [
  "runtimeExecutionDryRunContractConfirmed",
  "runtimeExecutionDryRunBoundaryReviewed",
  "runtimeExecutionDryRunNoRunnerConfirmed",
  "runtimeExecutionDryRunPersistenceReviewed",
  "runtimeExecutionDryRunRollbackReviewed",
] as const;

export const REQUIRED_RUNTIME_EXECUTION_DRY_RUN_CONTRACT_IDS = [
  "dry-run-request-contract",
  "dry-run-plan-contract",
  "dry-run-step-contract",
  "dry-run-result-contract",
  "dry-run-finding-contract",
  "dry-run-approval-contract",
  "dry-run-rollback-contract",
] as const;

export const STAGE6_E_SEPARATED_WORK_ITEMS = [
  "actual_dry_run_runner",
  "actual_runtime_execution_api",
  "actual_execution_runner",
  "actual_cursor_execution_wire",
  "actual_github_operation_wire",
  "actual_connector_gateway_routing_change",
  "actual_db_write",
  "actual_persistence_implementation",
  "actual_schema_migration",
  "actual_runtime_execution_ui",
] as const;

export const STAGE6_E_RECOMMENDED_NEXT_PHASES = [
  "stage_6_f_runtime_execution_contract_closure",
] as const;

export const COMMON_DRY_RUN_BOUNDARY_RULES = [
  "dry_run_contract_only",
  "no_actual_dry_run_runner_in_this_step",
  "no_db_write_in_this_step",
  "no_schema_migration_in_this_step",
] as const;

export const CONTRACT_AREA_TO_DRY_RUN_AREA: Record<
  RuntimeExecutionContractArea,
  RuntimeExecutionDryRunContractArea
> = {
  request_contract: "dry_run_request",
  plan_contract: "dry_run_plan",
  step_contract: "dry_run_step",
  result_contract: "dry_run_result",
  finding_contract: "dry_run_finding",
  approval_contract: "dry_run_approval",
  rollback_contract: "dry_run_rollback",
  boundary_contract: "dry_run_boundary",
  dry_run_contract: "dry_run_boundary",
  no_run_boundary: "no_run_boundary",
  persistence_boundary: "persistence_boundary",
  schema_boundary: "schema_boundary",
};

export const CONTRACT_ID_TO_DRY_RUN_SPEC: Record<
  string,
  {
    readonly dryRunContractId: (typeof REQUIRED_RUNTIME_EXECUTION_DRY_RUN_CONTRACT_IDS)[number];
    readonly area: RuntimeExecutionDryRunContractArea;
    readonly scenarioName: string;
  }
> = {
  "runtime-execution-request-contract": {
    dryRunContractId: "dry-run-request-contract",
    area: "dry_run_request",
    scenarioName: "Dry-run Request Contract",
  },
  "runtime-execution-plan-contract": {
    dryRunContractId: "dry-run-plan-contract",
    area: "dry_run_plan",
    scenarioName: "Dry-run Plan Contract",
  },
  "runtime-execution-step-contract": {
    dryRunContractId: "dry-run-step-contract",
    area: "dry_run_step",
    scenarioName: "Dry-run Step Contract",
  },
  "runtime-execution-result-contract": {
    dryRunContractId: "dry-run-result-contract",
    area: "dry_run_result",
    scenarioName: "Dry-run Result Contract",
  },
  "runtime-execution-finding-contract": {
    dryRunContractId: "dry-run-finding-contract",
    area: "dry_run_finding",
    scenarioName: "Dry-run Finding Contract",
  },
  "runtime-execution-approval-contract": {
    dryRunContractId: "dry-run-approval-contract",
    area: "dry_run_approval",
    scenarioName: "Dry-run Approval Contract",
  },
  "runtime-execution-rollback-contract": {
    dryRunContractId: "dry-run-rollback-contract",
    area: "dry_run_rollback",
    scenarioName: "Dry-run Rollback Contract",
  },
};
