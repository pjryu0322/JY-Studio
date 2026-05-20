/**
 * Phase 3 orchestration runtime — focus drift, clarification lifecycle, recommendations, compaction.
 */

import type { OrchestrationStage } from "@/lib/requirements/requirementsOrchestrationRegistry";
import type { GuardResult } from "@/lib/requirements/requirementsActionGuard";
import {
  buildPrioritizedRecommendationQueue,
  type OrchestrationRecommendation,
} from "@/lib/requirements/requirementsActionRecommendation";
import { buildArtifactHubOrchestrationState } from "@/lib/requirements/requirementsArtifactHubOrchestration";
import { buildArtifactLifecycleEntries } from "@/lib/requirements/requirementsArtifactLifecycle";
import { applyFocusDriftToOrchestration } from "@/lib/requirements/requirementsFocusDrift";
import { tickClarificationOnUserMessage } from "@/lib/requirements/requirementsClarificationLifecycle";
import { compactRequirementsIntentOrchestration } from "@/lib/requirements/requirementsOrchestrationCompaction";
import { recoverRequirementsIntentOrchestration } from "@/lib/requirements/requirementsOrchestrationRecovery";
import type { IntentRoutingResult } from "@/lib/requirements/requirementsIntentRouterTypes";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { FeatureDetailProjectionMetrics } from "@/lib/requirements/featureDetailSlots";
import { resolveAuthoritativeOrchestrationStage } from "@/lib/requirements/requirementsOrchestrationRegistry";
import { inferFocusFromMessage } from "@/lib/requirements/requirementsConversationFocus";
import {
  mergeIntentOrchestrationPatch,
  type ConversationFocusWire,
  type RequirementsIntentOrchestrationV1,
} from "@/lib/requirements/requirementsIntentOrchestrationWire";

export function applyIntentOrchestrationPhase3(input: {
  readonly base: RequirementsIntentOrchestrationV1;
  readonly routingState: RequirementsStateJson;
  readonly userMessage: string;
  readonly intent: IntentRoutingResult;
  readonly guard: GuardResult;
  readonly effectiveActionId: import("@/lib/requirements/requirementsQuickActionRegistry").QuickActionId | null;
  readonly clarificationResolved: boolean;
  readonly nextFocus?: ConversationFocusWire;
  readonly featureMetrics: FeatureDetailProjectionMetrics;
  readonly availableActionIds: readonly import("@/lib/requirements/requirementsQuickActionRegistry").QuickActionId[];
  readonly nowMs?: number;
}): RequirementsIntentOrchestrationV1 {
  const nowMs = input.nowMs ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const stage = resolveAuthoritativeOrchestrationStage(input.routingState);
  const artifactHub = buildArtifactHubOrchestrationState({ state: input.routingState });

  const inferredId = inferFocusFromMessage(input.userMessage, {
    orchestration: input.base,
    featureDetailSlotsV1: input.routingState.featureDetailSlotsV1,
    serviceFlowV1: input.routingState.serviceFlowV1,
  })?.id;

  let orch = applyFocusDriftToOrchestration({
    orch: input.base,
    currentStage: stage,
    nextFocus: input.nextFocus,
    referencedFocus: input.intent.routerMode === "clarification_resolution" || Boolean(inferredId),
    inferredFocusId: inferredId,
    nowIso,
  });

  const clarTick = tickClarificationOnUserMessage({
    clarification: orch.clarification,
    treatedAsResolution: input.clarificationResolved,
    nowMs,
  });
  if (clarTick.clarification !== undefined) {
    orch = { ...orch, clarification: clarTick.clarification };
  }

  const queue: readonly OrchestrationRecommendation[] = buildPrioritizedRecommendationQueue({
    stage,
    metrics: input.featureMetrics,
    availableActionIds: input.availableActionIds,
    artifactHub,
    orchestration: orch,
    lastIntentActionId: input.intent.suggestedActionId,
  });

  const transitions = [...(orch.recentTransitions ?? [])];
  transitions.push(`route:${input.intent.routerMode}`);
  if (input.effectiveActionId) transitions.push(`dispatch:${input.effectiveActionId}`);
  if (clarTick.timelineNote) transitions.push(clarTick.timelineNote);

  orch = mergeIntentOrchestrationPatch(orch, {
    recommendationQueue: queue,
    artifactLifecycle: buildArtifactLifecycleEntries({
      state: input.routingState,
      stage,
      prev: orch.artifactLifecycle,
      nowIso,
    }),
    recentTransitions: transitions,
    lastSuggestedActionId: input.intent.suggestedActionId,
    lastConfirmedActionId: input.effectiveActionId ?? orch.lastConfirmedActionId ?? null,
    lastRouting: {
      routerMode: input.intent.routerMode,
      routingReason: input.intent.explainability?.routingReason ?? input.intent.reason,
      guardReason: input.guard.reason,
      fallbackReason: input.intent.explainability?.fallbackReason,
      focusReason: input.intent.explainability?.focusReason,
      confidenceFactors: input.intent.confidenceFactors,
      at: nowIso,
    },
  });

  return compactRequirementsIntentOrchestration(orch, nowMs);
}

export function ensureRecoveredIntentOrchestration(
  prev: RequirementsIntentOrchestrationV1 | null | undefined,
): RequirementsIntentOrchestrationV1 {
  return recoverRequirementsIntentOrchestration(prev);
}
