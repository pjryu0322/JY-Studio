/**
 * Governed orchestration aggregate projection — single source for focus/clarification/recs/artifacts/timeline/recovery.
 * Components must not recompute these slices independently.
 */

import { resolveAuthoritativeOrchestrationStage } from "@/lib/requirements/requirementsOrchestrationRegistry";
import { buildPrioritizedRecommendationQueue } from "@/lib/requirements/requirementsActionRecommendation";
import { buildArtifactHubOrchestrationState, artifactHubTopChromeBadgeCount } from "@/lib/requirements/requirementsArtifactHubOrchestration";
import { buildArtifactVersionLineage, artifactLineageLabelKo } from "@/lib/requirements/requirementsArtifactVersionLineage";
import { resolveContestedFocus } from "@/lib/requirements/requirementsFocusPriority";
import { mergeGovernedRecommendations } from "@/lib/requirements/requirementsRecommendationGovernance";
import { applyGovernanceResolverToScore } from "@/lib/requirements/requirementsStageGovernanceResolver";
import { buildFoldedOrchestrationTimeline } from "@/lib/requirements/requirementsOrchestrationTimelineFolding";
import {
  pickOrchestrationPromptTimelineEntries,
  buildOrchestrationTimelineViewModel,
} from "@/lib/requirements/requirementsOrchestrationTimelineView";
import { stageGovernanceFor } from "@/lib/requirements/requirementsStageGovernance";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { FeatureDetailProjectionMetrics } from "@/lib/requirements/featureDetailSlots";
import { projectFeatureDetailMetrics } from "@/lib/requirements/featureDetailSlots";
import type { QuickActionId } from "@/lib/requirements/requirementsQuickActionRegistry";
import type { RequirementsIntentOrchestrationV1 } from "@/lib/requirements/requirementsIntentOrchestrationWire";
import type { OrchestrationReplaySnapshot } from "@/lib/requirements/requirementsOrchestrationReplay";
import type { OrchestrationRuntimeMetrics } from "@/lib/requirements/requirementsOrchestrationInstrumentation";

export type GovernedFocusProjection = Readonly<{
  readonly activeFocus: RequirementsIntentOrchestrationV1["activeFocus"];
  readonly softStale: boolean;
  readonly focusSource?: string;
  readonly focusPriority?: number;
}>;

export type GovernedClarificationProjection = Readonly<{
  readonly pending: boolean;
  readonly abandoned: boolean;
  readonly question?: string;
}>;

export type GovernedRecommendationProjection = Readonly<{
  readonly queue: RequirementsIntentOrchestrationV1["recommendationQueue"];
  readonly primaryReason?: string;
  readonly secondaryReasons: readonly string[];
}>;

export type GovernedArtifactProjection = Readonly<{
  readonly badgeCount: number;
  readonly badgeHasStale: boolean;
  readonly lifecycleLabels: readonly Readonly<{ readonly key: string; readonly hint: string }>[];
}>;

export type GovernedTimelineProjection = Readonly<{
  readonly foldedGroups: ReturnType<typeof buildFoldedOrchestrationTimeline>;
  readonly recentTraceCount: number;
}>;

export type GovernedRecoveryProjection = Readonly<{
  readonly sessionId?: string;
  readonly lastRecoveredAt?: string;
}>;

export type GovernedStageGovernanceProjection = Readonly<{
  readonly stage: ReturnType<typeof resolveAuthoritativeOrchestrationStage>;
  readonly blockedActions: readonly QuickActionId[];
  readonly preferredActions: readonly QuickActionId[];
}>;

export type GovernedMultiAgentProjection = Readonly<{
  readonly actorId?: string;
  readonly agentRole?: string;
  readonly decisionSource?: string;
}>;

export type GovernedOrchestrationAggregateProjection = Readonly<{
  readonly focus: GovernedFocusProjection;
  readonly clarification: GovernedClarificationProjection;
  readonly recommendations: GovernedRecommendationProjection;
  readonly artifacts: GovernedArtifactProjection;
  readonly timeline: GovernedTimelineProjection;
  readonly recovery: GovernedRecoveryProjection;
  readonly stageGovernance: GovernedStageGovernanceProjection;
  readonly multiAgent: GovernedMultiAgentProjection;
  readonly lastReplay?: OrchestrationReplaySnapshot;
  readonly lastRuntimeMetrics?: OrchestrationRuntimeMetrics;
}>;

