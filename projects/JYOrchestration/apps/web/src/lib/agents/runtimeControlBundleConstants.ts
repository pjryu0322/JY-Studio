/**
 * Stage 8-B runtime control bundle constants (read-only).
 */

import type {
  RuntimeControlBundleArea,
  RuntimeControlBundleItem,
} from "@/lib/agents/runtimeControlBundleTypes";

export const RUNTIME_CONTROL_BUNDLE_VERSION = "runtime_control_bundle_v1" as const;

export const RUNTIME_CONTROL_BUNDLE_TITLE = "Stage 8-B Integrated Runtime Control Bundle" as const;

export const REQUIRED_STAGE8_B_CONFIRMATIONS = [
  "runtimeControlBundleReviewed",
  "apiRouteDesignReviewed",
  "runnerAdapterDesignReviewed",
  "stateTransitionReviewed",
  "auditTrailReviewed",
  "stage9EntryReviewed",
] as const;

export const STAGE8_B_REQUIRED_CONTROL_ITEM_IDS = [
  "api-route-design-candidate",
  "runner-adapter-design-candidate",
  "mock-runner-adapter-candidate",
  "state-transition-contract",
  "audit-event-contract",
  "approval-boundary",
  "no-run-boundary",
  "stage9-runtime-execution-orchestration-entry",
] as const;

export const STAGE9_ENTRY_SCOPE = [
  "runtime_execution_api_route_handlers",
  "runtime_execution_in_memory_store_service",
  "runtime_execution_status_query",
  "runtime_execution_approval_action",
  "runtime_execution_mock_runner_adapter",
  "runtime_execution_audit_query",
] as const;

export const STAGE9_ENTRY_OUT_OF_SCOPE = [
  "actual_cursor_github_execution",
  "actual_connector_gateway_routing_change",
  "actual_db_schema_migration",
  "actual_persistent_database_write",
  "actual_background_worker_queue",
  "actual_production_runner",
  "full_runtime_ui",
] as const;

export const STAGE9_ENTRY_REQUIRED_FORBIDDEN_MARKERS = [
  "actual_cursor_github_execution",
  "actual_db_schema_migration",
  "actual_background_worker_queue",
] as const;

export const STAGE9_ENTRY_REQUIRED_APPROVALS = [
  "operator_stage9_entry_approval",
  "runtime_scope_boundary_approval",
] as const;

export const STAGE8_B_RECOMMENDED_NEXT_PHASES = [
  "stage_9_a_runtime_execution_api_and_in_memory_store",
  "stage_9_b_runtime_approval_and_mock_runner_adapter",
] as const;

export const STAGE8_B_SEPARATED_WORK_ITEMS = [
  "actual_cursor_github_execution",
  "actual_connector_gateway_routing_change",
  "actual_db_schema_migration",
  "actual_persistent_database_write",
  "actual_background_worker_queue",
  "full_runtime_ui",
] as const;

type ControlItemSpec = {
  readonly area: RuntimeControlBundleArea;
  readonly title: string;
  readonly purpose: string;
  readonly source: RuntimeControlBundleItem["source"];
  readonly stage9Candidate: boolean;
  readonly requiredBeforeStage9: boolean;
  readonly forbiddenInThisStep: readonly string[];
  readonly requiredApprovals: readonly string[];
};

export const STAGE8_B_CONTROL_ITEM_SPECS: Record<(typeof STAGE8_B_REQUIRED_CONTROL_ITEM_IDS)[number], ControlItemSpec> = {
  "api-route-design-candidate": {
    area: "api_route_design_candidate",
    title: "Runtime Execution API Route Design Candidate",
    purpose: "Design-only API route contracts for runtime execution orchestration MVP.",
    source: "stage8_a_vertical_slice",
    stage9Candidate: false,
    requiredBeforeStage9: true,
    forbiddenInThisStep: ["actual_api_route_handlers", "actual_runtime_execution_api"],
    requiredApprovals: ["runtime_operator"],
  },
  "runner-adapter-design-candidate": {
    area: "runner_adapter_design_candidate",
    title: "Execution Runner Adapter Design Candidate",
    purpose: "Adapter contract between API layer and in-memory mock runner.",
    source: "stage8_a_vertical_slice",
    stage9Candidate: false,
    requiredBeforeStage9: false,
    forbiddenInThisStep: ["actual_execution_runner_side_effects", "actual_production_runner"],
    requiredApprovals: ["runtime_operator"],
  },
  "mock-runner-adapter-candidate": {
    area: "mock_runner_adapter_candidate",
    title: "Mock Runner Adapter Design Candidate",
    purpose: "Mock runner adapter derived from Stage 8-A vertical slice.",
    source: "stage8_a_vertical_slice",
    stage9Candidate: false,
    requiredBeforeStage9: false,
    forbiddenInThisStep: ["actual_dry_run_runner", "actual_production_runner"],
    requiredApprovals: ["runtime_operator"],
  },
  "state-transition-contract": {
    area: "state_transition_contract",
    title: "Runtime Execution State Transition Contract",
    purpose: "Dry-run-like status transition contract for runtime execution records.",
    source: "stage8_a_vertical_slice",
    stage9Candidate: false,
    requiredBeforeStage9: true,
    forbiddenInThisStep: ["actual_runtime_execution_api"],
    requiredApprovals: ["runtime_operator"],
  },
  "audit-event-contract": {
    area: "audit_event_contract",
    title: "Runtime Execution Audit Event Contract",
    purpose: "Audit/event trail contract aligned with Stage 8-A audit objects.",
    source: "stage8_a_vertical_slice",
    stage9Candidate: false,
    requiredBeforeStage9: false,
    forbiddenInThisStep: ["actual_db_write"],
    requiredApprovals: ["runtime_operator"],
  },
  "approval-boundary": {
    area: "approval_boundary",
    title: "Runtime Execution Approval Boundary",
    purpose: "Operator approval boundary before Stage 9 implementation.",
    source: "stage7_c_contract_bundle",
    stage9Candidate: false,
    requiredBeforeStage9: true,
    forbiddenInThisStep: ["actual_runtime_execution_api"],
    requiredApprovals: ["runtime_operator", "security_operator"],
  },
  "no-run-boundary": {
    area: "no_run_boundary",
    title: "Runtime Control No-run Boundary",
    purpose: "No-run boundary for Cursor/GitHub, DB, connector routing, and UI in Stage 8-B.",
    source: "stage7_c_contract_bundle",
    stage9Candidate: false,
    requiredBeforeStage9: true,
    forbiddenInThisStep: [
      "actual_cursor_github_execution",
      "actual_connector_gateway_routing_change",
      "actual_persistent_database_write",
      "full_runtime_ui",
    ],
    requiredApprovals: ["security_operator"],
  },
  "stage9-runtime-execution-orchestration-entry": {
    area: "stage9_entry",
    title: "Stage 9 Runtime Execution Orchestration Entry",
    purpose: "Entry candidate for Stage 9 runtime execution orchestration MVP.",
    source: "stage8_a_vertical_slice",
    stage9Candidate: true,
    requiredBeforeStage9: true,
    forbiddenInThisStep: [
      "actual_cursor_github_execution",
      "actual_db_schema_migration",
      "actual_background_worker_queue",
    ],
    requiredApprovals: ["operator_stage9_entry_approval", "runtime_scope_boundary_approval"],
  },
};
