/**
 * Orchestration projection rebuild with fallback (invalidation pipeline).
 */

import {
  initialOrchestrationStateFromDefinitions,
  hashSlotDefinitions,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import type {
  RequirementsSingleChatOrchestrationStateV1,
  SingleChatOrchestrationSlotDefinition,
} from "@/lib/requirements/singleChatOrchestrationTypes";

export type OrchestrationProjectionRebuildLog = Readonly<{
  readonly ok: boolean;
  readonly reason: string;
  readonly stage: string;
  readonly projectionId: string;
  readonly mutationSource: string;
  readonly retried: boolean;
  readonly error?: string;
}>;

export function rebuildOrchestrationProjectionWithFallback(input: {
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1 | null | undefined;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly mutationSource: string;
  readonly stage: string;
  readonly nowIso?: string;
}): Readonly<{ readonly state: RequirementsSingleChatOrchestrationStateV1; readonly log: OrchestrationProjectionRebuildLog }> {
  const now = input.nowIso ?? new Date().toISOString();
  const defsHash = hashSlotDefinitions(input.definitions);
  const projectionId = input.orchestration?.slotDefinitionsHash ?? "none";

  try {
    const aligned =
      input.orchestration?.slotDefinitionsHash === defsHash
        ? input.orchestration
        : initialOrchestrationStateFromDefinitions(input.definitions, now);
    return {
      state: aligned,
      log: {
        ok: true,
        reason: "projection_aligned",
        stage: input.stage,
        projectionId,
        mutationSource: input.mutationSource,
        retried: input.orchestration?.slotDefinitionsHash !== defsHash,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const fallback = initialOrchestrationStateFromDefinitions(input.definitions, now);
    return {
      state: fallback,
      log: {
        ok: true,
        reason: "projection_fallback_rebuild",
        stage: input.stage,
        projectionId,
        mutationSource: input.mutationSource,
        retried: true,
        error: msg,
      },
    };
  }
}
