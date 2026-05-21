/**
 * Stage 5-A closure support: aggregation, checklists, findings (read-only).
 */

import { listDefaultKnowledgePackIds, listDefaultRoleKnowledgeAgentTypes } from "@/lib/agents/defaultRoleKnowledgeBindings";
import { evaluateRoleKnowledgeBindingReadiness } from "@/lib/agents/evaluateRoleKnowledgeBindingReadiness";
import type {
  RoleKnowledgeBindingClosureAgentSummary,
  RoleKnowledgeBindingClosureChecklistItem,
  RoleKnowledgeBindingClosureDecision,
  RoleKnowledgeBindingClosureDecisionInput,
  RoleKnowledgeBindingClosureFinding,
  RoleKnowledgeBindingClosureInput,
} from "@/lib/agents/roleKnowledgeBindingClosureTypes";

export const STAGE5_A_CLOSURE_VERSION = "stage_5_a_closure_v1" as const;
export const STAGE5_A_CLOSURE_TITLE = "Stage 5-A Role Knowledge Binding Closure Package (Read-Only)";

export const STAGE5_A_CLOSURE_BOUNDARY_REPORT = {
  stage5AClosureIsKnowledgePackImplementation: false as const,
  stage5AClosureUsesRag: false as const,
  stage5AClosureModifiesPromptInjection: false as const,
  stage5AClosureModifiesRuntime: false as const,
  stage5AClosureModifiesDb: false as const,
  stage5AClosureModifiesUi: false as const,
  stage5BEntryCandidate: "knowledge_pack_metadata_registry_candidate" as const,
  stage5BEntryIsCandidateOnly: true as const,
  actualKnowledgePackMetadataRegistryAllowedInThisStep: false as const,
  actualKnowledgePackCrudAllowedInThisStep: false as const,
  actualRagIndexingAllowedInThisStep: false as const,
  actualPromptInjectionAllowedInThisStep: false as const,
} as const;

export const STAGE5_A_CLOSURE_ALWAYS_FINDING_SPECS = [
  { code: "stage5_a_closure_evaluator_created", message: "Stage 5-A closure evaluator created" },
  { code: "stage5_a_closure_read_only", message: "Stage 5-A closure is read-only" },
  { code: "stage5_a_source_readiness_aggregated", message: "Source readiness reports were aggregated" },
  { code: "stage5_a_not_knowledge_pack_implementation", message: "Stage 5-A is not knowledge pack implementation" },
  { code: "stage5_a_no_rag_indexing", message: "Stage 5-A closure does not use RAG indexing" },
  { code: "stage5_a_no_prompt_injection", message: "Stage 5-A closure does not modify prompt injection" },
  { code: "stage5_a_no_runtime_db_ui_change", message: "Stage 5-A closure does not change runtime/DB/UI" },
  {
    code: "stage5_b_metadata_registry_candidate_only",
    message: "Stage 5-B knowledge pack metadata registry is candidate only",
  },
] as const;

export const STAGE5_A_CLOSURE_BOUNDARY_CHECKLIST_ENTRIES = [
  { item: "stage5AClosureIsKnowledgePackImplementation=false", detail: "stage5AClosureIsKnowledgePackImplementation=false" },
  { item: "stage5AClosureUsesRag=false", detail: "stage5AClosureUsesRag=false" },
  { item: "stage5AClosureModifiesPromptInjection=false", detail: "stage5AClosureModifiesPromptInjection=false" },
  { item: "stage5AClosureModifiesRuntime=false", detail: "stage5AClosureModifiesRuntime=false" },
  { item: "stage5AClosureModifiesDb=false", detail: "stage5AClosureModifiesDb=false" },
  { item: "stage5AClosureModifiesUi=false", detail: "stage5AClosureModifiesUi=false" },
  {
    item: "actualKnowledgePackMetadataRegistryAllowedInThisStep=false",
    detail: "actualKnowledgePackMetadataRegistryAllowedInThisStep=false",
  },
  { item: "actualKnowledgePackCrudAllowedInThisStep=false", detail: "actualKnowledgePackCrudAllowedInThisStep=false" },
  { item: "actualRagIndexingAllowedInThisStep=false", detail: "actualRagIndexingAllowedInThisStep=false" },
  { item: "actualPromptInjectionAllowedInThisStep=false", detail: "actualPromptInjectionAllowedInThisStep=false" },
] as const;

export type ParsedRoleKnowledgeBindingClosureInput = {
  readonly agentTypes: readonly string[];
  readonly availableKnowledgePackIds: readonly string[];
  readonly allowMissingOptionalBindings: boolean;
  readonly stage5AClosureReviewConfirmed: boolean;
  readonly stage5ANotKnowledgePackImplementationConfirmed: boolean;
  readonly stage5ANoRagConfirmed: boolean;
  readonly stage5ANoPromptInjectionConfirmed: boolean;
  readonly stage5ANoRuntimeDbUiConfirmed: boolean;
};

