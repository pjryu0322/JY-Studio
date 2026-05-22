/**
 * Stage 10-A external execution adapter boundary constants (read-only).
 */

import type {
  ExternalExecutionAdapterBoundaryArea,
  ExternalExecutionAdapterBoundaryItem,
} from "@/lib/agents/externalExecutionAdapterBoundaryTypes";

export const EXTERNAL_EXECUTION_ADAPTER_BOUNDARY_VERSION =
  "external_execution_adapter_boundary_v1" as const;

export const EXTERNAL_EXECUTION_ADAPTER_BOUNDARY_TITLE =
  "Stage 10-A Integrated External Execution Adapter Boundary Design" as const;

export const REQUIRED_STAGE10_A_CONFIRMATIONS = [
  "externalAdapterBoundaryReviewed",
  "cursorGithubBoundaryReviewed",
  "connectorBoundaryReviewed",
  "runnerBoundaryReviewed",
  "approvalBoundaryReviewed",
  "dryRunSimulationBoundaryReviewed",
  "rollbackBoundaryReviewed",
  "auditBoundaryReviewed",
  "stage11EntryReviewed",
] as const;

export const STAGE10_A_REQUIRED_ITEM_IDS = [
  "external-adapter-contract",
  "cursor-github-boundary",
  "connector-gateway-boundary",
  "runner-process-boundary",
  "operator-approval-boundary",
  "dry-run-simulation-boundary",
  "rollback-boundary",
  "audit-boundary",
  "stage11-dry-run-package-entry",
] as const;

export const STAGE11_ENTRY_SCOPE = [
  "external_execution_adapter_dry_run_package",
  "cursor_github_adapter_dry_run_contract",
  "connector_gateway_adapter_dry_run_contract",
  "runner_process_adapter_dry_run_contract",
  "operator_approval_before_dry_run",
  "rollback_plan_before_external_execution",
  "audit_event_before_external_execution",
] as const;

export const STAGE11_ENTRY_OUT_OF_SCOPE = [
  "actual_cursor_execution",
  "actual_github_write",
  "actual_connector_gateway_routing_change",
  "actual_db_schema_migration",
  "actual_persistent_database_write",
  "actual_production_runner",
  "full_runtime_ui",
  "agent_registry_crud",
  "agent_add_remove_deactivate_apply",
  "agent_management_ui",
] as const;

export const STAGE11_ENTRY_REQUIRED_FORBIDDEN_MARKERS = [
  "actual_cursor_execution",
  "actual_db_schema_migration",
  "actual_production_runner",
] as const;

export const STAGE11_ENTRY_REQUIRED_APPROVALS = [
  "operator_stage11_entry_approval",
  "adapter_boundary_scope_approval",
] as const;

export const STAGE10_A_RECOMMENDED_NEXT_PHASES = [
  "stage_11_a_external_execution_adapter_dry_run_package",
  "stage_11_b_cursor_github_adapter_dry_run_contract",
] as const;

export const STAGE10_A_SEPARATED_WORK_ITEMS = [
  "actual_cursor_execution",
  "actual_github_write",
  "actual_connector_gateway_routing_change",
  "actual_db_schema_migration",
  "actual_persistent_database_write",
  "actual_production_runner",
  "full_runtime_ui",
  "agent_registry_change_management",
  "agent_add_remove_deactivate_flow",
  "agent_role_slot_ownership_impact_analysis",
  "mandatory_gate_agent_deactivation_policy",
  "agent_knowledge_binding_change_approval",
  "agent_change_audit_trail",
] as const;

const STAGE11_ENTRY_ITEM_ID = "stage11-dry-run-package-entry";

type BoundaryItemSpec = {
  readonly area: ExternalExecutionAdapterBoundaryArea;
  readonly title: string;
  readonly purpose: string;
  readonly stage11Candidate: boolean;
  readonly requiredBeforeStage11: boolean;
  readonly forbiddenInThisStep: readonly string[];
  readonly requiredApprovals: readonly string[];
};

