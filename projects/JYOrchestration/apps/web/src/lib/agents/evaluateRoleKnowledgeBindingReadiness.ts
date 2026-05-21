/**
 * Stage 5-A entry candidate evaluator: binding readiness report only (read-only foundation).
 * Primary milestone context is Stage 2~4 closure + Stage 5 entry candidate definition.
 * Out of scope: RAG, knowledge-pack UI, prompt injection, runtime wire, DB/schema/migration.
 */

import {
  getDefaultRoleKnowledgeBindingsForAgent,
  listDefaultKnowledgePackIds,
} from "@/lib/agents/defaultRoleKnowledgeBindings";
import {
  STAGE5_A_BOUNDARY_CHECKLIST_ENTRIES,
  STAGE5_A_BOUNDARY_FINDING_SPECS,
  STAGE5_A_BOUNDARY_REPORT,
} from "@/lib/agents/multiAgentOrchestrationMvpBaseline";
import type {
  RoleKnowledgeBindingChecklistItem,
  RoleKnowledgeBindingFinding,
  RoleKnowledgeBindingReadinessInput,
  RoleKnowledgeBindingReadinessReport,
  RoleKnowledgeBindingDecision,
  RoleKnowledgePackBinding,
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

function sortedIds(ids: readonly string[]): readonly string[] {
  return [...ids].sort((a, b) => a.localeCompare(b));
}

/** Trim, drop blanks, dedupe, and sort available knowledge pack IDs (no input mutation). */
export function normalizeAvailableKnowledgePackIds(inputIds: readonly string[]): {
  readonly inputCount: number;
  readonly normalizedIds: readonly string[];
  readonly duplicatesRemoved: readonly string[];
  readonly blankRemovedCount: number;
} {
  const inputCount = inputIds.length;
  let blankRemovedCount = 0;
  const occurrenceCount = new Map<string, number>();
  const firstSeenOrder: string[] = [];

  for (const raw of inputIds) {
    const trimmed = raw.trim();
    if (!trimmed) {
      blankRemovedCount += 1;
      continue;
    }

    const count = (occurrenceCount.get(trimmed) ?? 0) + 1;
    occurrenceCount.set(trimmed, count);
    if (count === 1) {
      firstSeenOrder.push(trimmed);
    }
  }

  const duplicatesRemoved = sortedIds(
    [...occurrenceCount.entries()].filter(([, count]) => count > 1).map(([id]) => id),
  );

  return {
    inputCount,
    normalizedIds: sortedIds(firstSeenOrder),
    duplicatesRemoved,
    blankRemovedCount,
  };
}

/** IDs present in normalized input but not in the default knowledge pack registry. */
export function findUnknownKnowledgePackIds(input: {
  readonly normalizedAvailableKnowledgePackIds: readonly string[];
  readonly defaultKnowledgePackIds: readonly string[];
}): readonly string[] {
  const defaultSet = new Set(input.defaultKnowledgePackIds);
  return sortedIds(input.normalizedAvailableKnowledgePackIds.filter((id) => !defaultSet.has(id)));
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
  readonly bindings: readonly RoleKnowledgePackBinding[];
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

function buildInputHygieneChecklist(input: {
  readonly availableKnowledgePackIdsInputCount: number;
  readonly normalizedAvailableKnowledgePackIdCount: number;
  readonly duplicateAvailableKnowledgePackIdsRemoved: readonly string[];
  readonly blankAvailableKnowledgePackIdsRemovedCount: number;
  readonly unknownAvailableKnowledgePackIds: readonly string[];
  readonly sourceDefaultKnowledgePackIdCount: number;
}): RoleKnowledgeBindingChecklistItem[] {
  return mapChecklistEntries([
    {
      item: "available knowledge pack ids normalized",
      satisfied: true,
      detail: `inputCount=${input.availableKnowledgePackIdsInputCount}; normalizedCount=${input.normalizedAvailableKnowledgePackIdCount}`,
    },
    {
      item: "blank available knowledge pack ids removed",
      satisfied: input.blankAvailableKnowledgePackIdsRemovedCount === 0,
      detail: `blankRemovedCount=${input.blankAvailableKnowledgePackIdsRemovedCount}`,
    },
    {
      item: "duplicate available knowledge pack ids deduped",
      satisfied: true,
      detail:
        input.duplicateAvailableKnowledgePackIdsRemoved.length > 0
          ? `duplicatesRemoved=${input.duplicateAvailableKnowledgePackIdsRemoved.join(",")}`
          : "no duplicates removed",
    },
    {
      item: "unknown available knowledge pack ids reported",
      satisfied: input.unknownAvailableKnowledgePackIds.length === 0,
      detail:
        input.unknownAvailableKnowledgePackIds.length > 0
          ? `unknown=${input.unknownAvailableKnowledgePackIds.join(",")}`
          : "no unknown ids",
    },
    {
      item: "source default knowledge pack registry referenced",
      satisfied: true,
      detail: `sourceDefaultKnowledgePackIdCount=${input.sourceDefaultKnowledgePackIdCount}`,
    },
  ]);
}

function appendStage5ABoundaryFindings(findings: RoleKnowledgeBindingFinding[]): void {
  for (const spec of STAGE5_A_BOUNDARY_FINDING_SPECS) {
    findings.push(finding("info", spec.code, spec.message));
  }
}

function appendInputHygieneFindings(input: {
  readonly findings: RoleKnowledgeBindingFinding[];
  readonly normalized: ReturnType<typeof normalizeAvailableKnowledgePackIds>;
  readonly unknownAvailableKnowledgePackIds: readonly string[];
  readonly missingOptionalBindingIds: readonly string[];
  readonly sourceDefaultKnowledgePackIdCount: number;
}): void {
  const { findings, normalized, unknownAvailableKnowledgePackIds, missingOptionalBindingIds } = input;

  findings.push(
    finding("info", "available_knowledge_pack_ids_normalized", "Available knowledge pack IDs were normalized"),
  );
  findings.push(
    finding(
      "info",
      "source_default_knowledge_pack_registry_referenced",
      `Default knowledge pack registry referenced (${input.sourceDefaultKnowledgePackIdCount} ids)`,
    ),
  );

  if (normalized.blankRemovedCount > 0) {
    findings.push(
      finding(
        "warning",
        "blank_available_knowledge_pack_id_removed",
        `Removed ${normalized.blankRemovedCount} blank available knowledge pack id(s)`,
      ),
    );
  }

  if (normalized.duplicatesRemoved.length > 0) {
    findings.push(
      finding(
        "info",
        "duplicate_available_knowledge_pack_id_removed",
        `Removed duplicate available knowledge pack ids: ${normalized.duplicatesRemoved.join(", ")}`,
      ),
    );
  }

  if (unknownAvailableKnowledgePackIds.length > 0) {
    findings.push(
      finding(
        "warning",
        "unknown_available_knowledge_pack_id_reported",
        `Unknown available knowledge pack ids: ${unknownAvailableKnowledgePackIds.join(", ")}`,
      ),
    );
  }

  if (missingOptionalBindingIds.length > 0) {
    findings.push(
      finding(
        "warning",
        "missing_optional_knowledge_pack_reported",
        `Missing optional knowledge pack ids: ${missingOptionalBindingIds.join(", ")}`,
      ),
    );
  }
}

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
    ...STAGE5_A_BOUNDARY_CHECKLIST_ENTRIES.map((entry) => ({
      item: entry.item,
      satisfied: true,
      detail: entry.detail,
    })),
  ]);
}