export type SourceReadinessSnapshot = {
  readonly agentSummaries: readonly RoleKnowledgeBindingClosureAgentSummary[];
  readonly hasBlocked: boolean;
  readonly hasDefer: boolean;
  readonly allReady: boolean;
  readonly anyUnknown: boolean;
  readonly anyBlankRemoved: boolean;
  readonly anyDuplicateRemoved: boolean;
  readonly anyOptionalMissing: boolean;
};

type ChecklistEntry = {
  readonly item: string;
  readonly satisfied: boolean;
  readonly detail: string;
};

function finding(
  severity: RoleKnowledgeBindingClosureFinding["severity"],
  code: string,
  message: string,
): RoleKnowledgeBindingClosureFinding {
  return { severity, code, message };
}

function mapChecklistEntries(entries: readonly ChecklistEntry[]): RoleKnowledgeBindingClosureChecklistItem[] {
  return entries.map((entry) => ({
    item: entry.item,
    satisfied: entry.satisfied,
    reason: `${entry.item}: ${entry.satisfied ? "satisfied" : "not satisfied"} — ${entry.detail}`,
  }));
}

export function parseRoleKnowledgeBindingClosureInput(
  input?: RoleKnowledgeBindingClosureInput,
): ParsedRoleKnowledgeBindingClosureInput {
  const agentTypes =
    input?.agentTypes === undefined
      ? listDefaultRoleKnowledgeAgentTypes()
      : [...input.agentTypes].map((t) => t.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b));

  return {
    agentTypes,
    availableKnowledgePackIds:
      input?.availableKnowledgePackIds === undefined
        ? listDefaultKnowledgePackIds()
        : input.availableKnowledgePackIds,
    allowMissingOptionalBindings: input?.allowMissingOptionalBindings !== false,
    stage5AClosureReviewConfirmed: input?.stage5AClosureReviewConfirmed === true,
    stage5ANotKnowledgePackImplementationConfirmed: input?.stage5ANotKnowledgePackImplementationConfirmed === true,
    stage5ANoRagConfirmed: input?.stage5ANoRagConfirmed === true,
    stage5ANoPromptInjectionConfirmed: input?.stage5ANoPromptInjectionConfirmed === true,
    stage5ANoRuntimeDbUiConfirmed: input?.stage5ANoRuntimeDbUiConfirmed === true,
  };
}

function toAgentSummary(
  agentType: string,
  report: ReturnType<typeof evaluateRoleKnowledgeBindingReadiness>,
): RoleKnowledgeBindingClosureAgentSummary {
  return {
    agentType,
    decision: report.decision,
    bindingCount: report.bindingCount,
    requiredBindingCount: report.requiredBindingCount,
    satisfiedRequiredBindingCount: report.satisfiedRequiredBindingCount,
    optionalBindingCount: report.optionalBindingCount,
    satisfiedOptionalBindingCount: report.satisfiedOptionalBindingCount,
    missingRequiredBindingIds: report.missingRequiredBindingIds,
    missingOptionalBindingIds: report.missingOptionalBindingIds,
    unknownAvailableKnowledgePackIds: report.unknownAvailableKnowledgePackIds,
    normalizedAvailableKnowledgePackIdCount: report.normalizedAvailableKnowledgePackIdCount,
  };
}

/** Aggregate per-agent readiness into a closure snapshot. */
export function buildSourceReadinessSnapshot(input: {
  readonly agentTypes: readonly string[];
  readonly availableKnowledgePackIds: readonly string[];
  readonly allowMissingOptionalBindings: boolean;
}): SourceReadinessSnapshot {
  const reports = input.agentTypes.map((agentType) =>
    evaluateRoleKnowledgeBindingReadiness({
      agentType,
      taskType: "stage5_a_closure_aggregate",
      availableKnowledgePackIds: input.availableKnowledgePackIds,
      allowMissingOptionalBindings: input.allowMissingOptionalBindings,
    }),
  );

  const agentSummaries = input.agentTypes.map((agentType, index) => toAgentSummary(agentType, reports[index]!));

  return {
    agentSummaries,
    hasBlocked: agentSummaries.some((s) => s.decision === "blocked"),
    hasDefer: agentSummaries.some((s) => s.decision === "defer"),
    allReady: agentSummaries.every((s) => s.decision === "knowledge_binding_ready"),
    anyUnknown: agentSummaries.some((s) => s.unknownAvailableKnowledgePackIds.length > 0),
    anyBlankRemoved: reports.some((r) => r.blankAvailableKnowledgePackIdsRemovedCount > 0),
    anyDuplicateRemoved: reports.some((r) => r.duplicateAvailableKnowledgePackIdsRemoved.length > 0),
    anyOptionalMissing: agentSummaries.some((s) => s.missingOptionalBindingIds.length > 0),
  };
}

