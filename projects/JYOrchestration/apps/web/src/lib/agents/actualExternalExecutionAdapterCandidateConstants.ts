/**
 * Stage 13-A actual external adapter candidate constants (read-only).
 */

import type { ActualExternalExecutionAdapterCandidateArea } from "@/lib/agents/actualExternalExecutionAdapterCandidateTypes";

export const ACTUAL_EXTERNAL_EXECUTION_ADAPTER_CANDIDATE_VERSION =
  "actual_external_execution_adapter_candidate_v1" as const;

export const ACTUAL_EXTERNAL_EXECUTION_ADAPTER_CANDIDATE_TITLE =
  "Stage 13-A Actual External Execution Adapter Candidate Boundary" as const;

export const REQUIRED_STAGE13_A_CONFIRMATIONS = [
  "cursorAdapterCandidateReviewed",
  "githubAdapterCandidateReviewed",
  "connectorAdapterCandidateReviewed",
  "runnerAdapterCandidateReviewed",
  "adapterPermissionContractReviewed",
  "adapterResultContractReviewed",
  "adapterAuditContractReviewed",
  "adapterRollbackContractReviewed",
  "noSideEffectCandidateBoundaryReviewed",
  "agentRegistryBoundaryReviewed",
  "stage14EntryReviewed",
] as const;

export const STAGE13_A_REQUIRED_ITEM_IDS = [
  "cursor-execution-adapter-candidate",
  "github-write-adapter-candidate",
  "connector-gateway-call-adapter-candidate",
  "runner-process-adapter-candidate",
  "adapter-permission-contract",
  "adapter-result-contract",
  "adapter-audit-contract",
  "adapter-rollback-contract",
  "no-side-effect-candidate-boundary",
  "agent-registry-change-boundary",
  "stage14-operator-approved-actual-execution-entry",
] as const;

export const STAGE14_ENTRY_SCOPE = [
  "operator_approved_actual_external_execution",
  "approved_cursor_execution_adapter",
  "approved_github_write_adapter",
  "approved_connector_gateway_call_adapter",
  "approved_runner_process_adapter",
  "credential_boundary_required",
  "network_side_effect_boundary_required",
  "rollback_and_audit_required",
] as const;

export const STAGE14_ENTRY_OUT_OF_SCOPE = [
  "unapproved_cursor_execution",
  "unapproved_github_write",
  "unapproved_connector_gateway_call",
  "unapproved_db_schema_migration",
  "unapproved_production_runner",
  "full_runtime_ui",
  "agent_registry_crud",
  "agent_add_remove_deactivate_apply",
  "agent_management_ui",
] as const;

export const STAGE14_ENTRY_REQUIRED_FORBIDDEN_MARKERS = [
  "unapproved_cursor_execution",
  "unapproved_db_schema_migration",
  "unapproved_production_runner",
] as const;

export const STAGE14_ENTRY_REQUIRED_APPROVALS = [
  "operator_stage14_entry_approval",
  "adapter_candidate_scope_boundary_approval",
] as const;

export const STAGE13_A_RECOMMENDED_NEXT_PHASES = [
  "stage_14_a_operator_approved_actual_external_execution",
  "stage_14_b_external_adapter_execution_audit_and_rollback",
] as const;

export const STAGE13_A_SEPARATED_WORK_ITEMS = [
  "actual_cursor_execution_adapter_implementation",
  "actual_github_write_adapter_implementation",
  "actual_connector_gateway_call_adapter_implementation",
  "actual_runner_process_adapter_implementation",
  "actual_credential_store_integration",
  "actual_network_side_effect_execution",
  "actual_db_schema_migration",
  "actual_persistent_database_write",
  "full_runtime_ui",
  "agent_registry_change_management",
  "agent_add_remove_deactivate_flow",
  "agent_role_slot_ownership_impact_analysis",
  "mandatory_gate_agent_deactivation_policy",
  "agent_knowledge_binding_change_approval",
  "agent_change_audit_trail",
] as const;

const STAGE14_ENTRY_ITEM_ID = "stage14-operator-approved-actual-execution-entry";

type CandidateItemSpec = {
  readonly area: ActualExternalExecutionAdapterCandidateArea;
  readonly title: string;
  readonly purpose: string;
  readonly stage14Candidate: boolean;
  readonly requiredBeforeStage14: boolean;
  readonly forbiddenInThisStep: readonly string[];
  readonly requiredApprovals: readonly string[];
};