function appendKnowledgeBindingDecisionFindings(input: {
  readonly findings: RoleKnowledgeBindingFinding[];
  readonly decision: RoleKnowledgeBindingDecision;
  readonly agentType: string;
  readonly missingRequiredBindingIds: readonly string[];
  readonly missingOptionalBindingIds: readonly string[];
}): void {
  const { findings, decision, agentType } = input;

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
  const normalized = normalizeAvailableKnowledgePackIds(parsed.availableKnowledgePackIds);
  const availableSet = new Set(normalized.normalizedIds);
  const sourceDefaultKnowledgePackIds = sortedIds(listDefaultKnowledgePackIds());
  const unknownAvailableKnowledgePackIds = findUnknownKnowledgePackIds({
    normalizedAvailableKnowledgePackIds: normalized.normalizedIds,
    defaultKnowledgePackIds: sourceDefaultKnowledgePackIds,
  });

  const bindings = getDefaultRoleKnowledgeBindingsForAgent(parsed.agentType);
  const requiredBindings = bindings.filter((b) => b.required);
  const optionalBindings = bindings.filter((b) => !b.required);

  const missingRequiredBindingIds = requiredBindings
    .filter((b) => !availableSet.has(b.knowledgePackId))
    .map((b) => b.knowledgePackId);
  const missingOptionalBindingIds = optionalBindings
    .filter((b) => !availableSet.has(b.knowledgePackId))
    .map((b) => b.knowledgePackId);

  const satisfiedRequiredBindingCount = requiredBindings.length - missingRequiredBindingIds.length;
  const satisfiedOptionalBindingCount = optionalBindings.length - missingOptionalBindingIds.length;

  const decision = resolveKnowledgeBindingDecision({
    agentType: parsed.agentType,
    bindings,
    missingRequiredBindingIds,
    missingOptionalBindingIds,
    allowMissingOptionalBindings: parsed.allowMissingOptionalBindings,
  });

  const inputHygieneChecklist = buildInputHygieneChecklist({
    availableKnowledgePackIdsInputCount: normalized.inputCount,
    normalizedAvailableKnowledgePackIdCount: normalized.normalizedIds.length,
    duplicateAvailableKnowledgePackIdsRemoved: normalized.duplicatesRemoved,
    blankAvailableKnowledgePackIdsRemovedCount: normalized.blankRemovedCount,
    unknownAvailableKnowledgePackIds,
    sourceDefaultKnowledgePackIdCount: sourceDefaultKnowledgePackIds.length,
  });

  const findings: RoleKnowledgeBindingFinding[] = [];
  appendStage5ABoundaryFindings(findings);
  appendInputHygieneFindings({
    findings,
    normalized,
    unknownAvailableKnowledgePackIds,
    missingOptionalBindingIds,
    sourceDefaultKnowledgePackIdCount: sourceDefaultKnowledgePackIds.length,
  });
  appendKnowledgeBindingDecisionFindings({
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
    missingOptionalBindingIds,
    optionalBindingCount: optionalBindings.length,
    satisfiedOptionalBindingCount,
    availableKnowledgePackIdsInputCount: normalized.inputCount,
    normalizedAvailableKnowledgePackIds: normalized.normalizedIds,
    normalizedAvailableKnowledgePackIdCount: normalized.normalizedIds.length,
    duplicateAvailableKnowledgePackIdsRemoved: normalized.duplicatesRemoved,
    blankAvailableKnowledgePackIdsRemovedCount: normalized.blankRemovedCount,
    unknownAvailableKnowledgePackIds,
    unknownAvailableKnowledgePackIdCount: unknownAvailableKnowledgePackIds.length,
    sourceDefaultKnowledgePackIds,
    sourceDefaultKnowledgePackIdCount: sourceDefaultKnowledgePackIds.length,
    inputHygieneChecklist,
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