export function countAgentsByDecision(
  summaries: readonly RoleKnowledgeBindingClosureAgentSummary[],
  decision: RoleKnowledgeBindingClosureAgentSummary["decision"],
): number {
  return summaries.filter((s) => s.decision === decision).length;
}

export function sumAgentField(
  summaries: readonly RoleKnowledgeBindingClosureAgentSummary[],
  pick: (s: RoleKnowledgeBindingClosureAgentSummary) => number,
): number {
  return summaries.reduce((total, summary) => total + pick(summary), 0);
}

/** Pure decision helper for Stage 5-A closure package. */
export function resolveRoleKnowledgeBindingClosureDecision(
  input: RoleKnowledgeBindingClosureDecisionInput,
): RoleKnowledgeBindingClosureDecision {
  if (input.hasBlocked) {
    return "blocked";
  }

  if (input.hasDefer) {
    return "defer";
  }

  const confirmationsSatisfied =
    input.stage5AClosureReviewConfirmed &&
    input.stage5ANotKnowledgePackImplementationConfirmed &&
    input.stage5ANoRagConfirmed &&
    input.stage5ANoPromptInjectionConfirmed &&
    input.stage5ANoRuntimeDbUiConfirmed;

  if (!confirmationsSatisfied || !input.allReady) {
    return "defer";
  }

  return "stage5_a_closure_ready";
}

/** Deterministic Stage 5-A closure fingerprint. */
export function buildRoleKnowledgeBindingClosureFingerprint(input: {
  readonly agentSummaries: readonly RoleKnowledgeBindingClosureAgentSummary[];
  readonly sourceDefaultKnowledgePackIdCount: number;
  readonly stage5AClosureReviewConfirmed: boolean;
  readonly stage5ANotKnowledgePackImplementationConfirmed: boolean;
  readonly stage5ANoRagConfirmed: boolean;
  readonly stage5ANoPromptInjectionConfirmed: boolean;
  readonly stage5ANoRuntimeDbUiConfirmed: boolean;
}): string {
  const summaryParts = input.agentSummaries.map(
    (s) =>
      `${s.agentType}:${s.decision}:${s.satisfiedRequiredBindingCount}/${s.requiredBindingCount}:${s.satisfiedOptionalBindingCount}/${s.optionalBindingCount}`,
  );

  return [
    "stage5-a-closure-v1",
    `agents-${summaryParts.join("|")}`,
    `default-packs-${input.sourceDefaultKnowledgePackIdCount}`,
    `review-${input.stage5AClosureReviewConfirmed}`,
    `not-impl-${input.stage5ANotKnowledgePackImplementationConfirmed}`,
    `no-rag-${input.stage5ANoRagConfirmed}`,
    `no-prompt-${input.stage5ANoPromptInjectionConfirmed}`,
    `no-runtime-db-ui-${input.stage5ANoRuntimeDbUiConfirmed}`,
  ].join(":");
}

export function buildClosureSummary(decision: RoleKnowledgeBindingClosureDecision): string {
  if (decision === "blocked") {
    return "Stage 5-A role knowledge binding closure is blocked due to source readiness or unknown agent.";
  }

  if (decision === "defer") {
    return "Stage 5-A role knowledge binding closure defers; source readiness or closure confirmations are incomplete.";
  }

  return "Stage 5-A role knowledge binding foundation meets aggregate closure criteria. This is not Stage 5-B implementation permission.";
}

export function buildRoleKnowledgeBindingClosureChecklist(input: {
  readonly snapshot: SourceReadinessSnapshot;
  readonly allRequiredBindingsSatisfied: boolean;
  readonly parsed: ParsedRoleKnowledgeBindingClosureInput;
}): RoleKnowledgeBindingClosureChecklistItem[] {
  return mapChecklistEntries([
    {
      item: "all source agent readiness not blocked",
      satisfied: !input.snapshot.hasBlocked,
      detail: `blockedAgentCount=${countAgentsByDecision(input.snapshot.agentSummaries, "blocked")}`,
    },
    {
      item: "all source agent readiness ready",
      satisfied: input.snapshot.allReady,
      detail: `readyAgentCount=${countAgentsByDecision(input.snapshot.agentSummaries, "knowledge_binding_ready")}`,
    },
    {
      item: "all required bindings satisfied",
      satisfied: input.allRequiredBindingsSatisfied,
      detail: `allRequiredBindingsSatisfied=${input.allRequiredBindingsSatisfied}`,
    },
    {
      item: "closure review confirmed",
      satisfied: input.parsed.stage5AClosureReviewConfirmed,
      detail: `stage5AClosureReviewConfirmed=${input.parsed.stage5AClosureReviewConfirmed}`,
    },
    {
      item: "not knowledge pack implementation confirmed",
      satisfied: input.parsed.stage5ANotKnowledgePackImplementationConfirmed,
      detail: `stage5ANotKnowledgePackImplementationConfirmed=${input.parsed.stage5ANotKnowledgePackImplementationConfirmed}`,
    },
    {
      item: "no RAG confirmed",
      satisfied: input.parsed.stage5ANoRagConfirmed,
      detail: `stage5ANoRagConfirmed=${input.parsed.stage5ANoRagConfirmed}`,
    },
    {
      item: "no prompt injection confirmed",
      satisfied: input.parsed.stage5ANoPromptInjectionConfirmed,
      detail: `stage5ANoPromptInjectionConfirmed=${input.parsed.stage5ANoPromptInjectionConfirmed}`,
    },
    {
      item: "no runtime/DB/UI confirmed",
      satisfied: input.parsed.stage5ANoRuntimeDbUiConfirmed,
      detail: `stage5ANoRuntimeDbUiConfirmed=${input.parsed.stage5ANoRuntimeDbUiConfirmed}`,
    },
    {
      item: "stage5B entry candidate only",
      satisfied: true,
      detail: "stage5BEntryIsCandidateOnly=true",
    },
  ]);
}

