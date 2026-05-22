/**
 * Stage 9-B runtime MVP closure bundle constants (read-only).
 */

import type {
  RuntimeExecutionMvpClosureArea,
  RuntimeExecutionMvpClosureItem,
} from "@/lib/agents/runtimeExecutionMvpClosureTypes";

export const RUNTIME_EXECUTION_MVP_CLOSURE_VERSION = "runtime_execution_mvp_closure_v1" as const;

export const RUNTIME_EXECUTION_MVP_CLOSURE_TITLE =
  "Stage 9-B Integrated Runtime Runner/Closure Bundle" as const;

export const REQUIRED_STAGE9_B_CONFIRMATIONS = [
  "runtimeMvpClosureReviewed",
  "apiRouteReviewed",
  "storeLifecycleReviewed",
  "mockRunnerAdapterReviewed",
  "auditTrailReviewed",
  "stage10EntryReviewed",
] as const;

export const STAGE9_B_REQUIRED_ITEM_IDS = [
  "runtime-api-route-mvp",
  "in-memory-store-lifecycle",
  "approval-action",
  "mock-runner-adapter",
  "status-query",
  "audit-query",
  "no-run-boundary",
  "stage10-external-execution-entry",
] as const;

export const STAGE10_ENTRY_SCOPE = [
  "external_execution_adapter_design",
  "cursor_github_execution_boundary_design",
  "connector_gateway_execution_boundary_design",
  "runner_process_boundary_design",
  "operator_approval_before_external_execution",
] as const;

export const STAGE10_ENTRY_OUT_OF_SCOPE = [
  "actual_cursor_execution",
  "actual_github_write",
  "actual_connector_gateway_routing_change",
  "actual_db_schema_migration",
  "actual_persistent_database_write",
  "actual_production_runner",
  "full_runtime_ui",
] as const;

export const STAGE10_ENTRY_REQUIRED_FORBIDDEN_MARKERS = [
  "actual_cursor_execution",
  "actual_db_schema_migration",
  "actual_production_runner",
] as const;

export const STAGE10_ENTRY_REQUIRED_APPROVALS = [
  "operator_stage10_entry_approval",
  "runtime_scope_boundary_approval",
] as const;

export const STAGE9_B_RECOMMENDED_NEXT_PHASES = [
  "stage_10_a_external_execution_adapter_design",
  "stage_10_b_cursor_github_execution_boundary_design",
] as const;

export const STAGE9_B_SEPARATED_WORK_ITEMS = [
  "actual_cursor_execution",
  "actual_github_write",
  "actual_connector_gateway_routing_change",
  "actual_db_schema_migration",
  "actual_persistent_database_write",
  "actual_production_runner",
  "full_runtime_ui",
] as const;

const STAGE10_ENTRY_ITEM_ID = "stage10-external-execution-entry";

type ClosureItemSpec = {
  readonly area: RuntimeExecutionMvpClosureArea;
  readonly title: string;
  readonly purpose: string;
  readonly mvpImplemented: boolean;
  readonly stage10Candidate: boolean;
  readonly requiredBeforeStage10: boolean;
  readonly forbiddenInThisStep: readonly string[];
  readonly requiredApprovals: readonly string[];
};

export const STAGE9_B_CLOSURE_ITEM_SPECS: Record<(typeof STAGE9_B_REQUIRED_ITEM_IDS)[number], ClosureItemSpec> = {
  "runtime-api-route-mvp": {
    area: "api_route",
    title: "Runtime API Route MVP",
    purpose: "Stage 9-A runtime execution API route handlers for in-memory MVP.",
    mvpImplemented: true,
    stage10Candidate: false,
    requiredBeforeStage10: true,
    forbiddenInThisStep: ["actual_cursor_execution", "actual_github_write"],
    requiredApprovals: ["runtime_operator"],
  },
  "in-memory-store-lifecycle": {
    area: "in_memory_store",
    title: "In-memory Store Lifecycle",
    purpose: "Map-based in-memory store lifecycle with trace and resetForTest.",
    mvpImplemented: true,
    stage10Candidate: false,
    requiredBeforeStage10: true,
    forbiddenInThisStep: ["actual_persistent_database_write"],
    requiredApprovals: ["runtime_operator"],
  },
  "approval-action": {
    area: "approval",
    title: "Approval Action",
    purpose: "In-memory approval action with status guards.",
    mvpImplemented: true,
    stage10Candidate: false,
    requiredBeforeStage10: true,
    forbiddenInThisStep: ["actual_cursor_execution"],
    requiredApprovals: ["runtime_operator", "security_operator"],
  },
  "mock-runner-adapter": {
    area: "mock_runner_adapter",
    title: "Mock Runner Adapter",
    purpose: "Mock runner adapter reusing Stage 8-A runner without external side effects.",
    mvpImplemented: true,
    stage10Candidate: false,
    requiredBeforeStage10: true,
    forbiddenInThisStep: ["actual_production_runner"],
    requiredApprovals: ["runtime_operator"],
  },
  "status-query": {
    area: "status_query",
    title: "Status Query",
    purpose: "Runtime execution status query via GET handlers.",
    mvpImplemented: true,
    stage10Candidate: false,
    requiredBeforeStage10: false,
    forbiddenInThisStep: ["actual_connector_gateway_routing_change"],
    requiredApprovals: ["runtime_operator"],
  },
  "audit-query": {
    area: "audit_query",
    title: "Audit Query",
    purpose: "Runtime execution audit event query.",
    mvpImplemented: true,
    stage10Candidate: false,
    requiredBeforeStage10: false,
    forbiddenInThisStep: ["actual_db_schema_migration"],
    requiredApprovals: ["runtime_operator"],
  },
  "no-run-boundary": {
    area: "boundary",
    title: "No-run Boundary",
    purpose: "No-run boundary on every API response.",
    mvpImplemented: true,
    stage10Candidate: false,
    requiredBeforeStage10: true,
    forbiddenInThisStep: [
      "actual_cursor_execution",
      "actual_github_write",
      "actual_connector_gateway_routing_change",
      "full_runtime_ui",
    ],
    requiredApprovals: ["security_operator"],
  },
  [STAGE10_ENTRY_ITEM_ID]: {
    area: "stage10_entry",
    title: "Stage 10 External Execution Entry",
    purpose: "Entry candidate for Stage 10 external execution adapter design.",
    mvpImplemented: false,
    stage10Candidate: true,
    requiredBeforeStage10: true,
    forbiddenInThisStep: [
      "actual_cursor_execution",
      "actual_db_schema_migration",
      "actual_production_runner",
    ],
    requiredApprovals: ["operator_stage10_entry_approval", "runtime_scope_boundary_approval"],
  },
};

export { STAGE10_ENTRY_ITEM_ID };
