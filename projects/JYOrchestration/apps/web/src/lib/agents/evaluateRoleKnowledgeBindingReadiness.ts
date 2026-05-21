/**
 * Stage 5-A entry candidate evaluator: binding readiness report only (read-only foundation).
 * Primary milestone context is Stage 2~4 closure + Stage 5 entry candidate definition.
 * Out of scope: RAG, knowledge-pack UI, prompt injection, runtime wire, DB/schema/migration.
 */

import { getDefaultRoleKnowledgeBindingsForAgent } from "@/lib/agents/defaultRoleKnowledgeBindings";
import {
  STAGE5_A_BOUNDARY_CHECKLIST_ENTRIES,
  STAGE5_A_BOUNDARY_FINDING_SPECS,
  STAGE5_A_BOUNDARY_REPORT,
} from "@/lib/agents/multiAgentOrchestrationMvpBaseline";
import {
  appendRoleKnowledgeBindingInputHygieneFindings,
  buildRoleKnowledgeBindingInputHygieneChecklist,
  findUnknownKnowledgePackIds,
  normalizeAvailableKnowledgePackIds,
  sortedDefaultKnowledgePackIds,
} from "@/lib/agents/roleKnowledgeBindingInputHygiene";
import type {
  RoleKnowledgeBindingChecklistItem,
  RoleKnowledgeBindingFinding,
  RoleKnowledgeBindingReadinessInput,
  RoleKnowledgeBindingReadinessReport,
  RoleKnowledgeBindingDecision,
  RoleKnowledgePackBinding,
} from "@/lib/agents/roleKnowledgeBindingTypes";

export {
  findUnknownKnowledgePackIds,
  normalizeAvailableKnowledgePackIds,
  sortedKnowledgePackIds,
} from "@/lib/agents/roleKnowledgeBindingInputHygiene";

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

function resolveBindingGapContext(agentType: string, availableKnowledgePackIds: readonly string[]) {
  const normalized = normalizeAvailableKnowledgePackIds(availableKnowledgePackIds);
  const availableSet = new Set(normalized.normalizedIds);
  const sourceDefaultKnowledgePackIds = sortedDefaultKnowledgePackIds();
  const unknownAvailableKnowledgePackIds = findUnknownKnowledgePackIds({
    normalizedAvailableKnowledgePackIds: normalized.normalizedIds,
    defaultKnowledgePackIds: sourceDefaultKnowledgePackIds,
  });

  const bindings = getDefaultRoleKnowledgeBindingsForAgent(agentType);
  const requiredBindings = bindings.filter((b) => b.required);
  const optionalBindings = bindings.filter((b) => !b.required);

  const missingRequiredBindingIds = requiredBindings
    .filter((b) => !availableSet.has(b.knowledgePackId))
    .map((b) => b.knowledgePackId);
  const missingOptionalBindingIds = optionalBindings
    .filter((b) => !availableSet.has(b.knowledgePackId))
    .map((b) => b.knowledgePackId);

  return {
    normalized,
    sourceDefaultKnowledgePackIds,
    unknownAvailableKnowledgePackIds,
    bindings,
    requiredBindings,
    optionalBindings,
    missingRequiredBindingIds,
    missingOptionalBindingIds,
    satisfiedRequiredBindingCount: requiredBindings.length - missingRequiredBindingIds.length,
    satisfiedOptionalBindingCount: optionalBindings.length - missingOptionalBindingIds.length,
  };
}

