/**
 * Stage 5-A input hygiene helpers (trim/dedupe/sort/unknown trace; read-only).
 */

import { listDefaultKnowledgePackIds } from "@/lib/agents/defaultRoleKnowledgeBindings";
import type {
  RoleKnowledgeBindingChecklistItem,
  RoleKnowledgeBindingFinding,
} from "@/lib/agents/roleKnowledgeBindingTypes";

export type NormalizedKnowledgePackIdsResult = {
  readonly inputCount: number;
  readonly normalizedIds: readonly string[];
  readonly duplicatesRemoved: readonly string[];
  readonly blankRemovedCount: number;
};

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

/** Deterministic lexicographic sort for knowledge pack IDs. */
export function sortedKnowledgePackIds(ids: readonly string[]): readonly string[] {
  return [...ids].sort((a, b) => a.localeCompare(b));
}

/** Trim, drop blanks, dedupe, and sort available knowledge pack IDs (no input mutation). */
export function normalizeAvailableKnowledgePackIds(inputIds: readonly string[]): NormalizedKnowledgePackIdsResult {
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

  const duplicatesRemoved = sortedKnowledgePackIds(
    [...occurrenceCount.entries()].filter(([, count]) => count > 1).map(([id]) => id),
  );

  return {
    inputCount,
    normalizedIds: sortedKnowledgePackIds(firstSeenOrder),
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
  return sortedKnowledgePackIds(input.normalizedAvailableKnowledgePackIds.filter((id) => !defaultSet.has(id)));
}

/** Sorted default registry IDs for source trace. */
export function sortedDefaultKnowledgePackIds(): readonly string[] {
  return sortedKnowledgePackIds(listDefaultKnowledgePackIds());
}

export function buildRoleKnowledgeBindingInputHygieneChecklist(input: {
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

export function appendRoleKnowledgeBindingInputHygieneFindings(input: {
  readonly findings: RoleKnowledgeBindingFinding[];
  readonly normalized: NormalizedKnowledgePackIdsResult;
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
