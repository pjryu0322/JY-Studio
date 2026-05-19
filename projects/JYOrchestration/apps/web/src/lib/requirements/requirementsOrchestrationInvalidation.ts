/**
 * Orchestration invalidation engine — flow/stage changes → slot stale/downgrade (not chat parsing).
 */

import { hydrateServiceFlowStepsFromAlternativePayload } from "@/lib/requirements/serviceFlowAlternativeProposalPayload";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import { SERVICE_FLOW_SYNC_DERIVED_FROM } from "@/lib/requirements/serviceFlowOrchestrationSync";
import {
  mergeOrchestrationSlotPatches,
  normalizeSlotStatus,
  type SlotPatchInput,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import type {
  RequirementsSingleChatOrchestrationStateV1,
  SingleChatOrchestrationSlotDefinition,
} from "@/lib/requirements/singleChatOrchestrationTypes";

export type OrchestrationInvalidationMode = "STALE" | "DOWNGRADE_TO_PARTIAL" | "REVIEW_REQUIRED";

export type StateInvalidationRule = Readonly<{
  readonly sourceStateType: "flow_structure" | "flow_approved_edit" | "stage_transition";
  readonly affectedTargets: readonly string[];
  readonly invalidationMode: OrchestrationInvalidationMode;
}>;

export const ORCHESTRATION_INVALIDATION_RULES: readonly StateInvalidationRule[] = [
  {
    sourceStateType: "flow_structure",
    affectedTargets: ["orchestration.slots.derivedFrom.service-flow-sync"],
    invalidationMode: "STALE",
  },
  {
    sourceStateType: "flow_approved_edit",
    affectedTargets: ["orchestration.slots.confirmed.service-flow-sync"],
    invalidationMode: "DOWNGRADE_TO_PARTIAL",
  },
  {
    sourceStateType: "stage_transition",
    affectedTargets: ["orchestration.slots.incompatibleStage"],
    invalidationMode: "STALE",
  },
];

export type OrchestrationInvalidationResult = Readonly<{
  readonly state: RequirementsSingleChatOrchestrationStateV1;
  readonly invalidations: readonly string[];
  readonly staleTriggered: boolean;
  readonly staleSlotKeys: readonly string[];
}>;

export function buildServiceFlowStructureFingerprint(flow: RequirementsServiceFlowV1 | null): string {
  const hydrated = hydrateServiceFlowStepsFromAlternativePayload(
    flow ?? { createdAt: "", updatedAt: "", actors: [], steps: [] },
  );
  const actors = (hydrated.actors ?? [])
    .map((a) => `${a.id}:${a.kind}:${a.name.trim()}`)
    .sort()
    .join("|");
  const steps = [...(hydrated.steps ?? [])]
    .sort((a, b) => a.order - b.order)
    .map((s) => `${s.id}:${s.order}:${s.title.trim()}:${s.primaryActorId}`)
    .join("|");
  return `a=${actors}#s=${steps}#v=${String(hydrated.activeFlowVersion ?? "")}`;
}

export function applyOrchestrationInvalidationsAfterFlowChange(input: {
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly previousFingerprint: string | null;
  readonly currentFingerprint: string;
  readonly flowApproved: boolean;
  readonly nowIso?: string;
}): OrchestrationInvalidationResult | null {
  const prev = String(input.previousFingerprint ?? "").trim();
  const cur = input.currentFingerprint.trim();
  if (!prev || prev === cur) return null;

  const now = input.nowIso ?? new Date().toISOString();
  const patches: SlotPatchInput[] = [];
  const invalidations: string[] = [];
  const staleKeys: string[] = [];

  for (const [key, row] of Object.entries(input.orchestration.slots)) {
    if (row.derivedFrom !== SERVICE_FLOW_SYNC_DERIVED_FROM) continue;
    const st = normalizeSlotStatus(String(row.status));

    if (input.flowApproved && st === "confirmed") {
      patches.push({
        slotKey: key,
        status: "partial",
        staleReason: "flow_approved_structure_changed",
        derivedFrom: SERVICE_FLOW_SYNC_DERIVED_FROM,
      });
      invalidations.push(`flow_approved_edit:${key}:DOWNGRADE_TO_PARTIAL`);
      continue;
    }

    if (st === "partial" || st === "candidate" || st === "confirmed") {
      patches.push({
        slotKey: key,
        status: "stale",
        staleReason: "flow_structure_changed",
        derivedFrom: SERVICE_FLOW_SYNC_DERIVED_FROM,
      });
      staleKeys.push(key);
      invalidations.push(`flow_structure:${key}:STALE`);
    }
  }

  if (!patches.length) return null;

  const state = mergeOrchestrationSlotPatches({
    base: input.orchestration,
    patches,
    nowIso: now,
    definitions: input.definitions,
  });

  return {
    state,
    invalidations,
    staleTriggered: staleKeys.length > 0,
    staleSlotKeys: staleKeys,
  };
}
