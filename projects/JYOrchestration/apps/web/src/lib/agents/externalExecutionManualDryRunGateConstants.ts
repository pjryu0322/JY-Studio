/**
 * Stage 12-A manual dry-run gate constants (read-only).
 */

import type { ExternalExecutionManualDryRunGateArea } from "@/lib/agents/externalExecutionManualDryRunGateTypes";

export const EXTERNAL_EXECUTION_MANUAL_DRY_RUN_GATE_VERSION =
  "external_execution_manual_dry_run_gate_v1" as const;

export const EXTERNAL_EXECUTION_MANUAL_DRY_RUN_GATE_TITLE =
  "Stage 12-A External Execution Adapter Manual Dry-run Gate" as const;

export const REQUIRED_STAGE12_A_CONFIRMATIONS = [
  "manualGateReviewed",
  "operatorInvocationReviewed",
  "mockAdapterResultReviewed",
  "dryRunAuditReviewed",
  "rollbackReviewCompleted",
  "noSideEffectBoundaryReviewed",
  "agentRegistryBoundaryReviewed",
  "stage13EntryReviewed",
] as const;

export const STAGE12_A_REQUIRED_ITEM_IDS = [
  "manual-dry-run-gate",
  "operator-approved-invocation-request",
  "mock-external-adapter-result-package",
  "dry-run-audit-event-package",
  "rollback-plan-review-before-actual-execution",
  "no-side-effect-manual-gate-boundary",
  "agent-registry-change-boundary",
  "stage13-actual-external-adapter-candidate-entry",
] as const;

export const STAGE13_ENTRY_SCOPE = [
  "actual_external_execution_adapter_candidate",
  "manual_approval_before_actual_external_execution",
  "operator_confirmed_execution_window",
  "rollback_plan_required_before_actual_execution",
  "audit_event_required_before_actual_execution",
  "cursor_adapter_candidate_boundary",
  "github_write_adapter_candidate_boundary",
  "connector_gateway_adapter_candidate_boundary",
  "runner_process_adapter_candidate_boundary",
  "adapter_permission_contract_candidate",
  "adapter_result_contract_candidate",
  "adapter_audit_contract_candidate",
  "adapter_rollback_contract_candidate",
] as const;

export const STAGE13_ENTRY_OUT_OF_SCOPE = [
  "unapproved_cursor_execution",
  "unapproved_github_write",
  "unapproved_connector_gateway_call",
  "unapproved_db_schema_migration",
  "unapproved_production_runner",
  "actual_cursor_adapter_implementation",
  "actual_network_side_effect",
  "full_runtime_ui",
  "agent_registry_crud",
  "agent_add_remove_deactivate_apply",
  "agent_management_ui",
] as const;

export const STAGE13_ENTRY_REQUIRED_FORBIDDEN_MARKERS = [
  "unapproved_cursor_execution",
  "unapproved_db_schema_migration",
  "unapproved_production_runner",
] as const;

export const STAGE13_ENTRY_REQUIRED_APPROVALS = [
  "operator_stage13_entry_approval",
  "manual_gate_scope_boundary_approval",
] as const;

export const STAGE12_A_RECOMMENDED_NEXT_PHASES = [
  "stage_13_a_actual_external_execution_adapter_candidate",
  "stage_13_b_operator_approved_actual_execution_boundary",
] as const;

