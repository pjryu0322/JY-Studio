/**
 * Timeline = audit/log only. LLM context uses compressed orchestration summary.
 */

import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { ServiceFlowStageTransitionMeta } from "@/lib/requirements/serviceFlowStageTransition";
import { resolveAuthoritativeOrchestrationStage } from "@/lib/requirements/requirementsOrchestrationRegistry";
import { buildProgressProjection, resolveOrchestrationUiState } from "@/lib/requirements/requirementsOrchestrationProjection";
import type { SingleChatOrchestrationSlotDefinition } from "@/lib/requirements/singleChatOrchestrationTypes";
import type { RequirementsTransitionResult } from "@/lib/requirements/requirementsTransitionEngine";

export function appendOrchestrationTransitionTimelineExtras(input: {
  readonly base: Record<string, unknown>;
  readonly transitionMeta?: ServiceFlowStageTransitionMeta | null;
  readonly transitionEngine?: RequirementsTransitionResult | null;
}): Record<string, unknown> {
  const meta = input.transitionMeta;
  const eng = input.transitionEngine;
  return {
    ...input.base,
    ...(meta?.quickActionType ? { quickActionType: meta.quickActionType } : {}),
    ...(meta?.transitionTriggered || eng?.transitionTriggered
      ? { transitionTriggered: true }
      : {}),
    ...(meta?.fromStage ? { fromStage: meta.fromStage } : {}),
    ...(meta?.toStage ? { toStage: meta.toStage } : {}),
    ...(meta?.transitionMode ? { transitionMode: meta.transitionMode } : {}),
    ...(meta?.orchestrationStateUpdated || eng?.slotSyncTriggered
      ? { orchestrationStateUpdated: true }
      : {}),
    ...(eng?.transitionResult ? { transitionResult: eng.transitionResult } : {}),
    ...(eng?.projectionUpdated ? { projectionUpdated: eng.projectionUpdated } : {}),
    ...(eng?.slotSyncTriggered ? { slotSyncTriggered: eng.slotSyncTriggered } : {}),
    ...(eng?.staleTriggered ? { staleTriggered: eng.staleTriggered } : {}),
    ...(eng?.invalidations?.length ? { invalidations: [...eng.invalidations] } : {}),
    ...(eng?.signal?.type ? { transitionSignal: eng.signal.type } : {}),
    ...(typeof (eng?.signal?.payload as { quickActionId?: string } | undefined)?.quickActionId === "string"
      ? { quickActionId: String((eng?.signal?.payload as { quickActionId: string }).quickActionId) }
      : {}),
  };
}

/** Compressed summary for LLM prompts — not full promptTimeline replay. */
export function buildCompressedOrchestrationSummaryForLlm(input: {
  readonly state: RequirementsStateJson;
  readonly slotDefinitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly maxChars?: number;
}): string {
  const max = input.maxChars ?? 1200;
  const stage = resolveAuthoritativeOrchestrationStage(input.state);
  const { uiState } = resolveOrchestrationUiState({
    state: input.state,
    slotDefinitions: input.slotDefinitions,
  });
  const progress = buildProgressProjection(uiState);
  const confirmed = Object.entries(uiState.slots)
    .filter(([, row]) => row.status === "confirmed")
    .map(([k]) => k.split(".").pop() ?? k)
    .slice(0, 6);
  const partial = Object.entries(uiState.slots)
    .filter(([, row]) => row.status === "partial" || row.status === "candidate")
    .map(([k]) => k.split(".").pop() ?? k)
    .slice(0, 6);
  const stale = Object.entries(uiState.slots)
    .filter(([, row]) => row.status === "stale")
    .map(([k]) => k.split(".").pop() ?? k)
    .slice(0, 4);

  const flow = input.state.serviceFlowV1;
  const stepTitles = [...(flow?.steps ?? [])]
    .sort((a, b) => a.order - b.order)
    .map((s) => s.title.trim())
    .filter(Boolean)
    .slice(0, 6);

  const lines = [
    `[orchestration-summary] stage=${stage} progress=${progress.percent}% weighted=${progress.weightedScore}/${progress.total}`,
    stepTitles.length ? `flowSteps=${stepTitles.join(" → ")}` : null,
    confirmed.length ? `confirmedSlots=${confirmed.join(",")}` : null,
    partial.length ? `openSlots=${partial.join(",")}` : null,
    stale.length ? `staleSlots=${stale.join(",")}` : null,
    flow?.flowApproved ? "flowApproved=true" : null,
  ].filter(Boolean);

  return lines.join("\n").slice(0, max);
}
