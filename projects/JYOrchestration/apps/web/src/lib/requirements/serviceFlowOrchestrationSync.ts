/**
 * serviceFlow apply/approve/edit → orchestration slot sync bridge.
 */

import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import { hydrateServiceFlowStepsFromAlternativePayload } from "@/lib/requirements/serviceFlowAlternativeProposalPayload";
import {
  extractServiceFlowStructuralCapabilities,
  isServiceFlowSyncEligibleSlot,
  slotCapabilitiesForDefinition,
  slotMatchesFlowCapabilities,
} from "@/lib/requirements/serviceFlowOrchestrationSemantic";
import {
  hashSlotDefinitions,
  initialOrchestrationStateFromDefinitions,
  isPlannerStableEnough,
  mergeOrchestrationSlotPatches,
  normalizeSlotStatus,
  singleChatOrchestrationConfirmedProgress,
  singleChatOrchestrationWeightedProgress,
  type SlotPatchInput,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import type {
  RequirementsSingleChatOrchestrationStateV1,
  SingleChatOrchestrationSlotDefinition,
  SingleChatOrchestrationSlotStatus,
} from "@/lib/requirements/singleChatOrchestrationTypes";

export const SERVICE_FLOW_SYNC_DERIVED_FROM = "service-flow-sync";

export type ServiceFlowSlotSyncMode = "service_flow_apply" | "service_flow_approve" | "service_flow_edit";

export type ServiceFlowOrchestrationSyncResult = Readonly<{
  readonly state: RequirementsSingleChatOrchestrationStateV1;
  readonly slotSyncTriggered: true;
  readonly slotSyncMode: ServiceFlowSlotSyncMode;
  readonly slotSyncResult: "partial" | "mixed" | "none";
  readonly slotSyncCount: number;
  readonly staleCount: number;
  readonly progressBefore: ReturnType<typeof singleChatOrchestrationWeightedProgress>;
  readonly progressAfter: ReturnType<typeof singleChatOrchestrationWeightedProgress>;
  readonly syncedSlotLabels: readonly string[];
  readonly slotStateTransitions: readonly { slotKey: string; from: string; to: string; reason?: string }[];
}>;

function statusRank(st: SingleChatOrchestrationSlotStatus): number {
  if (st === "confirmed") return 4;
  if (st === "candidate") return 3;
  if (st === "partial" || st === "stale") return 2;
  return 1;
}

function targetStatusForMode(
  mode: ServiceFlowSlotSyncMode,
  orchestration: RequirementsSingleChatOrchestrationStateV1,
  definitions: readonly SingleChatOrchestrationSlotDefinition[],
): SingleChatOrchestrationSlotStatus {
  if (mode === "service_flow_approve") {
    return isPlannerStableEnough(orchestration, definitions) ? "confirmed" : "partial";
  }
  if (mode === "service_flow_apply") return "partial";
  return "candidate";
}

function resolveSyncMode(flow: RequirementsServiceFlowV1): ServiceFlowSlotSyncMode | null {
  const d = String(flow.lastProposalDecision ?? "")
    .trim()
    .toUpperCase();
  if (d === "APPLY") return "service_flow_apply";
  if (d === "FLOW_APPROVE") return "service_flow_approve";
  if (
    d === "PARTIAL_EDIT" ||
    d === "REVIEW_FLOW" ||
    d === "STRUCTURED_ACTOR_ADD" ||
    d === "STRUCTURED_ACTOR_ASSIGN"
  ) {
    return "service_flow_edit";
  }
  return null;
}

function buildSlotValue(
  def: SingleChatOrchestrationSlotDefinition,
  flow: RequirementsServiceFlowV1,
): string {
  const suffix = def.slotKey.includes(".flow.serviceFlow")
    ? "serviceFlow"
    : def.slotKey.includes(".flow.actorTypes")
      ? "actorTypes"
      : def.slotKey.includes(".planning.coreUsers")
        ? "coreUsers"
        : "generic";

  const actors = flow.actors ?? [];
  const steps = [...(flow.steps ?? [])].sort((a, b) => a.order - b.order);

  if (suffix === "actorTypes" || suffix === "coreUsers") {
    const lines = actors
      .map((a) => `- ${a.name.trim()} (${a.kind === "system" ? "시스템" : "사람"})`)
      .filter((l) => l.length > 4);
    return lines.length ? `서비스 흐름에서 반영된 액터:\n${lines.join("\n")}` : "";
  }
  if (suffix === "serviceFlow") {
    const titles = steps.map((s) => s.title.trim()).filter(Boolean);
    return titles.length
      ? `서비스 흐름 단계:\n${titles.map((t, i) => `${i + 1}. ${t}`).join("\n")}`
      : "";
  }

  const caps = slotCapabilitiesForDefinition(def);
  const capLine = caps.length ? caps.join(", ") : "flow";
  return `서비스 흐름 구조(${capLine})에서 동기화된 ${def.label} 초안입니다.`;
}

function shouldPreserveConfirmed(prev: SingleChatOrchestrationSlotStatus): boolean {
  return prev === "confirmed";
}

function pickStatus(
  prev: SingleChatOrchestrationSlotStatus,
  mode: ServiceFlowSlotSyncMode,
  orchestration: RequirementsSingleChatOrchestrationStateV1,
  definitions: readonly SingleChatOrchestrationSlotDefinition[],
): SingleChatOrchestrationSlotStatus | null {
  if (shouldPreserveConfirmed(prev)) return null;
  const target = targetStatusForMode(mode, orchestration, definitions);
  if (statusRank(prev) >= statusRank(target)) return null;
  return target;
}

export function syncServiceFlowToOrchestrationSlots(input: {
  readonly flow: RequirementsServiceFlowV1;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1 | null | undefined;
  readonly nowIso?: string;
}): ServiceFlowOrchestrationSyncResult | null {
  const flow = hydrateServiceFlowStepsFromAlternativePayload(input.flow);
  const mode = resolveSyncMode(flow);
  if (!mode) return null;

  const actors = flow.actors ?? [];
  const steps = flow.steps ?? [];
  if (!actors.length && !steps.length) return null;

  const now = input.nowIso ?? new Date().toISOString();
  const defsHash = hashSlotDefinitions(input.definitions);
  const base =
    input.orchestration?.slotDefinitionsHash === defsHash
      ? input.orchestration
      : initialOrchestrationStateFromDefinitions(input.definitions, now);

  const progressBefore = singleChatOrchestrationWeightedProgress(base);
  const flowCaps = extractServiceFlowStructuralCapabilities(flow);
  const patches: SlotPatchInput[] = [];
  const transitions: { slotKey: string; from: string; to: string; reason?: string }[] = [];
  const syncedLabels: string[] = [];
  const touchedKeys = new Set<string>();

  for (const def of input.definitions) {
    if (!isServiceFlowSyncEligibleSlot(def)) continue;
    if (!slotMatchesFlowCapabilities(def, flowCaps)) continue;

    const row = base.slots[def.slotKey];
    if (!row) continue;

    const prevStatus = normalizeSlotStatus(String(row.status));
    const nextStatus = pickStatus(prevStatus, mode, base, input.definitions);
    if (!nextStatus) continue;

    const value = buildSlotValue(def, flow);
    if (value.trim().length < 8) continue;

    patches.push({
      slotKey: def.slotKey,
      status: nextStatus,
      value: value.slice(0, 4000),
      confidence: mode === "service_flow_approve" ? 0.9 : 0.72,
      derivedFrom: SERVICE_FLOW_SYNC_DERIVED_FROM,
    });
    touchedKeys.add(def.slotKey);
    syncedLabels.push(def.label);
    transitions.push({
      slotKey: def.slotKey,
      from: prevStatus,
      to: nextStatus,
      reason: mode,
    });
  }

  const stalePatches: SlotPatchInput[] = [];
  for (const [key, row] of Object.entries(base.slots)) {
    if (touchedKeys.has(key)) continue;
    if (row.derivedFrom !== SERVICE_FLOW_SYNC_DERIVED_FROM) continue;
    const st = normalizeSlotStatus(String(row.status));
    if (st !== "partial" && st !== "candidate") continue;

    const def = input.definitions.find((d) => d.slotKey === key);
    if (!def || !isServiceFlowSyncEligibleSlot(def)) continue;
    if (slotMatchesFlowCapabilities(def, flowCaps)) continue;

    stalePatches.push({
      slotKey: key,
      status: "stale",
      staleReason: "service-flow structure changed",
      derivedFrom: SERVICE_FLOW_SYNC_DERIVED_FROM,
    });
    transitions.push({ slotKey: key, from: st, to: "stale", reason: "flow_structure_removed" });
  }

  if (!patches.length && !stalePatches.length) return null;

  let state = mergeOrchestrationSlotPatches({
    base,
    patches: [...patches, ...stalePatches],
    nowIso: now,
    definitions: input.definitions,
  });

  for (const p of patches) {
    const prev = base.slots[p.slotKey];
    if (prev && shouldPreserveConfirmed(normalizeSlotStatus(String(prev.status)))) {
      state = mergeOrchestrationSlotPatches({
        base: state,
        patches: [
          {
            slotKey: p.slotKey,
            status: prev.status,
            value: prev.value,
            derivedFrom: prev.derivedFrom,
          },
        ],
        nowIso: now,
        definitions: input.definitions,
      });
    }
  }

  const progressAfter = singleChatOrchestrationWeightedProgress(state);
  const statuses = new Set(patches.map((p) => normalizeSlotStatus(String(p.status ?? "partial"))));
  const slotSyncResult: "partial" | "mixed" | "none" =
    patches.length === 0 ? "none" : statuses.size > 1 ? "mixed" : "partial";

  return {
    state,
    slotSyncTriggered: true,
    slotSyncMode: mode,
    slotSyncResult,
    slotSyncCount: patches.length,
    staleCount: stalePatches.length,
    progressBefore,
    progressAfter,
    syncedSlotLabels: syncedLabels,
    slotStateTransitions: transitions,
  };
}

/** @deprecated alias */
export function mergeOrchestrationWithServiceFlowApply(input: {
  readonly flow: RequirementsServiceFlowV1;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1 | null | undefined;
  readonly nowIso?: string;
}): RequirementsSingleChatOrchestrationStateV1 | null {
  return syncServiceFlowToOrchestrationSlots(input)?.state ?? null;
}

export function buildServiceFlowApplySyncUserMessage(input: {
  readonly flow: RequirementsServiceFlowV1;
  readonly sync: ServiceFlowOrchestrationSyncResult;
}): string {
  const direction =
    String(input.flow.alternativeProposalPayload?.directionLabel ?? "").trim() ||
    String(input.flow.alternativeProposalPayload?.summary ?? "")
      .replace(/^기존 초안과 다른 방향의 대안을 생성했습니다\.?\s*/i, "")
      .trim()
      .slice(0, 80);

  const heading = direction
    ? `${direction} 흐름을 현재 서비스 흐름으로 반영했습니다.`
    : "선택한 흐름을 현재 서비스 흐름으로 반영했습니다.";

  const lines = [
    heading,
    "",
    "동기화된 항목:",
    ...input.sync.syncedSlotLabels.slice(0, 8).map((l) => `- ${l}`),
    "",
    `현재 orchestration 슬롯 ${input.sync.slotSyncCount}건이 ${input.sync.slotSyncResult === "mixed" ? "partial/candidate" : "partial"} 상태로 반영되었습니다.`,
    "다음: 흐름 상세 검토 후 승인하거나 일부 수정할 수 있습니다.",
  ];
  return lines.join("\n").trim();
}

export function buildServiceFlowSlotSyncTimelineEntry(
  sync: ServiceFlowOrchestrationSyncResult,
): {
  readonly action: string;
  readonly source: "internal";
  readonly routingDecision: string;
  readonly slotSyncTriggered: boolean;
  readonly slotSyncMode: string;
  readonly slotSyncResult: string;
  readonly slotSyncCount: number;
  readonly progressBefore: number;
  readonly progressAfter: number;
  readonly slotStateTransitions: typeof sync.slotStateTransitions;
  readonly updatedSlotCount: number;
  readonly staleSlots: readonly string[];
} {
  return {
    action: "serviceFlowSlotSync",
    source: "internal" as const,
    routingDecision: "service_flow_slot_sync_bridge",
    slotSyncTriggered: true,
    slotSyncMode: sync.slotSyncMode,
    slotSyncResult: sync.slotSyncResult,
    slotSyncCount: sync.slotSyncCount,
    progressBefore: sync.progressBefore.percent,
    progressAfter: sync.progressAfter.percent,
    slotStateTransitions: sync.slotStateTransitions,
    updatedSlotCount: sync.slotSyncCount,
    staleSlots: sync.slotStateTransitions
      .filter((t) => t.to === "stale")
      .map((t) => t.slotKey),
  };
}
