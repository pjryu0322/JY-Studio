/**
 * Stage 5-A entry candidate evaluator: binding readiness report only (read-only foundation).
 * Primary milestone context is Stage 2~4 closure + Stage 5 entry candidate definition.
 * Out of scope: RAG, knowledge-pack UI, prompt injection, runtime wire, DB/schema/migration.
 */

import {
  getDefaultRoleKnowledgeBindingsForAgent,
  listDefaultKnowledgePackIds,
} from "@/lib/agents/defaultRoleKnowledgeBindings";
import type {
  RoleKnowledgeBindingChecklistItem,
  RoleKnowledgeBindingFinding,
  RoleKnowledgeBindingReadinessInput,
  RoleKnowledgeBindingReadinessReport,
  RoleKnowledgeBindingDecision,
} from "@/lib/agents/roleKnowledgeBindingTypes";

type ChecklistEntry = {
  readonly item: string;
  readonly satisfied: boolean;
  readonly detail: string;
};

function finding(
  severity: RoleKnowledgeBindingFinding["severity"],
  code: string,
  message: string,
): RoleKnowledgeBindingFinding {
  return { severity, code, message };
}

function checklistReason(input: ChecklistEntry): string {
  return `${input.item}: ${input.satisfied ? "satisfied" : "not satisfied"} — ${input.detail}`;
}

function mapChecklistEntries(entries: readonly ChecklistEntry[]): RoleKnowledgeBindingChecklistItem[] {
  return entries.map((entry) => ({
    item: entry.item,
    satisfied: entry.satisfied,
    reason: checklistReason(entry),
  }));
}

function parseReadinessInput(input?: RoleKnowledgeBindingReadinessInput) {
  return {
    agentType: input?.agentType?.trim() ?? "",
    taskType: input?.taskType?.trim() || "unknown_task",
    projectId: input?.projectId?.trim() ?? "",
    availableKnowledgePackIds: input?.availableKnowledgePackIds ?? [],
    allowMissingOptionalBindings: input?.allowMissingOptionalBindings !== false,
  };
}

function resolveKnowledgeBindingDecision(input: {
  readonly agentType: string;
  readonly bindings: readonly import("@/lib/agents/roleKnowledgeBindingTypes").RoleKnowledgePackBinding[];
  readonly missingRequiredBindingIds: readonly string[];
  readonly missingOptionalBindingIds: readonly string[];
  readonly allowMissingOptionalBindings: boolean;
}): RoleKnowledgeBindingDecision {
  if (!input.agentType) {
    return "blocked";
  }

  if (input.bindings.length === 0) {
    return "blocked";
  }

  if (input.missingRequiredBindingIds.length > 0) {
    return "defer";
  }

  if (input.missingOptionalBindingIds.length > 0 && !input.allowMissingOptionalBindings) {
    return "defer";
  }

  return "knowledge_binding_ready";
}