export function buildRoleKnowledgeBindingClosureBoundaryChecklist(): RoleKnowledgeBindingClosureChecklistItem[] {
  return mapChecklistEntries(
    STAGE5_A_CLOSURE_BOUNDARY_CHECKLIST_ENTRIES.map((entry) => ({
      item: entry.item,
      satisfied: true,
      detail: entry.detail,
    })),
  );
}

export function appendRoleKnowledgeBindingClosureFindings(input: {
  readonly findings: RoleKnowledgeBindingClosureFinding[];
  readonly decision: RoleKnowledgeBindingClosureDecision;
  readonly snapshot: SourceReadinessSnapshot;
  readonly parsed: ParsedRoleKnowledgeBindingClosureInput;
}): void {
  const { findings, decision, snapshot, parsed } = input;

  for (const spec of STAGE5_A_CLOSURE_ALWAYS_FINDING_SPECS) {
    findings.push(finding("info", spec.code, spec.message));
  }

  if (snapshot.hasBlocked) {
    findings.push(
      finding("blocking", "source_agent_readiness_blocked", "One or more source agent readiness reports are blocked"),
    );
    findings.push(finding("blocking", "stage5_a_closure_blocked", "Stage 5-A closure is blocked"));
    return;
  }

  if (decision === "defer") {
    if (snapshot.hasDefer) {
      findings.push(
        finding("warning", "source_agent_readiness_deferred", "One or more source agent readiness reports defer"),
      );
    }
    if (snapshot.anyUnknown) {
      findings.push(
        finding(
          "warning",
          "source_unknown_knowledge_pack_id_reported",
          "Unknown knowledge pack IDs were reported in source readiness",
        ),
      );
    }
    if (snapshot.anyOptionalMissing) {
      findings.push(
        finding(
          "warning",
          "source_optional_knowledge_pack_missing",
          "Optional knowledge packs are missing in source readiness",
        ),
      );
    }
    if (!parsed.stage5AClosureReviewConfirmed) {
      findings.push(
        finding("warning", "closure_confirmation_missing", "Stage 5-A closure review confirmation is missing"),
      );
    }
    if (!parsed.stage5ANotKnowledgePackImplementationConfirmed) {
      findings.push(finding("warning", "closure_confirmation_missing", "Not-implementation confirmation is missing"));
    }
    if (!parsed.stage5ANoRagConfirmed) {
      findings.push(finding("warning", "closure_confirmation_missing", "No-RAG confirmation is missing"));
    }
    if (!parsed.stage5ANoPromptInjectionConfirmed) {
      findings.push(finding("warning", "closure_confirmation_missing", "No-prompt-injection confirmation is missing"));
    }
    if (!parsed.stage5ANoRuntimeDbUiConfirmed) {
      findings.push(finding("warning", "closure_confirmation_missing", "No-runtime/DB/UI confirmation is missing"));
    }
    findings.push(finding("warning", "stage5_a_closure_deferred", "Stage 5-A closure defers"));
    return;
  }

  if (snapshot.anyUnknown) {
    findings.push(
      finding(
        "warning",
        "source_unknown_knowledge_pack_id_reported",
        "Unknown knowledge pack IDs were reported in source readiness",
      ),
    );
  }
  if (snapshot.anyOptionalMissing) {
    findings.push(
      finding(
        "warning",
        "source_optional_knowledge_pack_missing",
        "Optional knowledge packs are missing in source readiness",
      ),
    );
  }
  findings.push(finding("info", "stage5_a_closure_ready", "Stage 5-A closure is ready"));
}