export function buildGovernedOrchestrationAggregateProjection(input: {
  readonly state: RequirementsStateJson;
  readonly catalogCount?: number;
  readonly availableActionIds?: readonly QuickActionId[];
  readonly drawerFeatureId?: string | null;
}): GovernedOrchestrationAggregateProjection {
  const orch = input.state.requirementsIntentOrchestrationV1;
  const stage = resolveAuthoritativeOrchestrationStage(input.state);
  const metrics: FeatureDetailProjectionMetrics = projectFeatureDetailMetrics(input.state.featureDetailSlotsV1);
  const hub = buildArtifactHubOrchestrationState({ state: input.state });
  const catalog = input.catalogCount ?? 0;

  const contested = resolveContestedFocus({
    orchestration: orch,
    featureDetailSlotsV1: input.state.featureDetailSlotsV1,
    serviceFlowV1: input.state.serviceFlowV1,
    drawerFeatureId: input.drawerFeatureId,
    inferred: orch?.activeFocus ?? null,
  });

  const rawQueue = buildPrioritizedRecommendationQueue({
    stage,
    metrics,
    availableActionIds: input.availableActionIds ?? [],
    artifactHub: hub,
    orchestration: orch,
  });

  const governedQueue = mergeGovernedRecommendations({
    incoming: rawQueue.map((r) => ({
      actionId: r.actionId,
      score: applyGovernanceResolverToScore({
        stage,
        actionId: r.actionId,
        score: r.score,
        clarificationPending: orch?.clarification?.pending,
      }),
      reason: r.reason,
      blocking: r.blocking,
      generatedAt: r.generatedAt,
      targetKey: contested?.id,
      disposition: "pending",
    })),
    previous: orch?.recommendationQueue,
  });

  const lifecycle = buildArtifactVersionLineage({
    state: input.state,
    stage,
    prev: orch?.artifactLifecycle,
  });

  const traces = pickOrchestrationPromptTimelineEntries(input.state.promptTimeline);
  const folded = buildFoldedOrchestrationTimeline(traces);

  const governance = stageGovernanceFor(stage);

  return {
    focus: {
      activeFocus: contested ?? orch?.activeFocus,
      softStale: Boolean(contested?.softStale ?? orch?.activeFocus?.softStale),
      focusSource: contested?.focusSource,
      focusPriority: contested?.focusPriority,
    },
    clarification: {
      pending: orch?.clarification?.pending === true && !orch?.clarification?.abandoned,
      abandoned: orch?.clarification?.abandoned === true,
      question: orch?.clarification?.question,
    },
    recommendations: {
      queue: governedQueue,
      primaryReason: governedQueue[0]?.reason,
      secondaryReasons: governedQueue.slice(1).map((r) => r.reason),
    },
    artifacts: {
      badgeCount: artifactHubTopChromeBadgeCount(catalog, hub),
      badgeHasStale: hub.hasStaleArtifact || lifecycle.some((e) => e.stale),
      lifecycleLabels: lifecycle.map((e) => ({
        key: e.artifactKey,
        hint: artifactLineageLabelKo(e),
      })),
    },
    timeline: {
      foldedGroups: folded,
      recentTraceCount: buildOrchestrationTimelineViewModel(traces).groups.reduce(
        (n, g) => n + g.rows.length,
        0,
      ),
    },
    recovery: {
      sessionId: orch?.orchestrationSessionId,
      lastRecoveredAt: orch?.lastRecoveredAt,
    },
    stageGovernance: {
      stage,
      blockedActions: governance.blockedActions,
      preferredActions: governance.preferredActions,
    },
    multiAgent: {
      actorId: orch?.lastRouting?.actorId ?? "system",
      agentRole: orch?.lastRouting?.agentRole ?? "orchestration-planner",
      decisionSource: orch?.lastRouting?.decisionSource ?? orch?.lastRouting?.routerMode,
    },
    ...(orch?.lastReplaySnapshot ? { lastReplay: orch.lastReplaySnapshot } : {}),
    ...(orch?.lastRuntimeMetrics ? { lastRuntimeMetrics: orch.lastRuntimeMetrics } : {}),
  };
}
