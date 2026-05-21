/**
 * Stage 5-F integrated knowledge foundation closure support (read-only).
 */

import type {
  Stage5IntegratedKnowledgeFoundationClosureChecklistItem,
  Stage5IntegratedKnowledgeFoundationClosureDecision,
  Stage5IntegratedKnowledgeFoundationClosureDecisionInput,
  Stage5IntegratedKnowledgeFoundationClosureFinding,
} from "@/lib/agents/stage5IntegratedKnowledgeFoundationClosureTypes";

export const STAGE5_INTEGRATED_CLOSURE_VERSION = "stage_5_integrated_knowledge_foundation_closure_v1" as const;
export const STAGE5_INTEGRATED_CLOSURE_TITLE =
  "Stage 5 Integrated Knowledge Foundation Closure (Read-Only)";

export const RECOMMENDED_NEXT_PHASES = [
  "prepare_runtime_execution_model_design",
  "prepare_agent_execution_record_persistence_pr",
  "prepare_operator_approval_audit_persistence_pr",
  "prepare_knowledge_pack_metadata_registry_pr",
  "continue_read_only_runtime_hardening",
] as const;

export const SEPARATED_WORK_ITEMS = [
  "actual_knowledge_pack_crud",
  "actual_rag_indexing",
  "actual_prompt_context_injection_wire",
  "actual_runtime_execution_wire",
  "actual_db_schema_migration",
  "actual_knowledge_pack_management_ui",
] as const;

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

type ChecklistEntry = {
  readonly item: string;
  readonly satisfied: boolean;
  readonly detail: string;
};

function finding(
  severity: Stage5IntegratedKnowledgeFoundationClosureFinding["severity"],
  code: string,
  message: string,
): Stage5IntegratedKnowledgeFoundationClosureFinding {
  return { severity, code, message };
}

function mapChecklist(entries: readonly ChecklistEntry[]): Stage5IntegratedKnowledgeFoundationClosureChecklistItem[] {
  return entries.map((entry) => ({
    item: entry.item,
    satisfied: entry.satisfied,
    reason: `${entry.item}: ${entry.satisfied ? "satisfied" : "not satisfied"} — ${entry.detail}`,
  }));
}

export function resolveStage5IntegratedKnowledgeFoundationClosureDecision(
  input: Stage5IntegratedKnowledgeFoundationClosureDecisionInput,
): Stage5IntegratedKnowledgeFoundationClosureDecision {
  const sources = [
    input.sourceStage5AClosureDecision,
    input.sourceStage5BDecision,
    input.sourceStage5CDecision,
    input.sourceStage5DDecision,
  ];

  if (sources.some((d) => d === "blocked")) {
    return "blocked";
  }

  if (
    sources.some((d) => d === "defer") ||
    input.sourceStage5AClosureDecision !== "stage5_a_closure_ready" ||
    input.sourceStage5BDecision !== "ready_for_metadata_registry_design" ||
    input.sourceStage5CDecision !== "ready_for_mapping_design" ||
    input.sourceStage5DDecision !== "ready_for_prompt_context_design"
  ) {
    return "defer";
  }

  return "stage5_knowledge_foundation_ready";
}

export function buildStage5IntegratedKnowledgeFoundationClosureFingerprint(
  input: Stage5IntegratedKnowledgeFoundationClosureDecisionInput,
): string {
  return [
    "stage5-integrated-closure-v1",
    `5a-${input.sourceStage5AClosureDecision}`,
    `5b-${input.sourceStage5BDecision}`,
    `5c-${input.sourceStage5CDecision}`,
    `5d-${input.sourceStage5DDecision}`,
  ].join(":");
}

export function buildStage5IntegratedClosureSummary(
  decision: Stage5IntegratedKnowledgeFoundationClosureDecision,
): string {
  if (decision === "blocked") {
    return "Stage 5 integrated knowledge foundation closure is blocked due to a source stage decision.";
  }
  if (decision === "defer") {
    return "Stage 5 integrated knowledge foundation closure defers; one or more source stages are not ready.";
  }
  return "Stage 5 integrated read-only knowledge foundation meets closure criteria. This is not knowledge pack implementation permission.";
}