export const STAGE10_A_BOUNDARY_ITEM_SPECS: Record<(typeof STAGE10_A_REQUIRED_ITEM_IDS)[number], BoundaryItemSpec> = {
  "external-adapter-contract": {
    area: "external_adapter_contract",
    title: "External Adapter Contract",
    purpose: "Contract for external execution adapters before dry-run package.",
    stage11Candidate: false,
    requiredBeforeStage11: true,
    forbiddenInThisStep: ["actual_cursor_execution", "actual_github_write"],
    requiredApprovals: ["runtime_operator"],
  },
  "cursor-github-boundary": {
    area: "cursor_github_boundary",
    title: "Cursor/GitHub Execution Boundary",
    purpose: "Design-only boundary for Cursor and GitHub execution paths.",
    stage11Candidate: false,
    requiredBeforeStage11: true,
    forbiddenInThisStep: ["actual_cursor_execution", "actual_github_write"],
    requiredApprovals: ["security_operator"],
  },
  "connector-gateway-boundary": {
    area: "connector_gateway_boundary",
    title: "Connector Gateway Execution Boundary",
    purpose: "Design-only boundary for Connector Gateway routing.",
    stage11Candidate: false,
    requiredBeforeStage11: true,
    forbiddenInThisStep: ["actual_connector_gateway_routing_change"],
    requiredApprovals: ["security_operator"],
  },
  "runner-process-boundary": {
    area: "runner_process_boundary",
    title: "Runner Process Boundary",
    purpose: "Design-only boundary for runner process attachment.",
    stage11Candidate: false,
    requiredBeforeStage11: true,
    forbiddenInThisStep: ["actual_production_runner"],
    requiredApprovals: ["runtime_operator"],
  },
  "operator-approval-boundary": {
    area: "operator_approval_boundary",
    title: "Operator Approval Boundary",
    purpose: "Operator approval required before external execution dry-run.",
    stage11Candidate: false,
    requiredBeforeStage11: true,
    forbiddenInThisStep: ["actual_cursor_execution"],
    requiredApprovals: ["runtime_operator", "security_operator"],
  },
  "dry-run-simulation-boundary": {
    area: "dry_run_simulation_boundary",
    title: "Dry-run Simulation Boundary",
    purpose: "Dry-run simulation contract without external side effects.",
    stage11Candidate: false,
    requiredBeforeStage11: true,
    forbiddenInThisStep: ["actual_production_runner"],
    requiredApprovals: ["runtime_operator"],
  },
  "rollback-boundary": {
    area: "rollback_boundary",
    title: "Rollback Boundary",
    purpose: "Rollback plan boundary before external execution.",
    stage11Candidate: false,
    requiredBeforeStage11: true,
    forbiddenInThisStep: ["actual_persistent_database_write"],
    requiredApprovals: ["security_operator"],
  },
  "audit-boundary": {
    area: "audit_boundary",
    title: "Audit Boundary",
    purpose: "Audit event boundary before external execution.",
    stage11Candidate: false,
    requiredBeforeStage11: true,
    forbiddenInThisStep: ["actual_db_schema_migration"],
    requiredApprovals: ["runtime_operator"],
  },
  [STAGE11_ENTRY_ITEM_ID]: {
    area: "stage11_entry",
    title: "Stage 11 Dry-run Package Entry",
    purpose: "Entry candidate for Stage 11 external execution adapter dry-run package.",
    stage11Candidate: true,
    requiredBeforeStage11: true,
    forbiddenInThisStep: [
      "actual_cursor_execution",
      "actual_db_schema_migration",
      "actual_production_runner",
    ],
    requiredApprovals: ["operator_stage11_entry_approval", "adapter_boundary_scope_approval"],
  },
};

export { STAGE11_ENTRY_ITEM_ID };
