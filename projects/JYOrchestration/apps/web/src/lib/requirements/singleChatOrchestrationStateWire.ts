import type {
  RequirementsSingleChatOrchestrationStateV1,
  SingleChatOrchestrationSlotV1,
} from "@/lib/requirements/singleChatOrchestrationTypes";
import { normalizeSlotStatus } from "@/lib/requirements/singleChatOrchestrationSlots";
import type { SingleChatOrchestrationSlotDefinition } from "@/lib/requirements/singleChatOrchestrationTypes";

function parseStringArray(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.map((x) => String(x ?? "").trim()).filter(Boolean);
}

/** 저장 JSON → 런타임 상태(definitions로 dependsOn 보강 가능) */
export function parseRequirementsSingleChatOrchestrationV1(
  raw: unknown,
  definitions?: readonly SingleChatOrchestrationSlotDefinition[]
): RequirementsSingleChatOrchestrationStateV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const ver = o.version === 2 ? 2 : o.version === 1 ? 1 : null;
  if (ver === null) return null;
  const stageGroup = typeof o.stageGroup === "string" ? o.stageGroup.trim() : "";
  const slotDefinitionsHash = typeof o.slotDefinitionsHash === "string" ? o.slotDefinitionsHash.trim() : "";
  const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt.trim() : "";
  if (!stageGroup || !slotDefinitionsHash || !updatedAt) return null;
  const slotsRaw = o.slots && typeof o.slots === "object" ? (o.slots as Record<string, unknown>) : null;
  if (!slotsRaw) return null;

  const defByKey = definitions ? new Map(definitions.map((d) => [d.slotKey, d])) : null;

  const slots: Record<string, SingleChatOrchestrationSlotV1> = {};
  for (const [k, v] of Object.entries(slotsRaw)) {
    if (!v || typeof v !== "object") continue;
    const r = v as Record<string, unknown>;
    const slotKey = typeof r.slotKey === "string" ? r.slotKey : k;
    const ownerAgent = typeof r.ownerAgent === "string" ? r.ownerAgent : "";
    const sg = typeof r.stageGroup === "string" ? r.stageGroup : "";
    const label = typeof r.label === "string" ? r.label : "";
    let st = normalizeSlotStatus(String(r.status ?? "empty"));
    const updatedAtSlot = typeof r.updatedAt === "string" ? r.updatedAt : updatedAt;
    if (!slotKey || !ownerAgent || !sg || !label) continue;

    const depsFromDef = defByKey?.get(slotKey)?.dependsOn;
    const dependsOn =
      parseStringArray(r.dependsOn) ??
      (depsFromDef ? [...depsFromDef] : undefined) ??
      [];

    const derivedFrom =
      r.derivedFrom === null || r.derivedFrom === undefined
        ? null
        : typeof r.derivedFrom === "string"
          ? r.derivedFrom
          : null;
    const staleReason =
      r.staleReason === null || r.staleReason === undefined
        ? null
        : typeof r.staleReason === "string"
          ? r.staleReason
          : null;
    const revision = typeof r.revision === "number" && Number.isFinite(r.revision) ? Math.floor(r.revision) : 0;

    slots[slotKey] = {
      slotKey,
      ownerAgent,
      stageGroup: sg,
      label,
      status: st,
      value: r.value === null || r.value === undefined ? null : String(r.value).slice(0, 4000),
      confidence:
        r.confidence !== null && r.confidence !== undefined && Number.isFinite(Number(r.confidence))
          ? Math.min(1, Math.max(0, Number(r.confidence)))
          : null,
      updatedAt: updatedAtSlot,
      dependsOn,
      derivedFrom,
      staleReason,
      revision,
    };
  }
  if (!Object.keys(slots).length) return null;

  const lastOrchestratorAgent =
    typeof o.lastOrchestratorAgent === "string" ? o.lastOrchestratorAgent : o.lastOrchestratorAgent === null ? null : undefined;
  const lastRoutingDecision =
    typeof o.lastRoutingDecision === "string" ? o.lastRoutingDecision : o.lastRoutingDecision === null ? null : undefined;
  let lastDelegatedAgents: string[] | undefined;
  if (Array.isArray(o.lastDelegatedAgents)) {
    lastDelegatedAgents = o.lastDelegatedAgents.map((x) => String(x ?? "").trim()).filter(Boolean);
  }

  return {
    version: ver === 2 ? 2 : 2,
    stageGroup,
    slotDefinitionsHash,
    slots,
    ...(lastOrchestratorAgent !== undefined ? { lastOrchestratorAgent } : {}),
    ...(lastRoutingDecision !== undefined ? { lastRoutingDecision } : {}),
    ...(lastDelegatedAgents !== undefined ? { lastDelegatedAgents } : {}),
    updatedAt,
  };
}