export const STAGE12_A_SEPARATED_WORK_ITEMS = [
  "actual_cursor_execution",
  "actual_cursor_adapter_implementation",
  "actual_github_write",
  "actual_github_adapter_implementation",
  "actual_connector_gateway_call",
  "actual_connector_adapter_implementation",
  "actual_runner_adapter_implementation",
  "actual_adapter_credential_usage",
  "actual_network_side_effect",
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

const STAGE13_ENTRY_ITEM_ID = "stage13-actual-external-adapter-candidate-entry";

type GateItemSpec = {
  readonly area: ExternalExecutionManualDryRunGateArea;
  readonly title: string;
  readonly purpose: string;
  readonly stage13Candidate: boolean;
  readonly requiredBeforeStage13: boolean;
  readonly forbiddenInThisStep: readonly string[];
  readonly requiredApprovals: readonly string[];
};

export const STAGE12_A_GATE_ITEM_SPECS: Record<(typeof STAGE12_A_REQUIRED_ITEM_IDS)[number], GateItemSpec> = {
  "manual-dry-run-gate": {
    area: "manual_dry_run_gate",
    title: "Manual Dry-run Gate",
    purpose: "Operator-approved manual dry-run gate without external side effects.",
    stage13Candidate: false,
    requiredBeforeStage13: true,
    forbiddenInThisStep: ["actual_manual_external_invocation", "actual_adapter_side_effect"],
    requiredApprovals: ["runtime_operator"],
  },
  "operator-approved-invocation-request": {
    area: "operator_invocation_request",
    title: "Operator-approved Invocation Request",
    purpose: "Dry-run invocation request requires operator approval.",
    stage13Candidate: false,
    requiredBeforeStage13: true,
    forbiddenInThisStep: ["actual_manual_external_invocation"],
    requiredApprovals: ["runtime_operator", "security_operator"],
  },
  "mock-external-adapter-result-package": {
    area: "mock_external_adapter_result",
    title: "Mock External Adapter Result Package",
    purpose: "Mock external adapter result package for dry-run validation.",
    stage13Candidate: false,
    requiredBeforeStage13: true,
    forbiddenInThisStep: ["actual_adapter_side_effect"],
    requiredApprovals: ["runtime_operator"],
  },
  "dry-run-audit-event-package": {
    area: "dry_run_audit_event",
    title: "Dry-run Audit Event Package",
    purpose: "Audit event package before manual dry-run gate proceeds.",
    stage13Candidate: false,
    requiredBeforeStage13: true,
    forbiddenInThisStep: ["actual_db_schema_migration"],
    requiredApprovals: ["runtime_operator"],
  },
  "rollback-plan-review-before-actual-execution": {
    area: "rollback_review",
    title: "Rollback Plan Review Before Actual Execution",
    purpose: "Rollback plan review required before actual external execution.",
    stage13Candidate: false,
    requiredBeforeStage13: true,
    forbiddenInThisStep: ["actual_persistent_database_write"],
    requiredApprovals: ["security_operator"],
  },
  "no-side-effect-manual-gate-boundary": {
    area: "no_side_effect_boundary",
    title: "No Side-effect Manual Gate Boundary",
    purpose: "Manual gate must not cause external adapter side effects.",
    stage13Candidate: false,
    requiredBeforeStage13: true,
    forbiddenInThisStep: [
      "actual_manual_external_invocation",
      "actual_adapter_side_effect",
      "unapproved_cursor_execution",
    ],
    requiredApprovals: ["security_operator"],
  },
  "agent-registry-change-boundary": {
    area: "agent_registry_change_boundary",
    title: "Agent Registry Change Boundary",
    purpose: "Agent registry mutations remain out of manual dry-run scope.",
    stage13Candidate: false,
    requiredBeforeStage13: true,
    forbiddenInThisStep: ["agent_registry_crud", "agent_add_remove_deactivate_apply", "actual_agent_registry_mutation"],
    requiredApprovals: ["orchestration_operator", "security_operator"],
  },
  [STAGE13_ENTRY_ITEM_ID]: {
    area: "stage13_entry",
    title: "Stage 13 Actual External Adapter Candidate Entry",
    purpose: "Entry candidate for Stage 13 actual external execution adapter.",
    stage13Candidate: true,
    requiredBeforeStage13: true,
    forbiddenInThisStep: [
      "unapproved_cursor_execution",
      "unapproved_db_schema_migration",
      "unapproved_production_runner",
    ],
    requiredApprovals: ["operator_stage13_entry_approval", "manual_gate_scope_boundary_approval"],
  },
};

export { STAGE13_ENTRY_ITEM_ID };
