/**
 * Stage 5-F integrated closure constants (read-only).
 */

export const STAGE5_INTEGRATED_CLOSURE_VERSION = "stage_5_integrated_knowledge_foundation_closure_v1" as const;
export const STAGE5_INTEGRATED_CLOSURE_TITLE =
  "Stage 5 Integrated Knowledge Foundation Closure (Read-Only)";

export const RECOMMENDED_NEXT_PHASES = [
  "prepare_stage6_runtime_execution_model_design",
  "prepare_agent_execution_record_persistence_separate_pr",
  "prepare_operator_approval_audit_persistence_separate_pr",
  "prepare_knowledge_pack_metadata_registry_separate_pr",
  "continue_read_only_runtime_hardening_if_needed",
] as const;

export const SEPARATED_WORK_ITEMS = [
  "actual_knowledge_pack_crud",
  "actual_rag_indexing",
  "actual_prompt_context_injection_wire",
  "actual_runtime_execution_wire",
  "actual_db_schema_migration",
  "actual_knowledge_pack_management_ui",
] as const;

export const STAGE6_ENTRY_GUARD_REPORT = {
  stage6EntryCandidate: "runtime_execution_model_design" as const,
  stage6EntryMode: "design_candidate_only" as const,
  stage6ActualRuntimeExecutionAllowed: false as const,
  stage6RequiresSeparateApproval: true as const,
  stage6EntryIsCandidateOnly: true as const,
} as const;

export const STAGE5_INTEGRATED_POSTURE_REPORT = {
  knowledgeFoundationOnly: true as const,
  stage5ActualImplementationDisallowed: true as const,
  actualKnowledgePackImplementationAllowedAfterStage5: false as const,
  actualKnowledgePackCrudAllowedAfterStage5: false as const,
  actualRagIndexingAllowedAfterStage5: false as const,
  actualPromptInjectionAllowedAfterStage5: false as const,
  actualRuntimeExecutionAllowedAfterStage5: false as const,
  actualDbMigrationAllowedAfterStage5: false as const,
  actualUiImplementationAllowedAfterStage5: false as const,
} as const;

export const STAGE5_INTEGRATED_BOUNDARY_CHECKLIST_ENTRIES = [
  { item: "knowledgeFoundationOnly=true", detail: "knowledgeFoundationOnly=true" },
  {
    item: "actualKnowledgePackImplementationAllowedAfterStage5=false",
    detail: "actualKnowledgePackImplementationAllowedAfterStage5=false",
  },
  { item: "actualKnowledgePackCrudAllowedAfterStage5=false", detail: "actualKnowledgePackCrudAllowedAfterStage5=false" },
  { item: "actualRagIndexingAllowedAfterStage5=false", detail: "actualRagIndexingAllowedAfterStage5=false" },
  { item: "actualPromptInjectionAllowedAfterStage5=false", detail: "actualPromptInjectionAllowedAfterStage5=false" },
  { item: "actualRuntimeExecutionAllowedAfterStage5=false", detail: "actualRuntimeExecutionAllowedAfterStage5=false" },
  { item: "actualDbMigrationAllowedAfterStage5=false", detail: "actualDbMigrationAllowedAfterStage5=false" },
  { item: "actualUiImplementationAllowedAfterStage5=false", detail: "actualUiImplementationAllowedAfterStage5=false" },
  { item: "stage6EntryIsCandidateOnly=true", detail: "stage6EntryIsCandidateOnly=true" },
] as const;