export function buildStage5IntegratedClosureChecklist(
  input: Stage5IntegratedKnowledgeFoundationClosureDecisionInput,
): Stage5IntegratedKnowledgeFoundationClosureChecklistItem[] {
  return mapChecklist([
    {
      item: "Stage 5-A closure ready",
      satisfied: input.sourceStage5AClosureDecision === "stage5_a_closure_ready",
      detail: `sourceStage5AClosureDecision=${input.sourceStage5AClosureDecision}`,
    },
    {
      item: "Stage 5-B metadata registry candidate ready",
      satisfied: input.sourceStage5BDecision === "ready_for_metadata_registry_design",
      detail: `sourceStage5BDecision=${input.sourceStage5BDecision}`,
    },
    {
      item: "Stage 5-C mapping candidate ready",
      satisfied: input.sourceStage5CDecision === "ready_for_mapping_design",
      detail: `sourceStage5CDecision=${input.sourceStage5CDecision}`,
    },
    {
      item: "Stage 5-D prompt design candidate ready",
      satisfied: input.sourceStage5DDecision === "ready_for_prompt_context_design",
      detail: `sourceStage5DDecision=${input.sourceStage5DDecision}`,
    },
    {
      item: "knowledge foundation only",
      satisfied: true,
      detail: "knowledgeFoundationOnly=true",
    },
    {
      item: "Stage 6 entry candidate only",
      satisfied: true,
      detail: "stage6EntryIsCandidateOnly=true",
    },
  ]);
}

export function buildStage5IntegratedBoundaryChecklist(): Stage5IntegratedKnowledgeFoundationClosureChecklistItem[] {
  return mapChecklist(
    STAGE5_INTEGRATED_BOUNDARY_CHECKLIST_ENTRIES.map((entry) => ({
      item: entry.item,
      satisfied: true,
      detail: entry.detail,
    })),
  );
}

export function appendStage5IntegratedKnowledgeFoundationClosureFindings(input: {
  readonly findings: Stage5IntegratedKnowledgeFoundationClosureFinding[];
  readonly decision: Stage5IntegratedKnowledgeFoundationClosureDecision;
  readonly sources: Stage5IntegratedKnowledgeFoundationClosureDecisionInput;
}): void {
  const { findings, decision, sources } = input;

  findings.push(finding("info", "stage5_integrated_closure_evaluator_created", "Stage 5-F integrated closure evaluator created"));
  findings.push(finding("info", "stage5_integrated_read_only", "Stage 5 integrated closure is read-only"));
  findings.push(finding("info", "stage5_not_knowledge_pack_implementation", "Stage 5 is not knowledge pack implementation"));
  findings.push(finding("info", "stage5_no_rag_indexing", "Stage 5 integrated closure does not allow RAG indexing"));
  findings.push(finding("info", "stage5_no_prompt_injection_wire", "Stage 5 integrated closure does not wire prompt injection"));
  findings.push(finding("info", "stage6_entry_candidate_only", "Stage 6 runtime execution model design is candidate only"));

  if (decision === "blocked") {
    if (sources.sourceStage5AClosureDecision === "blocked") {
      findings.push(finding("blocking", "source_stage5_a_blocked", "Source Stage 5-A closure is blocked"));
    }
    if (sources.sourceStage5BDecision === "blocked") {
      findings.push(finding("blocking", "source_stage5_b_blocked", "Source Stage 5-B decision is blocked"));
    }
    if (sources.sourceStage5CDecision === "blocked") {
      findings.push(finding("blocking", "source_stage5_c_blocked", "Source Stage 5-C decision is blocked"));
    }
    if (sources.sourceStage5DDecision === "blocked") {
      findings.push(finding("blocking", "source_stage5_d_blocked", "Source Stage 5-D decision is blocked"));
    }
    findings.push(finding("blocking", "stage5_integrated_closure_blocked", "Stage 5 integrated closure is blocked"));
    return;
  }

  if (decision === "defer") {
    if (sources.sourceStage5AClosureDecision === "defer") {
      findings.push(finding("warning", "source_stage5_a_deferred", "Source Stage 5-A closure defers"));
    }
    if (sources.sourceStage5BDecision === "defer") {
      findings.push(finding("warning", "source_stage5_b_deferred", "Source Stage 5-B decision defers"));
    }
    if (sources.sourceStage5CDecision === "defer") {
      findings.push(finding("warning", "source_stage5_c_deferred", "Source Stage 5-C decision defers"));
    }
    if (sources.sourceStage5DDecision === "defer") {
      findings.push(finding("warning", "source_stage5_d_deferred", "Source Stage 5-D decision defers"));
    }
    findings.push(finding("warning", "stage5_integrated_closure_deferred", "Stage 5 integrated closure defers"));
    return;
  }

  findings.push(finding("info", "stage5_knowledge_foundation_ready", "Stage 5 knowledge foundation closure is ready"));
}
