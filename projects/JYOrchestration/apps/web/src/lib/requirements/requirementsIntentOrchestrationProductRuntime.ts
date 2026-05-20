/**
 * Product-grade orchestration runtime — transaction, lifecycle, replay retention, debug, authority.
 */

import type { GuardResult } from "@/lib/requirements/requirementsActionGuard";
import { compactArtifactLineage } from "@/lib/requirements/requirementsArtifactLineageGovernance";
import {
  artifactPropagationLabelsKo,
  buildArtifactDependencyGraph,
} from "@/lib/requirements/requirementsArtifactDependencyGraph";
import { buildHumanReadableDebugSummary } from "@/lib/requirements/requirementsOrchestrationDebug";
import {
  defaultAgentRoleForAction,
  isActionAuthorizedForRole,
} from "@/lib/requirements/requirementsMultiAgentAuthority";
import { markRecommendationsObsolete } from "@/lib/requirements/requirementsRecommendationLifecycle";
import {
  appendReplayWithRetention,
  replayImportanceForTransition,
  type GovernedReplaySnapshot,
} from "@/lib/requirements/requirementsOrchestrationReplayGovernance";
import {
  resolveInstrumentationLevel,
  sampleRuntimeMetrics,
} from "@/lib/requirements/requirementsOrchestrationInstrumentation";
import { buildOrchestrationReplaySnapshot } from "@/lib/requirements/requirementsOrchestrationReplay";
import { resolveStageGovernanceForAction } from "@/lib/requirements/requirementsStageGovernanceResolver";
import { runOrchestrationTransactionPatch } from "@/lib/requirements/requirementsOrchestrationTransaction";
import { applyIntentOrchestrationGoverned } from "@/lib/requirements/requirementsIntentOrchestrationGovernedRuntime";
import type { IntentRoutingResult } from "@/lib/requirements/requirementsIntentRouterTypes";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { FeatureDetailProjectionMetrics } from "@/lib/requirements/featureDetailSlots";
import { resolveAuthoritativeOrchestrationStage } from "@/lib/requirements/requirementsOrchestrationRegistry";
import { computeOrchestrationSourceHash } from "@/lib/requirements/requirementsArtifactLifecycle";
import {
  mergeIntentOrchestrationPatch,
  type ConversationFocusWire,
  type RequirementsIntentOrchestrationV1,
} from "@/lib/requirements/requirementsIntentOrchestrationWire";

export function applyIntentOrchestrationProduct(input: {
  readonly before: RequirementsIntentOrchestrationV1 | null | undefined;
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
  readonly runtimeMetrics?: import("@/lib/requirements/requirementsOrchestrationInstrumentation").OrchestrationRuntimeMetrics;
  readonly debugMode?: boolean;
  readonly nowMs?: number;
}): RequirementsIntentOrchestrationV1 {
  const nowMs = input.nowMs ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const stage = resolveAuthoritativeOrchestrationStage(input.routingState);
  const agentRole = defaultAgentRoleForAction(input.effectiveActionId);
  const actorId = "system";

  if (
    input.effectiveActionId &&
    !isActionAuthorizedForRole({
      role: agentRole,
      actionId: input.effectiveActionId,
      actorId,
    })
  ) {
    const rolled = mergeIntentOrchestrationPatch(input.base ?? input.before, {
      humanReadableDebugSummary: `권한 없음: ${agentRole} cannot run ${input.effectiveActionId}`,
      lastTransaction: {
        transactionId: `tx-deny-${nowMs}`,
        status: "rolled_back",
        startedAt: nowIso,
        endedAt: nowIso,
        steps: ["intent", "guard", "authority:deny", "transaction:rollback"],
        rollbackReason: "unauthorized agent action",
      },
    });
    return rolled;
  }

  const governance =
    input.effectiveActionId ?
      resolveStageGovernanceForAction({
        stage,
        actionId: input.effectiveActionId,
        score: 0,
        clarificationPending: input.before?.clarification?.pending,
      })
    : undefined;

  const { orch, trace, rolledBack } = runOrchestrationTransactionPatch({
    before: input.before,
    apply: () =>
      applyIntentOrchestrationGoverned({
        ...input,
        runtimeMetrics: input.runtimeMetrics,
        nowMs,
      }),
    nowIso,
  });

  const prevHash = input.before ? computeOrchestrationSourceHash(input.routingState) : undefined;
  const nextHash = computeOrchestrationSourceHash(input.routingState);
  const sourceStale = Boolean(prevHash && prevHash !== nextHash);

  const focusKey = orch.activeFocus?.id;
  const cleanedQueue = markRecommendationsObsolete({
    queue: orch.recommendationQueue ?? [],
    stage,
    previousStage: input.before?.lastGovernedStage as typeof stage | undefined,
    focusTargetKey: focusKey,
    previousFocusTargetKey: input.before?.activeFocus?.id,
    sourceStale,
    nowIso,
  });

  const lineage = compactArtifactLineage(orch.artifactLifecycle);
  const deps = buildArtifactDependencyGraph({
    state: input.routingState,
    lifecycle: lineage,
    flowChanged: sourceStale,
  });
  const propagation = artifactPropagationLabelsKo(deps);

  const lastTransition = orch.recentTransitions?.[orch.recentTransitions.length - 1];
  const snapshot = buildOrchestrationReplaySnapshot({
    before: input.before,
    after: orch,
    triggerMessage: input.userMessage,
    triggerAction: input.effectiveActionId,
    decisionSource: input.intent.routerMode,
    agentRole,
    actorId,
    nowIso,
  }) as GovernedReplaySnapshot;

  const governedSnapshot: GovernedReplaySnapshot = {
    ...snapshot,
    replayImportance: replayImportanceForTransition(lastTransition),
  };

  const replayHistory = appendReplayWithRetention({
    history: input.before?.replayHistory,
    snapshot: governedSnapshot,
  });

  const level = resolveInstrumentationLevel(input.debugMode);
  const metrics = sampleRuntimeMetrics(
    { ...orch.lastRuntimeMetrics, ...input.runtimeMetrics },
    level,
  );

  const debugSummary = buildHumanReadableDebugSummary({
    orch: { ...orch, recommendationQueue: cleanedQueue },
    intent: input.intent,
    guard: input.guard,
    governance,
    propagation,
    transaction: trace,
  });

  return mergeIntentOrchestrationPatch(orch, {
    recommendationQueue: cleanedQueue,
    artifactLifecycle: lineage,
    artifactDependencies: deps,
    replayHistory,
    lastReplaySnapshot: governedSnapshot,
    lastRuntimeMetrics: metrics,
    lastGovernedStage: stage,
    humanReadableDebugSummary: debugSummary,
    lastTransaction: trace,
    lastRouting: {
      ...orch.lastRouting,
      actorId,
      agentRole,
      decisionSource: rolledBack ? "rollback" : input.intent.routerMode,
      at: nowIso,
    },
  });
}
