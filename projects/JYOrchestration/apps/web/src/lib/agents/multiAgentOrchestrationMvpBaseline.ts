/**
 * Multi-agent orchestration MVP baseline (read-only foundation; no runtime/RAG/DB/UI).
 */

import type { Stage4IntegratedClosureVerdictDecision } from "@/lib/agents/stage4IntegratedClosureVerdictTypes";

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

/** Stage 5 entry candidates — planning only; no runtime/RAG/DB work in Stage 4-F. */
export const STAGE5_ENTRY_CANDIDATES = [
  "role_knowledge_binding_foundation",
  "runtime_execution_design",
  "continue_read_only_hardening",
] as const;

export const STAGE4_CLOSURE_BASELINE_REPORT = {
  stage2Through4ClosureScope: STAGE2_THROUGH4_CLOSURE_SCOPE,
  stage2Through4ClosedStages: STAGE2_THROUGH4_CLOSED_STAGES,
  mvpBaselinePreserved: true,
  mvpBaselineSummary: MULTI_AGENT_ORCHESTRATION_MVP_BASELINE_SUMMARY,
  actualRuntimeChangeAllowedAfterStage4: false as const,
  actualConnectorRoutingChangeAllowedAfterStage4: false as const,
  actualWritePathWireAllowedAfterStage4: false as const,
  actualSchemaMigrationAllowedAfterStage4: false as const,
  stage5EntryIsCandidateOnly: true as const,
} as const;

/** Stage 5-A read-only boundary report (not knowledge-pack implementation). */
export const STAGE5_A_BOUNDARY_REPORT = {
  stage5CandidateFoundationOnly: true as const,
  stage5AIsKnowledgePackImplementation: false as const,
  readsRoleKnowledgeBindingRegistryInThisStep: true as const,
  writesRoleKnowledgeBindingRegistryInThisStep: false as const,
  modifiesKnowledgePackRegistryInThisStep: false as const,
  createsKnowledgePackInThisStep: false as const,
  updatesKnowledgePackInThisStep: false as const,
  versionsKnowledgePackInThisStep: false as const,
  uploadsSourceDocumentInThisStep: false as const,
  indexesKnowledgePackInThisStep: false as const,
  embedsKnowledgePackInThisStep: false as const,
  retrievesKnowledgeWithRagInThisStep: false as const,
  injectsKnowledgeIntoPromptInThisStep: false as const,
  modifiesRuntimeExecutionInThisStep: false as const,
  modifiesDbInThisStep: false as const,
  modifiesUiInThisStep: false as const,
  mvpBaselineBindingRole: "role_to_knowledge_pack_id_readiness_only" as const,
  usesRagInThisStep: false as const,
  writesKnowledgePackInThisStep: false as const,
  modifiesPromptInjectionInThisStep: false as const,
} as const;

export const STAGE5_A_BOUNDARY_CHECKLIST_ENTRIES = [
  { item: "stage5-a foundation only", detail: "stage5CandidateFoundationOnly=true" },
  { item: "knowledge pack implementation not started", detail: "stage5AIsKnowledgePackImplementation=false" },
  { item: "role-to-knowledge-pack-id readiness only", detail: "mvpBaselineBindingRole=role_to_knowledge_pack_id_readiness_only" },
  { item: "RAG indexing not used", detail: "indexesKnowledgePackInThisStep=false" },
  { item: "embedding not used", detail: "embedsKnowledgePackInThisStep=false" },
  { item: "prompt injection not modified", detail: "injectsKnowledgeIntoPromptInThisStep=false" },
  { item: "runtime execution not modified", detail: "modifiesRuntimeExecutionInThisStep=false" },
  { item: "DB not modified", detail: "modifiesDbInThisStep=false" },
  { item: "UI not modified", detail: "modifiesUiInThisStep=false" },
] as const;

