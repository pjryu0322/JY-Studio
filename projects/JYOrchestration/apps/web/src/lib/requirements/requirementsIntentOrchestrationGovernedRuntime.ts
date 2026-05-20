/**
 * Phase 4 governed runtime — aggregation, governance, replay, instrumentation on top of phase 3.
 */

import type { GuardResult } from "@/lib/requirements/requirementsActionGuard";
import { buildPrioritizedRecommendationQueue } from "@/lib/requirements/requirementsActionRecommendation";
import { buildArtifactHubOrchestrationState } from "@/lib/requirements/requirementsArtifactHubOrchestration";
import { buildArtifactVersionLineage } from "@/lib/requirements/requirementsArtifactVersionLineage";
import { resolveContestedFocus } from "@/lib/requirements/requirementsFocusPriority";
import { mergeGovernedRecommendations } from "@/lib/requirements/requirementsRecommendationGovernance";
import { applyGovernanceResolverToScore } from "@/lib/requirements/requirementsStageGovernanceResolver";
import { buildOrchestrationReplaySnapshot } from "@/lib/requirements/requirementsOrchestrationReplay";
import type { OrchestrationRuntimeMetrics } from "@/lib/requirements/requirementsOrchestrationInstrumentation";
import { applyIntentOrchestrationPhase3 } from "@/lib/requirements/requirementsIntentOrchestrationRuntime";
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

export function applyIntentOrchestrationGoverned(input: {
  readonly before: RequirementsIntentOrchestrationV1 | null | undefined;
  /** Pre-merged patch from dispatch (clarification, focus, summary) — defaults to `before`. */
  readonly base?: RequirementsIntentOrchestrationV1;
  readonly routingState: RequirementsStateJson;
  readonly userMessage: string;
  readonly intent: IntentRoutingResult;
  readonly guard: GuardResult;
  readonly effectiveActionId: import("@/lib/requirements/requirementsQuickActionRegistry").QuickActionId | null;
  readonly clarificationResolved: boolean;
  readonly nextFocus?: ConversationFocusWire;
  readonly featureMetrics: FeatureDetailProjectionMetrics;
  readonly availableActionIds: readonly import("@/lib/requirements/requirementsQuickActionRegistry").QuickActionId[];
  readonly runtimeMetrics?: OrchestrationRuntimeMetrics;
  readonly nowMs?: number;
}): RequirementsIntentOrchestrationV1 {
  const nowMs = input.nowMs ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const stage = resolveAuthoritativeOrchestrationStage(input.routingState);
  const artifactHub = buildArtifactHubOrchestrationState({ state: input.routingState });

  const inferred = inferFocusFromMessage(input.userMessage, {
    orchestration: input.before,
    featureDetailSlotsV1: input.routingState.featureDetailSlotsV1,
    serviceFlowV1: input.routingState.serviceFlowV1,
  });

  const contested = resolveContestedFocus({
    orchestration: input.before,
    featureDetailSlotsV1: input.routingState.featureDetailSlotsV1,
    serviceFlowV1: input.routingState.serviceFlowV1,
    inferred,
  });

  const rawQueue = buildPrioritizedRecommendationQueue({
    stage,
    metrics: input.featureMetrics,
    availableActionIds: input.availableActionIds,
    artifactHub,
    orchestration: input.before,
    lastIntentActionId: input.intent.suggestedActionId,
    nowIso,
  });

  const governedQueue = mergeGovernedRecommendations({
    incoming: rawQueue.map((r) => ({
      actionId: r.actionId,
      score: applyGovernanceResolverToScore({
        stage,
        actionId: r.actionId,
        score: r.score,
        clarificationPending: input.before?.clarification?.pending,
      }),
      reason: r.reason,
      blocking: r.blocking,
      generatedAt: r.generatedAt,
      targetKey: contested?.id,
      disposition: "pending" as const,
    })),
    previous: input.before?.recommendationQueue,
    nowIso,
  });

  const phase3Base = mergeIntentOrchestrationPatch(input.base ?? input.before, {
    activeFocus: contested ?? input.nextFocus,
    recommendationQueue: governedQueue,
  });

  let orch = applyIntentOrchestrationPhase3({
    base: phase3Base,
    routingState: input.routingState,
    userMessage: input.userMessage,
    intent: input.intent,
    guard: input.guard,
    effectiveActionId: input.effectiveActionId,
    clarificationResolved: input.clarificationResolved,
    nextFocus: contested ?? input.nextFocus,
    featureMetrics: input.featureMetrics,
    availableActionIds: input.availableActionIds,
    nowMs,
  });

  orch = mergeIntentOrchestrationPatch(orch, {
    artifactLifecycle: buildArtifactVersionLineage({
      state: input.routingState,
      stage,
      prev: orch.artifactLifecycle,
      nowIso,
    }),
    lastReplaySnapshot: buildOrchestrationReplaySnapshot({
      before: input.before,
      after: orch,
      triggerMessage: input.userMessage,
      triggerAction: input.effectiveActionId,
      decisionSource: input.intent.routerMode,
      agentRole: "orchestration-planner",
      actorId: "system",
      nowIso,
    }),
    lastRuntimeMetrics: input.runtimeMetrics,
    lastRouting: {
      routerMode: input.intent.routerMode,
      routingReason: input.intent.explainability?.routingReason ?? input.intent.reason,
      guardReason: input.guard.reason,
      fallbackReason: input.intent.explainability?.fallbackReason,
      focusReason: input.intent.explainability?.focusReason,
      confidenceFactors: input.intent.confidenceFactors,
      at: nowIso,
      actorId: "system",
      agentRole: "orchestration-planner",
      decisionSource: input.intent.routerMode,
    },
  });

  return orch;
}
