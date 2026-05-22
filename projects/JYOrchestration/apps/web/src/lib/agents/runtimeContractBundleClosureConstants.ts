/**
 * Stage 7-C runtime contract bundle closure constants (read-only).
 */

import type {
  RuntimeContractBundleClosureArea,
  RuntimeContractBundleItem,
} from "@/lib/agents/runtimeContractBundleClosureTypes";

export const RUNTIME_CONTRACT_BUNDLE_CLOSURE_VERSION = "runtime_contract_bundle_closure_v1" as const;

export const RUNTIME_CONTRACT_BUNDLE_CLOSURE_TITLE = "Runtime Contract Bundle Closure" as const;

export const STAGE8_ENTRY_CANDIDATE = "minimal_runtime_execution_vertical_slice" as const;

export const STAGE8_A_MINIMAL_VERTICAL_SLICE_SCOPE = [
  "in_memory_runtime_execution_record",
  "mock_runtime_runner",
  "dry_run_like_status_transition",
  "runtime_execution_audit_object",
  "unit_tests_only",
] as const;

export const STAGE8_A_OUT_OF_SCOPE = [
  "actual_api_route_handlers",
  "actual_runtime_execution_api",
  "actual_execution_runner_side_effects",
  "actual_cursor_github_call",
  "actual_connector_gateway_routing_change",
  "actual_db_write",
  "actual_schema_migration",
  "actual_ui",
] as const;

export const STAGE8_ENTRY_REQUIRED_FORBIDDEN_MARKERS = [
  "actual_db_write",
  "actual_schema_migration",
  "actual_cursor_github_wire",
] as const;

export const STAGE8_ENTRY_REQUIRED_APPROVALS = [
  "operator_stage8_entry_approval",
  "scope_boundary_approval",
] as const;

export const REQUIRED_STAGE7_C_BUNDLE_CLOSURE_CONFIRMATIONS = [
  "runtimeContractBundleReviewed",
  "runtimeContractBundleNoImplementationConfirmed",
  "runtimeContractBundleStage8EntryReviewed",
  "runtimeContractBundleSeparatedWorkConfirmed",
  "runtimeContractBundleRollbackReviewed",
] as const;

export const STAGE7_C_REQUIRED_BUNDLE_ITEM_IDS = [
  "runtime-api-contract",
  "execution-runner-contract-candidate",
  "dry-run-runner-contract-candidate",
  "cursor-github-wire-contract-candidate",
  "connector-gateway-routing-contract-candidate",
  "persistence-boundary-candidate",
  "schema-migration-boundary-candidate",
  "approval-gate-contract",
  "security-gate-contract",
  "rollback-contract",
  "audit-contract",
  "stage8-minimal-vertical-slice-entry",
] as const;

export const STAGE7_C_RECOMMENDED_NEXT_PHASES = ["stage_8_a_minimal_runtime_execution_vertical_slice"] as const;

export const STAGE7_C_SEPARATED_WORK_ITEMS = [
  "actual_api_route_handlers",
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
] as const;

type BundleItemSpec = {
  readonly area: RuntimeContractBundleClosureArea;
  readonly title: string;
  readonly purpose: string;
  readonly source: RuntimeContractBundleItem["source"];
  readonly stage8Candidate: boolean;
  readonly requiredBeforeStage8: boolean;
  readonly forbiddenInThisStep: readonly string[];
  readonly requiredApprovals: readonly string[];
};