export const STAGE13_A_CANDIDATE_ITEM_SPECS: Record<(typeof STAGE13_A_REQUIRED_ITEM_IDS)[number], CandidateItemSpec> = {
  "cursor-execution-adapter-candidate": {
    area: "cursor_adapter_candidate",
    title: "Cursor Execution Adapter Candidate",
    purpose: "Cursor execution adapter candidate boundary before actual implementation.",
    stage14Candidate: false,
    requiredBeforeStage14: true,
    forbiddenInThisStep: ["actual_cursor_adapter_implementation", "unapproved_cursor_execution"],
    requiredApprovals: ["runtime_operator", "security_operator"],
  },
  "github-write-adapter-candidate": {
    area: "github_write_adapter_candidate",
    title: "GitHub Write Adapter Candidate",
    purpose: "GitHub write adapter candidate boundary before actual implementation.",
    stage14Candidate: false,
    requiredBeforeStage14: true,
    forbiddenInThisStep: ["actual_github_adapter_implementation", "unapproved_github_write"],
    requiredApprovals: ["runtime_operator", "security_operator"],
  },
  "connector-gateway-call-adapter-candidate": {
    area: "connector_gateway_adapter_candidate",
    title: "Connector Gateway Call Adapter Candidate",
    purpose: "Connector gateway call adapter candidate boundary before actual implementation.",
    stage14Candidate: false,
    requiredBeforeStage14: true,
    forbiddenInThisStep: ["actual_connector_adapter_implementation", "unapproved_connector_gateway_call"],
    requiredApprovals: ["runtime_operator", "security_operator"],
  },
  "runner-process-adapter-candidate": {
    area: "runner_process_adapter_candidate",
    title: "Runner Process Adapter Candidate",
    purpose: "Runner process adapter candidate boundary before actual implementation.",
    stage14Candidate: false,
    requiredBeforeStage14: true,
    forbiddenInThisStep: ["actual_runner_adapter_implementation", "unapproved_production_runner"],
    requiredApprovals: ["runtime_operator", "security_operator"],
  },
  "adapter-permission-contract": {
    area: "adapter_permission_contract",
    title: "Adapter Permission Contract",
    purpose: "Permission contract candidate for external execution adapters.",
    stage14Candidate: false,
    requiredBeforeStage14: true,
    forbiddenInThisStep: ["actual_adapter_credential_usage"],
    requiredApprovals: ["security_operator"],
  },
  "adapter-result-contract": {
    area: "adapter_result_contract",
    title: "Adapter Result Contract",
    purpose: "Result contract candidate for external execution adapters.",
    stage14Candidate: false,
    requiredBeforeStage14: true,
    forbiddenInThisStep: ["actual_network_side_effect"],
    requiredApprovals: ["runtime_operator"],
  },
  "adapter-audit-contract": {
    area: "adapter_audit_contract",
    title: "Adapter Audit Contract",
    purpose: "Audit contract candidate for external execution adapters.",
    stage14Candidate: false,
    requiredBeforeStage14: true,
    forbiddenInThisStep: ["actual_db_schema_migration"],
    requiredApprovals: ["runtime_operator"],
  },
  "adapter-rollback-contract": {
    area: "adapter_rollback_contract",
    title: "Adapter Rollback Contract",
    purpose: "Rollback contract candidate for external execution adapters.",
    stage14Candidate: false,
    requiredBeforeStage14: true,
    forbiddenInThisStep: ["actual_persistent_database_write"],
    requiredApprovals: ["security_operator"],
  },
  "no-side-effect-candidate-boundary": {
    area: "no_side_effect_candidate_boundary",
    title: "No Side-effect Candidate Boundary",
    purpose: "Candidate boundary must not allow external side effects in this step.",
    stage14Candidate: false,
    requiredBeforeStage14: true,
    forbiddenInThisStep: [
      "actual_network_side_effect",
      "actual_adapter_credential_usage",
      "unapproved_cursor_execution",
    ],
    requiredApprovals: ["security_operator"],
  },
  "agent-registry-change-boundary": {
    area: "agent_registry_change_boundary",
    title: "Agent Registry Change Boundary",
    purpose: "Agent registry mutations remain out of adapter candidate scope.",
    stage14Candidate: false,
    requiredBeforeStage14: true,
    forbiddenInThisStep: ["agent_registry_crud", "agent_add_remove_deactivate_apply", "actual_agent_registry_mutation"],
    requiredApprovals: ["orchestration_operator", "security_operator"],
  },
  [STAGE14_ENTRY_ITEM_ID]: {
    area: "stage14_entry",
    title: "Stage 14 Operator-approved Actual Execution Entry",
    purpose: "Entry candidate for Stage 14 operator-approved actual external execution.",
    stage14Candidate: true,
    requiredBeforeStage14: true,
    forbiddenInThisStep: [
      "unapproved_cursor_execution",
      "unapproved_db_schema_migration",
      "unapproved_production_runner",
    ],
    requiredApprovals: ["operator_stage14_entry_approval", "adapter_candidate_scope_boundary_approval"],
  },
};

export { STAGE14_ENTRY_ITEM_ID };
