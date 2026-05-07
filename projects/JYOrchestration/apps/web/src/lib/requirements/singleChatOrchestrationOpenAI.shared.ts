import type { SingleChatOrchestrationSlotDefinition } from "@/lib/requirements/singleChatOrchestrationTypes";
import type { SlotPatchInput } from "@/lib/requirements/singleChatOrchestrationSlots";

export const FLOW_OWNERS = new Set(["service-designer", "domain-expert"]);
export const DESIGN_OWNERS = new Set(["spec-reviewer", "task-reviewer"]);

export function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export function filterDelegatesForActiveRoles(delegated: readonly string[], active: Set<string>): string[] {
  return delegated
    .map((d) => String(d ?? "").trim().toLowerCase())
    .filter((d) => d && d !== "planner" && active.has(d));
}

export function parseUpdatedSlotsRows(
  raw: unknown,
  validKeys: Set<string>,
  allowedOwners: Set<string> | null,
  definitions: readonly SingleChatOrchestrationSlotDefinition[]
): SlotPatchInput[] {
  if (!Array.isArray(raw)) return [];
  const defOwner = new Map(definitions.map((d) => [d.slotKey, d.ownerAgent]));
  const out: SlotPatchInput[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const slotKey = String(r.slotKey ?? "").trim();
    if (!slotKey || !validKeys.has(slotKey)) continue;
    const canonical = defOwner.get(slotKey) ?? "";
    if (allowedOwners && !allowedOwners.has(canonical)) continue;
    const ownerRaw = String(r.ownerAgent ?? "").trim().toLowerCase();
    if (ownerRaw && ownerRaw !== canonical && canonical) continue;
    out.push({
      slotKey,
      status: String(r.status ?? ""),
      value: r.value === null || r.value === undefined ? null : String(r.value).slice(0, 4000),
      confidence: r.confidence === null || r.confidence === undefined ? null : Number(r.confidence),
      ownerAgent: canonical || undefined,
    });
  }
  return out;
}