const STAGE5_A_BOUNDARY_REPORT = {
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

function buildReadinessChecklist(input: {
  readonly agentType: string;
  readonly taskType: string;
  readonly requiredBindingCount: number;
  readonly satisfiedRequiredBindingCount: number;
  readonly missingRequiredBindingIds: readonly string[];
  readonly allowMissingOptionalBindings: boolean;
}): RoleKnowledgeBindingChecklistItem[] {
  return mapChecklistEntries([
    {
      item: "agentType provided",
      satisfied: input.agentType.length > 0,
      detail: `agentType=${input.agentType || "(missing)"}`,
    },
    {
      item: "taskType provided",
      satisfied: input.taskType !== "unknown_task",
      detail: `taskType=${input.taskType}`,
    },
    {
      item: "required bindings satisfied",
      satisfied: input.missingRequiredBindingIds.length === 0,
      detail: `satisfiedRequiredBindingCount=${input.satisfiedRequiredBindingCount}/${input.requiredBindingCount}`,
    },
    {
      item: "allowMissingOptionalBindings policy",
      satisfied: input.allowMissingOptionalBindings || input.missingRequiredBindingIds.length === 0,
      detail: `allowMissingOptionalBindings=${input.allowMissingOptionalBindings}`,
    },
    { item: "stage5-a foundation only", satisfied: true, detail: "stage5CandidateFoundationOnly=true" },
    {
      item: "knowledge pack implementation not started",
      satisfied: true,
      detail: "stage5AIsKnowledgePackImplementation=false",
    },
    {
      item: "role-to-knowledge-pack-id readiness only",
      satisfied: true,
      detail: "mvpBaselineBindingRole=role_to_knowledge_pack_id_readiness_only",
    },
    { item: "RAG indexing not used", satisfied: true, detail: "indexesKnowledgePackInThisStep=false" },
    { item: "embedding not used", satisfied: true, detail: "embedsKnowledgePackInThisStep=false" },
    { item: "prompt injection not modified", satisfied: true, detail: "injectsKnowledgeIntoPromptInThisStep=false" },
    { item: "runtime execution not modified", satisfied: true, detail: "modifiesRuntimeExecutionInThisStep=false" },
    { item: "DB not modified", satisfied: true, detail: "modifiesDbInThisStep=false" },
    { item: "UI not modified", satisfied: true, detail: "modifiesUiInThisStep=false" },
  ]);
}

function appendKnowledgeBindingFindings(input: {
  readonly findings: RoleKnowledgeBindingFinding[];
  readonly decision: RoleKnowledgeBindingDecision;
  readonly agentType: string;
  readonly missingRequiredBindingIds: readonly string[];
  readonly missingOptionalBindingIds: readonly string[];
}): void {
  const { findings, decision, agentType } = input;

  findings.push(finding("info", "stage5_a_foundation_only", "Stage 5-A is foundation only"));
  findings.push(
    finding(
      "info",
      "stage5_a_not_knowledge_pack_implementation",
      "Stage 5-A is not knowledge pack management implementation",
    ),
  );
  findings.push(finding("info", "stage5_a_registry_read_only", "Role knowledge binding registry is read-only"));
  findings.push(finding("info", "stage5_a_no_rag_indexing", "RAG indexing is not used in Stage 5-A"));
  findings.push(finding("info", "stage5_a_no_embedding", "Embedding is not used in Stage 5-A"));
  findings.push(finding("info", "stage5_a_no_prompt_injection", "Prompt injection is not modified in Stage 5-A"));
  findings.push(
    finding("info", "stage5_a_no_runtime_execution_change", "Runtime execution is not modified in Stage 5-A"),
  );
  findings.push(finding("info", "stage5_a_no_db_change", "DB is not modified in Stage 5-A"));
  findings.push(finding("info", "stage5_a_no_ui_change", "UI is not modified in Stage 5-A"));
  findings.push(
    finding(
      "info",
      "mvp_role_knowledge_binding_baseline_preserved",
      "MVP role knowledge binding baseline is role-to-knowledge-pack-id readiness only",
    ),
  );
  findings.push(
    finding(
      "info",
      "stage5_a_candidate_foundation_only",
      "Stage 5-A is a Stage 5 entry candidate at read-only foundation level; not full knowledge pack implementation",
    ),
  );
  findings.push(
    finding("info", "role_knowledge_binding_read_only", "Role knowledge binding readiness is read-only"),
  );
  findings.push(finding("info", "rag_not_used_in_stage_5_a", "RAG is not used in Stage 5-A"));
  findings.push(
    finding("info", "prompt_injection_not_modified_in_stage_5_a", "Prompt injection is not modified in Stage 5-A"),
  );
  findings.push(
    finding("info", "runtime_wire_not_modified_in_stage_5_a", "Runtime wire is not modified in Stage 5-A"),
  );
  findings.push(
    finding("info", "db_schema_migration_not_modified_in_stage_5_a", "DB/schema/migration is not modified in Stage 5-A"),
  );
  findings.push(
    finding(
      "info",
      "knowledge_pack_ui_not_implemented_in_stage_5_a",
      "Knowledge pack management UI is not implemented in Stage 5-A",
    ),
  );

  if (!agentType) {
    findings.push(finding("blocking", "agent_type_missing", "Agent type is missing"));
    findings.push(finding("blocking", "role_knowledge_binding_blocked", "Role knowledge binding is blocked"));
    return;
  }

  if (decision === "blocked") {
    findings.push(
      finding("blocking", "role_knowledge_binding_agent_unknown", `No default bindings for agentType=${agentType}`),
    );
    findings.push(finding("blocking", "role_knowledge_binding_blocked", "Role knowledge binding is blocked"));
    return;
  }

  if (decision === "defer") {
    if (input.missingRequiredBindingIds.length > 0) {
      findings.push(finding("warning", "required_knowledge_pack_missing", "Required knowledge packs are missing"));
    }
    if (input.missingOptionalBindingIds.length > 0) {
      findings.push(finding("warning", "optional_knowledge_pack_missing", "Optional knowledge packs are missing"));
    }
    findings.push(finding("warning", "role_knowledge_binding_deferred", "Role knowledge binding defers"));
    return;
  }

  if (input.missingOptionalBindingIds.length > 0) {
    findings.push(finding("warning", "optional_knowledge_pack_missing", "Optional knowledge packs are missing"));
  }
  findings.push(finding("info", "role_knowledge_binding_ready", "Role knowledge binding is ready"));
}

/** Read-only role knowledge binding readiness — does not use RAG or modify prompts. */
export function evaluateRoleKnowledgeBindingReadiness(
  input?: RoleKnowledgeBindingReadinessInput,
): RoleKnowledgeBindingReadinessReport {
  const parsed = parseReadinessInput(input);
  const bindings = getDefaultRoleKnowledgeBindingsForAgent(parsed.agentType);
  const availableSet = new Set(parsed.availableKnowledgePackIds);

  const requiredBindings = bindings.filter((b) => b.required);
  const optionalBindings = bindings.filter((b) => !b.required);

  const missingRequiredBindingIds = requiredBindings
    .filter((b) => !availableSet.has(b.knowledgePackId))
    .map((b) => b.knowledgePackId);
  const missingOptionalBindingIds = optionalBindings
    .filter((b) => !availableSet.has(b.knowledgePackId))
    .map((b) => b.knowledgePackId);

  const satisfiedRequiredBindingCount = requiredBindings.length - missingRequiredBindingIds.length;

  const decision = resolveKnowledgeBindingDecision({
    agentType: parsed.agentType,
    bindings,
    missingRequiredBindingIds,
    missingOptionalBindingIds,
    allowMissingOptionalBindings: parsed.allowMissingOptionalBindings,
  });

  const findings: RoleKnowledgeBindingFinding[] = [];
  appendKnowledgeBindingFindings({
    findings,
    decision,
    agentType: parsed.agentType,
    missingRequiredBindingIds,
    missingOptionalBindingIds,
  });

  return {
    mode: "read_only_role_knowledge_binding_readiness",
    stage: "stage_5_a",
    decision,
    agentType: parsed.agentType,
    taskType: parsed.taskType,
    bindingCount: bindings.length,
    requiredBindingCount: requiredBindings.length,
    satisfiedRequiredBindingCount,
    missingRequiredBindingIds,
    selectedBindings: bindings,
    checklist: buildReadinessChecklist({
      agentType: parsed.agentType,
      taskType: parsed.taskType,
      requiredBindingCount: requiredBindings.length,
      satisfiedRequiredBindingCount,
      missingRequiredBindingIds,
      allowMissingOptionalBindings: parsed.allowMissingOptionalBindings,
    }),
    findings,
    ...STAGE5_A_BOUNDARY_REPORT,
  };
}

/** All default platform knowledge pack IDs (for tests and bootstrap). */
export { listDefaultKnowledgePackIds };
