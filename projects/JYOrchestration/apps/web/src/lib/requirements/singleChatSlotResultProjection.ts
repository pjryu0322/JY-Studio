/**
 * Project SingleChat — project service-flow analyze results into orchestration slots (candidate/partial).
 */

import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import {
  extractServiceFlowStructuralCapabilities,
  isServiceFlowSyncEligibleSlot,
  slotMatchesFlowCapabilities,
} from "@/lib/requirements/serviceFlowOrchestrationSemantic";
import {
  hashSlotDefinitions,
  initialOrchestrationStateFromDefinitions,
  isPlannerStableEnough,
  mergeOrchestrationSlotPatches,
  normalizeSlotStatus,
  type SlotPatchInput,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import type {
  RequirementsSingleChatOrchestrationStateV1,
  SingleChatOrchestrationSlotDefinition,
  SingleChatOrchestrationSlotStatus,
} from "@/lib/requirements/singleChatOrchestrationTypes";

export type ServiceFlowSlotProjectionSource =
  | "actor_definition"
  | "flow_draft"
  | "flow_step_definition"
  | "flow_review"
  | "flow_approve";

export const SERVICE_FLOW_SLOT_PROJECTION_DERIVED_FROM = "service-flow-slot-projection";

function statusRank(st: SingleChatOrchestrationSlotStatus): number {
  if (st === "confirmed") return 4;
  if (st === "candidate") return 3;
  if (st === "partial" || st === "stale") return 2;
  return 1;
}

function targetStatusForProjectionSource(input: {
  readonly source: ServiceFlowSlotProjectionSource;
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
}): SingleChatOrchestrationSlotStatus {
  if (input.source === "flow_approve") {
    return isPlannerStableEnough(input.orchestration, input.definitions) ? "partial" : "candidate";
  }
  if (input.source === "flow_review" || input.source === "flow_step_definition") return "partial";
  return "candidate";
}

function buildSlotValue(
  def: SingleChatOrchestrationSlotDefinition,
  flow: RequirementsServiceFlowV1,
): string {
  const actors = flow.actors ?? [];
  const steps = [...(flow.steps ?? [])].sort((a, b) => a.order - b.order);

  if (def.slotKey.includes(".flow.actorTypes") || def.slotKey.includes(".planning.coreUsers")) {
    const lines = actors
      .map((a) => `- ${a.name.trim()} (${a.kind === "system" ? "시스템" : "사람"})`)
      .filter((l) => l.length > 4);
    return lines.length ? `서비스 흐름 후보 액터:\n${lines.join("\n")}` : "";
  }
  if (def.slotKey.includes(".flow.serviceFlow")) {
    const titles = steps.map((s) => s.title.trim()).filter(Boolean);
    return titles.length
      ? `서비스 흐름 후보 단계:\n${titles.map((t, i) => `${i + 1}. ${t}`).join("\n")}`
      : "";
  }
  if (def.slotKey.includes(".flow.approvalFlow")) {
    const reviewSteps = steps.filter((s) => /검수|검토|승인|확정|review|approve/i.test(`${s.title} ${s.purpose}`));
    if (reviewSteps.length) {
      return `검수·승인 흐름 후보:\n${reviewSteps.map((s) => `- ${s.title}`).join("\n")}`;
    }
  }
  if (def.slotKey.includes(".architecture.automationLevel")) {
    const systemSteps = steps.filter((s) => {
      const actor = actors.find((a) => a.id === s.primaryActorId);
      return actor?.kind === "system";
    });
    if (systemSteps.length) {
      return `시스템 처리 후보:\n${systemSteps.map((s) => `- ${s.title}`).join("\n")}`;
    }
  }

  return `서비스 흐름 분석에서 도출된 ${def.label} 초안입니다.`;
}

function pickProjectionStatus(
  prev: SingleChatOrchestrationSlotStatus,
  target: SingleChatOrchestrationSlotStatus,
): SingleChatOrchestrationSlotStatus | null {
  if (prev === "confirmed") return null;
  if (statusRank(prev) >= statusRank(target)) return null;
  return target;
}

export function projectServiceFlowResultToSingleChatSlots(input: {
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1 | null;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly flow: RequirementsServiceFlowV1 | null;
  readonly source: ServiceFlowSlotProjectionSource;
  readonly nowIso: string;
}): RequirementsSingleChatOrchestrationStateV1 | null {
  const flow = input.flow;
  if (!flow) return null;
  const actors = flow.actors ?? [];
  const steps = flow.steps ?? [];
  if (!actors.length && !steps.length) return null;

  const now = input.nowIso;
  const defsHash = hashSlotDefinitions(input.definitions);
  const base =
    input.orchestration?.slotDefinitionsHash === defsHash
      ? input.orchestration
      : initialOrchestrationStateFromDefinitions(input.definitions, now);

  const targetDefault = targetStatusForProjectionSource({
    source: input.source,
    orchestration: base,
    definitions: input.definitions,
  });
  const flowCaps = extractServiceFlowStructuralCapabilities(flow);
  const patches: SlotPatchInput[] = [];

  for (const def of input.definitions) {
    if (!isServiceFlowSyncEligibleSlot(def)) continue;
    if (!slotMatchesFlowCapabilities(def, flowCaps)) continue;

    const row = base.slots[def.slotKey];
    if (!row) continue;

    const prevStatus = normalizeSlotStatus(String(row.status));
    const nextStatus = pickProjectionStatus(prevStatus, targetDefault);
    if (!nextStatus) continue;

    const value = buildSlotValue(def, flow);
    if (value.trim().length < 8) continue;

    patches.push({
      slotKey: def.slotKey,
      status: nextStatus,
      value: value.slice(0, 4000),
      confidence: input.source === "flow_approve" ? 0.85 : 0.65,
      derivedFrom: SERVICE_FLOW_SLOT_PROJECTION_DERIVED_FROM,
    });
  }

  if (!patches.length) return null;

  return mergeOrchestrationSlotPatches({
    base,
    patches,
    nowIso: now,
    definitions: input.definitions,
  });
}

/** @deprecated alias for tests */
export const projectServiceFlowResultToSlots = projectServiceFlowResultToSingleChatSlots;
