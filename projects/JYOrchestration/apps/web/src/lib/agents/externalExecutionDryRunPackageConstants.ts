/**
 * Stage 11-A external execution dry-run package constants (read-only).
 */

import type { ExternalExecutionDryRunPackageArea } from "@/lib/agents/externalExecutionDryRunPackageTypes";

export const EXTERNAL_EXECUTION_DRY_RUN_PACKAGE_VERSION = "external_execution_dry_run_package_v1" as const;

export const EXTERNAL_EXECUTION_DRY_RUN_PACKAGE_TITLE =
  "Stage 11-A External Execution Adapter Dry-run Package" as const;

export const REQUIRED_STAGE11_A_CONFIRMATIONS = [
  "adapterDryRunReviewed",
  "cursorGithubDryRunReviewed",
  "connectorDryRunReviewed",
  "runnerDryRunReviewed",
  "approvalBeforeDryRunReviewed",
  "rollbackBeforeDryRunReviewed",
  "auditBeforeDryRunReviewed",
  "noSideEffectBoundaryReviewed",
  "agentRegistryChangeBoundaryReviewed",
  "stage12EntryReviewed",
] as const;

export const STAGE11_A_REQUIRED_ITEM_IDS = [
  "adapter-dry-run-contract",
  "cursor-github-dry-run-contract",
  "connector-gateway-dry-run-contract",
  "runner-process-dry-run-contract",
  "operator-approval-before-dry-run",
  "rollback-plan-before-external-execution",
  "audit-event-before-external-execution",
  "no-side-effect-boundary",
  "agent-registry-change-boundary",
  "stage12-manual-dry-run-gate-entry",
] as const;

export const STAGE12_ENTRY_SCOPE = [
  "external_execution_adapter_manual_dry_run_gate",
  "operator_approved_dry_run_invocation",
  "mock_external_adapter_result_package",
  "dry_run_audit_event_package",
  "rollback_plan_review_before_actual_execution",
  "manual_dry_run_gate_boundary",
  "operator_approved_manual_dry_run_request",
  "no_side_effect_external_adapter_simulation",
] as const;

export const STAGE12_ENTRY_OUT_OF_SCOPE = [
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
  "actual_manual_external_invocation",
  "actual_adapter_side_effect",
  "actual_agent_registry_mutation",
] as const;

export const STAGE12_ENTRY_REQUIRED_FORBIDDEN_MARKERS = [
  "actual_cursor_execution",
  "actual_db_schema_migration",
  "actual_production_runner",
] as const;

export const STAGE12_ENTRY_REQUIRED_APPROVALS = [
  "operator_stage12_entry_approval",
  "dry_run_scope_boundary_approval",
] as const;

export const STAGE11_A_RECOMMENDED_NEXT_PHASES = [
  "stage_12_a_external_execution_adapter_manual_dry_run_gate",
  "stage_12_b_mock_external_adapter_result_package",
] as const;

export const STAGE11_A_SEPARATED_WORK_ITEMS = [
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
  "actual_manual_external_invocation",
  "actual_adapter_side_effect",
  "actual_agent_registry_mutation",
] as const;

const STAGE12_ENTRY_ITEM_ID = "stage12-manual-dry-run-gate-entry";

type DryRunItemSpec = {
  readonly area: ExternalExecutionDryRunPackageArea;
  readonly title: string;
  readonly purpose: string;
  readonly stage12Candidate: boolean;
  readonly requiredBeforeStage12: boolean;
  readonly forbiddenInThisStep: readonly string[];
  readonly requiredApprovals: readonly string[];
};