export const STAGE7_C_BUNDLE_ITEM_SPECS: Record<(typeof STAGE7_C_REQUIRED_BUNDLE_ITEM_IDS)[number], BundleItemSpec> = {
  "runtime-api-contract": {
    area: "api_contract",
    title: "Runtime API Contract Bundle",
    purpose: "Close Stage 7-B runtime API endpoint contract design as a bundle item.",
    source: "stage7_b_api_contract",
    stage8Candidate: false,
    requiredBeforeStage8: true,
    forbiddenInThisStep: ["actual_runtime_execution_api", "actual_api_route_handlers"],
    requiredApprovals: ["runtime_operator"],
  },
  "execution-runner-contract-candidate": {
    area: "runner_contract",
    title: "Execution Runner Contract Candidate",
    purpose: "Integrated execution runner contract candidate for Stage 8 entry planning.",
    source: "stage7_a_planning_item",
    stage8Candidate: false,
    requiredBeforeStage8: false,
    forbiddenInThisStep: ["actual_execution_runner"],
    requiredApprovals: ["runtime_operator"],
  },
  "dry-run-runner-contract-candidate": {
    area: "dry_run_contract",
    title: "Dry-run Runner Contract Candidate",
    purpose: "Integrated dry-run runner contract candidate without live runner implementation.",
    source: "stage7_a_planning_item",
    stage8Candidate: false,
    requiredBeforeStage8: false,
    forbiddenInThisStep: ["actual_dry_run_runner"],
    requiredApprovals: ["runtime_operator"],
  },
  "cursor-github-wire-contract-candidate": {
    area: "cursor_github_wire_contract",
    title: "Cursor/GitHub Wire Contract Candidate",
    purpose: "Integrated Cursor/GitHub wire contract candidate as design-only boundary.",
    source: "stage7_a_planning_item",
    stage8Candidate: false,
    requiredBeforeStage8: false,
    forbiddenInThisStep: ["actual_cursor_execution_wire", "actual_github_operation_wire"],
    requiredApprovals: ["github_operator"],
  },
  "connector-gateway-routing-contract-candidate": {
    area: "connector_gateway_contract",
    title: "Connector Gateway Routing Contract Candidate",
    purpose: "Integrated connector gateway routing contract candidate.",
    source: "stage7_a_planning_item",
    stage8Candidate: false,
    requiredBeforeStage8: false,
    forbiddenInThisStep: ["actual_connector_gateway_routing_change"],
    requiredApprovals: ["connector_operator"],
  },
  "persistence-boundary-candidate": {
    area: "persistence_boundary",
    title: "Persistence Boundary Candidate",
    purpose: "Integrated persistence boundary candidate before any DB implementation.",
    source: "stage6_contract_boundary",
    stage8Candidate: false,
    requiredBeforeStage8: false,
    forbiddenInThisStep: ["actual_db_write", "actual_persistence_implementation"],
    requiredApprovals: ["persistence_operator"],
  },
  "schema-migration-boundary-candidate": {
    area: "schema_boundary",
    title: "Schema Migration Boundary Candidate",
    purpose: "Integrated schema migration boundary candidate requiring separate approval.",
    source: "stage6_contract_boundary",
    stage8Candidate: false,
    requiredBeforeStage8: false,
    forbiddenInThisStep: ["actual_schema_migration"],
    requiredApprovals: ["schema_operator"],
  },
  "approval-gate-contract": {
    area: "approval_gate",
    title: "Approval Gate Contract",
    purpose: "Operator approval gate contract required before Stage 8 implementation.",
    source: "stage7_b_api_contract",
    stage8Candidate: false,
    requiredBeforeStage8: true,
    forbiddenInThisStep: ["actual_runtime_execution_api"],
    requiredApprovals: ["runtime_operator", "security_operator"],
  },
  "security-gate-contract": {
    area: "security_gate",
    title: "Security Gate Contract",
    purpose: "Security boundary contract for runtime execution vertical slice entry.",
    source: "stage7_b_api_contract",
    stage8Candidate: false,
    requiredBeforeStage8: true,
    forbiddenInThisStep: ["actual_runtime_execution_api"],
    requiredApprovals: ["security_operator"],
  },
  "rollback-contract": {
    area: "rollback_contract",
    title: "Rollback Contract",
    purpose: "Rollback and recovery contract design for runtime execution bundle.",
    source: "stage7_b_api_contract",
    stage8Candidate: false,
    requiredBeforeStage8: false,
    forbiddenInThisStep: ["actual_runtime_execution_api"],
    requiredApprovals: ["runtime_operator"],
  },
  "audit-contract": {
    area: "audit_contract",
    title: "Audit Contract",
    purpose: "Audit event contract bundle derived from Stage 7-B API contracts.",
    source: "stage7_b_api_contract",
    stage8Candidate: false,
    requiredBeforeStage8: false,
    forbiddenInThisStep: ["actual_runtime_execution_api"],
    requiredApprovals: ["runtime_operator"],
  },
  "stage8-minimal-vertical-slice-entry": {
    area: "stage8_entry",
    title: "Stage 8-A Minimal Vertical Slice Entry",
    purpose: "Entry candidate for Stage 8-A minimal runtime execution vertical slice.",
    source: "stage7_b_api_contract",
    stage8Candidate: true,
    requiredBeforeStage8: true,
    forbiddenInThisStep: [
      "actual_runtime_execution_api",
      "actual_execution_runner",
      "actual_dry_run_runner",
      "actual_cursor_github_wire",
      "actual_db_write",
      "actual_schema_migration",
    ],
    requiredApprovals: ["operator_stage8_entry_approval", "scope_boundary_approval"],
  },
};
