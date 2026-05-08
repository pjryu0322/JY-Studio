import type {
  RequirementsSingleChatOrchestrationStateV1,
  SingleChatDynamicSlotDefinitionV1,
  SingleChatDynamicSlotPriority,
  SingleChatDynamicSlotProposalHistoryV1,
  SingleChatDynamicSlotValidationRejectionV1,
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

  const bootstrapMeta =
    o.bootstrapMeta && typeof o.bootstrapMeta === "object"
      ? (() => {
          const b = o.bootstrapMeta as Record<string, unknown>;
          const detectedDomain = typeof b.detectedDomain === "string" ? b.detectedDomain.slice(0, 80) : null;
          const recommendedFocus = typeof b.recommendedFocus === "string" ? b.recommendedFocus.slice(0, 120) : null;
          const missingInformation = Array.isArray(b.missingInformation)
            ? b.missingInformation.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 10)
            : [];
          const initialOwnershipHints = Array.isArray(b.initialOwnershipHints)
            ? b.initialOwnershipHints
                .map((x) => {
                  if (!x || typeof x !== "object") return null;
                  const r = x as Record<string, unknown>;
                  const slotKey = String(r.slotKey ?? "").trim();
                  const ownerAgent = String(r.ownerAgent ?? "").trim();
                  if (!slotKey || !ownerAgent) return null;
                  return { slotKey, ownerAgent };
                })
                .filter(Boolean) as Array<{ slotKey: string; ownerAgent: string }>
            : [];
          return {
            ...(detectedDomain ? { detectedDomain } : {}),
            ...(missingInformation.length ? { missingInformation } : {}),
            ...(recommendedFocus ? { recommendedFocus } : {}),
            ...(initialOwnershipHints.length ? { initialOwnershipHints } : {}),
          };
        })()
      : undefined;

  const baseSlotKeys = parseStringArray(o.baseSlotKeys) ?? undefined;

  const dynamicSlotsRaw = o.dynamicSlots && typeof o.dynamicSlots === "object" ? (o.dynamicSlots as Record<string, unknown>) : null;
  const dynamicSlots: Record<string, SingleChatDynamicSlotDefinitionV1> | undefined = dynamicSlotsRaw ? {} : undefined;
  if (dynamicSlotsRaw && dynamicSlots) {
    for (const [k, v] of Object.entries(dynamicSlotsRaw)) {
      if (!v || typeof v !== "object") continue;
      const r = v as Record<string, unknown>;
      const slotKey = String(r.slotKey ?? k).trim();
      const title = String(r.title ?? "").trim();
      const description = String(r.description ?? "").trim();
      const ownerAgent = String(r.ownerAgent ?? "").trim();
      if (!slotKey || !title || !description || !ownerAgent) continue;
      const priorityRaw = String(r.priority ?? "").trim().toLowerCase();
      const priority: SingleChatDynamicSlotPriority | null =
        priorityRaw === "high" || priorityRaw === "medium" || priorityRaw === "low" ? (priorityRaw as any) : null;
      const proposalConfidence =
        r.proposalConfidence !== null && r.proposalConfidence !== undefined && Number.isFinite(Number(r.proposalConfidence))
          ? Math.min(1, Math.max(0, Number(r.proposalConfidence)))
          : null;
      const proposedAt = typeof r.proposedAt === "string" ? r.proposedAt : null;
      const reason = typeof r.reason === "string" ? r.reason : r.reason === null ? null : null;
      const externalProposedOwnerRaw = r.externalProposedOwner;
      const externalProposedOwner =
        typeof externalProposedOwnerRaw === "string"
          ? externalProposedOwnerRaw.trim().toLowerCase()
          : externalProposedOwnerRaw === null
            ? null
            : undefined;
      dynamicSlots[slotKey] = {
        slotKey,
        title,
        description,
        ownerAgent,
        priority,
        proposalConfidence,
        proposedAt,
        reason,
        ...(externalProposedOwner !== undefined ? { externalProposedOwner } : {}),
      };
    }
  }

  const rejectedDynamicSlots: SingleChatDynamicSlotValidationRejectionV1[] | undefined = Array.isArray(o.rejectedDynamicSlots)
    ? o.rejectedDynamicSlots
        .map((x) => {
          if (!x || typeof x !== "object") return null;
          const r = x as Record<string, unknown>;
          const slotKey = String(r.slotKey ?? "").trim();
          const reason = String(r.reason ?? "").trim();
          const rejectedAt = String(r.rejectedAt ?? "").trim();
          if (!slotKey || !reason || !rejectedAt) return null;
          return { slotKey, reason, rejectedAt };
        })
        .filter(Boolean) as SingleChatDynamicSlotValidationRejectionV1[]
    : undefined;

  const slotProposalHistory: SingleChatDynamicSlotProposalHistoryV1[] | undefined = Array.isArray(o.slotProposalHistory)
    ? o.slotProposalHistory
        .map((x) => {
          if (!x || typeof x !== "object") return null;
          const r = x as Record<string, unknown>;
          const proposedAt = String(r.proposedAt ?? "").trim();
          if (!proposedAt) return null;
          const suggestedSlots = Array.isArray(r.suggestedSlots)
            ? r.suggestedSlots
                .map((s) => {
                  if (!s || typeof s !== "object") return null;
                  const so = s as Record<string, unknown>;
                  const slotKey = String(so.slotKey ?? "").trim();
                  const title = String(so.title ?? "").trim();
                  const description = String(so.description ?? "").trim();
                  const ownerAgent = String(so.ownerAgent ?? "").trim();
                  if (!slotKey || !title || !description || !ownerAgent) return null;
                  const priorityRaw = String(so.priority ?? "").trim().toLowerCase();
                  const priority: SingleChatDynamicSlotPriority | null =
                    priorityRaw === "high" || priorityRaw === "medium" || priorityRaw === "low"
                      ? (priorityRaw as any)
                      : null;
                  const proposalConfidence =
                    so.proposalConfidence !== null && so.proposalConfidence !== undefined && Number.isFinite(Number(so.proposalConfidence))
                      ? Math.min(1, Math.max(0, Number(so.proposalConfidence)))
                      : null;
                  const reason = typeof so.reason === "string" ? so.reason : so.reason === null ? null : null;
                  return { slotKey, title, description, ownerAgent, priority, proposalConfidence, reason };
                })
                .filter(Boolean)
            : [];
          const acceptedSlotKeys = parseStringArray(r.acceptedSlotKeys) ?? [];
          const rejected = Array.isArray(r.rejected)
            ? (r.rejected
                .map((q) => {
                  if (!q || typeof q !== "object") return null;
                  const qo = q as Record<string, unknown>;
                  const slotKey = String(qo.slotKey ?? "").trim();
                  const reason = String(qo.reason ?? "").trim();
                  const rejectedAt = String(qo.rejectedAt ?? "").trim();
                  if (!slotKey || !reason || !rejectedAt) return null;
                  return { slotKey, reason, rejectedAt };
                })
                .filter(Boolean) as SingleChatDynamicSlotValidationRejectionV1[])
            : [];
          return { proposedAt, suggestedSlots, acceptedSlotKeys, rejected };
        })
        .filter(Boolean) as SingleChatDynamicSlotProposalHistoryV1[]
    : undefined;

  return {
    version: ver === 2 ? 2 : 2,
    stageGroup,
    slotDefinitionsHash,
    slots,
    ...(bootstrapMeta ? { bootstrapMeta } : {}),
    ...(baseSlotKeys ? { baseSlotKeys } : {}),
    ...(dynamicSlots ? { dynamicSlots } : {}),
    ...(rejectedDynamicSlots ? { rejectedDynamicSlots } : {}),
    ...(slotProposalHistory ? { slotProposalHistory } : {}),
    ...(lastOrchestratorAgent !== undefined ? { lastOrchestratorAgent } : {}),
    ...(lastRoutingDecision !== undefined ? { lastRoutingDecision } : {}),
    ...(lastDelegatedAgents !== undefined ? { lastDelegatedAgents } : {}),
    updatedAt,
  };
}