export const STAGE4_READY_BASELINE_FINDING_SPECS = [
  { code: "stage2_through_stage4_closure_locked", message: "Stage 2 through Stage 4 read-only closure is locked" },
  {
    code: "stage2_through_stage4_read_only_scope_confirmed",
    message: "Stage 2 through Stage 4 scope is read-only multi-agent runtime foundation",
  },
  { code: "mvp_baseline_preserved", message: "Multi-agent orchestration MVP baseline is preserved" },
  {
    code: "stage5_entry_candidate_only",
    message: "Stage 5 entry is candidate definition only; not implementation transition",
  },
  {
    code: "actual_runtime_change_still_disallowed",
    message: "Actual runtime change remains disallowed after Stage 4-F",
  },
  {
    code: "actual_connector_routing_change_still_disallowed",
    message: "Actual connector routing change remains disallowed after Stage 4-F",
  },
  {
    code: "actual_write_path_wire_still_disallowed",
    message: "Actual write path wire remains disallowed after Stage 4-F",
  },
  {
    code: "actual_schema_migration_still_disallowed",
    message: "Actual schema migration remains disallowed after Stage 4-F",
  },
] as const;

export const STAGE5_A_BOUNDARY_FINDING_SPECS = [
  { code: "stage5_a_foundation_only", message: "Stage 5-A is foundation only" },
  {
    code: "stage5_a_not_knowledge_pack_implementation",
    message: "Stage 5-A is not knowledge pack management implementation",
  },
  { code: "stage5_a_registry_read_only", message: "Role knowledge binding registry is read-only" },
  {
    code: "stage5_a_candidate_foundation_only",
    message: "Stage 5-A is a Stage 5 entry candidate at read-only foundation level; not full knowledge pack implementation",
  },
  { code: "role_knowledge_binding_read_only", message: "Role knowledge binding readiness is read-only" },
  { code: "rag_not_used_in_stage_5_a", message: "RAG is not used in Stage 5-A" },
  { code: "prompt_injection_not_modified_in_stage_5_a", message: "Prompt injection is not modified in Stage 5-A" },
  { code: "runtime_wire_not_modified_in_stage_5_a", message: "Runtime wire is not modified in Stage 5-A" },
  { code: "db_schema_migration_not_modified_in_stage_5_a", message: "DB/schema/migration is not modified in Stage 5-A" },
  {
    code: "knowledge_pack_ui_not_implemented_in_stage_5_a",
    message: "Knowledge pack management UI is not implemented in Stage 5-A",
  },
  {
    code: "mvp_role_knowledge_binding_baseline_preserved",
    message: "MVP role knowledge binding baseline is role-to-knowledge-pack-id readiness only",
  },
] as const;

/** Whether Stage 2~4 read-only closure chain is locked at Stage 4-F. */
export function resolveStage2Through4ClosureLocked(input: {
  readonly decision: Stage4IntegratedClosureVerdictDecision;
  readonly sourceReviewPackageDecision: string;
  readonly sourceNoRunChecklistCount: number;
  readonly sourceNoRunChecklistSatisfiedCount: number;
  readonly closureNoRunViolated: boolean;
}): boolean {
  if (input.decision !== "stage4_closure_ready") {
    return false;
  }

  if (input.sourceReviewPackageDecision === "blocked") {
    return false;
  }

  if (input.sourceNoRunChecklistSatisfiedCount !== input.sourceNoRunChecklistCount) {
    return false;
  }

  if (input.closureNoRunViolated) {
    return false;
  }

  return true;
}

export function buildStage4ClosureBaselineFields(input: {
  readonly decision: Stage4IntegratedClosureVerdictDecision;
  readonly sourceReviewPackageDecision: string;
  readonly sourceNoRunChecklistCount: number;
  readonly sourceNoRunChecklistSatisfiedCount: number;
  readonly closureNoRunViolated: boolean;
}) {
  const stage2Through4ClosureLocked = resolveStage2Through4ClosureLocked(input);
  return {
    stage2Through4ClosureLocked,
    ...STAGE4_CLOSURE_BASELINE_REPORT,
  };
}
