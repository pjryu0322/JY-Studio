/**
 * Multi-agent orchestration MVP baseline (read-only foundation; no runtime/RAG/DB/UI).
 */

export const MULTI_AGENT_ORCHESTRATION_MVP_BASELINE = {
  id: "multi_agent_orchestration_mvp_baseline_v1",
  scope: "read_only_multi_agent_runtime_foundation",
  preservedCapabilities: [
    "role_based_ai_members",
    "runtime_governance_decision_reports",
    "connector_gateway_routing_candidates",
    "operator_approval_gates",
    "stage_closure_verdicts",
    "role_knowledge_binding_readiness",
  ],
  disallowedInBaseline: [
    "actual_runtime_execution",
    "actual_connector_gateway_routing_change",
    "actual_cursor_or_github_execution",
    "actual_write_path_wire",
    "actual_schema_migration",
    "actual_db_write",
    "actual_rag_indexing",
    "actual_prompt_injection",
    "knowledge_pack_management_ui",
  ],
} as const;

export const MULTI_AGENT_ORCHESTRATION_MVP_BASELINE_SUMMARY =
  "Multi-agent orchestration MVP baseline is preserved as a read-only foundation: role-based agents, runtime/governance decision reports, connector routing candidates, approval gates, and no actual runtime/schema/git/write-path execution.";

export const STAGE2_THROUGH4_CLOSED_STAGES = [
  "stage_2_read_only_runtime_governance",
  "stage_3_runtime_execution_handoff_and_approval_design",
  "stage_4_controlled_runtime_wire_and_closure_review",
] as const;

export const STAGE2_THROUGH4_CLOSURE_SCOPE = "read_only_multi_agent_runtime_foundation" as const;