function appendStage5ABoundaryFindings(findings: RoleKnowledgeBindingFinding[]): void {
  for (const spec of STAGE5_A_BOUNDARY_FINDING_SPECS) {
    findings.push(finding("info", spec.code, spec.message));
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
  const gap = resolveBindingGapContext(parsed.agentType, parsed.availableKnowledgePackIds);

  const decision = resolveKnowledgeBindingDecision({
    agentType: parsed.agentType,
    bindings: gap.bindings,
    missingRequiredBindingIds: gap.missingRequiredBindingIds,
    missingOptionalBindingIds: gap.missingOptionalBindingIds,
    allowMissingOptionalBindings: parsed.allowMissingOptionalBindings,
  });

  const inputHygieneChecklist = buildRoleKnowledgeBindingInputHygieneChecklist({
    availableKnowledgePackIdsInputCount: gap.normalized.inputCount,
    normalizedAvailableKnowledgePackIdCount: gap.normalized.normalizedIds.length,
    duplicateAvailableKnowledgePackIdsRemoved: gap.normalized.duplicatesRemoved,
    blankAvailableKnowledgePackIdsRemovedCount: gap.normalized.blankRemovedCount,
    unknownAvailableKnowledgePackIds: gap.unknownAvailableKnowledgePackIds,
    sourceDefaultKnowledgePackIdCount: gap.sourceDefaultKnowledgePackIds.length,
  });

  const findings: RoleKnowledgeBindingFinding[] = [];
  appendStage5ABoundaryFindings(findings);
  appendRoleKnowledgeBindingInputHygieneFindings({
    findings,
    normalized: gap.normalized,
    unknownAvailableKnowledgePackIds: gap.unknownAvailableKnowledgePackIds,
    missingOptionalBindingIds: gap.missingOptionalBindingIds,
    sourceDefaultKnowledgePackIdCount: gap.sourceDefaultKnowledgePackIds.length,
  });
  appendKnowledgeBindingDecisionFindings({
    findings,
    decision,
    agentType: parsed.agentType,
    missingRequiredBindingIds: gap.missingRequiredBindingIds,
    missingOptionalBindingIds: gap.missingOptionalBindingIds,
  });

  return {
    mode: "read_only_role_knowledge_binding_readiness",
    stage: "stage_5_a",
    decision,
    agentType: parsed.agentType,
    taskType: parsed.taskType,
    bindingCount: gap.bindings.length,
    requiredBindingCount: gap.requiredBindings.length,
    satisfiedRequiredBindingCount: gap.satisfiedRequiredBindingCount,
    missingRequiredBindingIds: gap.missingRequiredBindingIds,
    missingOptionalBindingIds: gap.missingOptionalBindingIds,
    optionalBindingCount: gap.optionalBindings.length,
    satisfiedOptionalBindingCount: gap.satisfiedOptionalBindingCount,
    availableKnowledgePackIdsInputCount: gap.normalized.inputCount,
    normalizedAvailableKnowledgePackIds: gap.normalized.normalizedIds,
    normalizedAvailableKnowledgePackIdCount: gap.normalized.normalizedIds.length,
    duplicateAvailableKnowledgePackIdsRemoved: gap.normalized.duplicatesRemoved,
    blankAvailableKnowledgePackIdsRemovedCount: gap.normalized.blankRemovedCount,
    unknownAvailableKnowledgePackIds: gap.unknownAvailableKnowledgePackIds,
    unknownAvailableKnowledgePackIdCount: gap.unknownAvailableKnowledgePackIds.length,
    sourceDefaultKnowledgePackIds: gap.sourceDefaultKnowledgePackIds,
    sourceDefaultKnowledgePackIdCount: gap.sourceDefaultKnowledgePackIds.length,
    inputHygieneChecklist,
    selectedBindings: gap.bindings,
    checklist: buildReadinessChecklist({
      agentType: parsed.agentType,
      taskType: parsed.taskType,
      requiredBindingCount: gap.requiredBindings.length,
      satisfiedRequiredBindingCount: gap.satisfiedRequiredBindingCount,
      missingRequiredBindingIds: gap.missingRequiredBindingIds,
      allowMissingOptionalBindings: parsed.allowMissingOptionalBindings,
    }),
    findings,
    ...STAGE5_A_BOUNDARY_REPORT,
  };
}

export { listDefaultKnowledgePackIds } from "@/lib/agents/defaultRoleKnowledgeBindings";