export const STAGE11_A_DRY_RUN_ITEM_SPECS: Record<(typeof STAGE11_A_REQUIRED_ITEM_IDS)[number], DryRunItemSpec> = {
  "adapter-dry-run-contract": {
    area: "adapter_dry_run_contract",
    title: "Adapter Dry-run Contract",
    purpose: "Dry-run contract for external execution adapters.",
    stage12Candidate: false,
    requiredBeforeStage12: true,
    forbiddenInThisStep: ["actual_cursor_execution", "actual_github_write"],
    requiredApprovals: ["runtime_operator"],
  },
  "cursor-github-dry-run-contract": {
    area: "cursor_github_dry_run_contract",
    title: "Cursor/GitHub Dry-run Contract",
    purpose: "Dry-run contract for Cursor and GitHub adapter paths.",
    stage12Candidate: false,
    requiredBeforeStage12: true,
    forbiddenInThisStep: ["actual_cursor_execution", "actual_github_write"],
    requiredApprovals: ["security_operator"],
  },
  "connector-gateway-dry-run-contract": {
    area: "connector_gateway_dry_run_contract",
    title: "Connector Gateway Dry-run Contract",
    purpose: "Dry-run contract for Connector Gateway adapter.",
    stage12Candidate: false,
    requiredBeforeStage12: true,
    forbiddenInThisStep: ["actual_connector_gateway_routing_change"],
    requiredApprovals: ["security_operator"],
  },
  "runner-process-dry-run-contract": {
    area: "runner_process_dry_run_contract",
    title: "Runner Process Dry-run Contract",
    purpose: "Dry-run contract for runner process adapter.",
    stage12Candidate: false,
    requiredBeforeStage12: true,
    forbiddenInThisStep: ["actual_production_runner"],
    requiredApprovals: ["runtime_operator"],
  },
  "operator-approval-before-dry-run": {
    area: "operator_approval",
    title: "Operator Approval Before Dry-run",
    purpose: "Operator approval required before dry-run invocation.",
    stage12Candidate: false,
    requiredBeforeStage12: true,
    forbiddenInThisStep: ["actual_cursor_execution"],
    requiredApprovals: ["runtime_operator", "security_operator"],
  },
  "rollback-plan-before-external-execution": {
    area: "rollback_plan",
    title: "Rollback Plan Before External Execution",
    purpose: "Rollback plan required before external execution.",
    stage12Candidate: false,
    requiredBeforeStage12: true,
    forbiddenInThisStep: ["actual_persistent_database_write"],
    requiredApprovals: ["security_operator"],
  },
  "audit-event-before-external-execution": {
    area: "audit_event",
    title: "Audit Event Before External Execution",
    purpose: "Audit event package before external execution.",
    stage12Candidate: false,
    requiredBeforeStage12: true,
    forbiddenInThisStep: ["actual_db_schema_migration"],
    requiredApprovals: ["runtime_operator"],
  },
  "no-side-effect-boundary": {
    area: "no_side_effect_boundary",
    title: "No Side-effect Boundary",
    purpose: "Dry-run must not cause external side effects.",
    stage12Candidate: false,
    requiredBeforeStage12: true,
    forbiddenInThisStep: [
      "actual_cursor_execution",
      "actual_github_write",
      "actual_connector_gateway_routing_change",
      "full_runtime_ui",
    ],
    requiredApprovals: ["security_operator"],
  },
  "agent-registry-change-boundary": {
    area: "agent_registry_change_boundary",
    title: "Agent Registry Change Boundary",
    purpose: "Agent registry mutations are out of runtime dry-run scope.",
    stage12Candidate: false,
    requiredBeforeStage12: true,
    forbiddenInThisStep: ["agent_registry_crud", "agent_add_remove_deactivate_apply", "agent_management_ui"],
    requiredApprovals: ["orchestration_operator", "security_operator"],
  },
  [STAGE12_ENTRY_ITEM_ID]: {
    area: "stage12_entry",
    title: "Stage 12 Manual Dry-run Gate Entry",
    purpose: "Entry candidate for Stage 12 manual dry-run gate.",
    stage12Candidate: true,
    requiredBeforeStage12: true,
    forbiddenInThisStep: [
      "actual_cursor_execution",
      "actual_db_schema_migration",
      "actual_production_runner",
    ],
    requiredApprovals: ["operator_stage12_entry_approval", "dry_run_scope_boundary_approval"],
  },
};

export { STAGE12_ENTRY_ITEM_ID };
