/**
 * Unified Quick Action + free-text dispatch — Intent Router → Registry Guard → execution hints.
 */

import type { FeatureDetailProjectionMetrics } from "@/lib/requirements/featureDetailSlots";
import {
  filterQuickActionsForOrchestrationStage,
  getQuickActionDefinition,
  quickActionFromDefinition,
  quickActionsForConversationState,
  quickActionsToLabels,
  resolveQuickActionIdFromLegacyLabel,
  type QuickAction,
  type QuickActionId,
} from "@/lib/requirements/requirementsQuickActionRegistry";
import {
  getOrchestrationStageDefinition,
  resolveAuthoritativeOrchestrationStage,
  type OrchestrationStage,
} from "@/lib/requirements/requirementsOrchestrationRegistry";
import {
  buildQuickReplyProjection,
  type RequirementsOrchestrationProjection,
} from "@/lib/requirements/requirementsOrchestrationProjection";
import type {
  RequirementsServiceFlowV1,
  RequirementsStateJson,
} from "@/lib/requirements/requirementsStateJson";
import { resolveServiceFlowConversationState } from "@/lib/requirements/serviceFlowConversationState";
import { guardRequirementsAction, type GuardResult } from "@/lib/requirements/requirementsActionGuard";
import {
  intentRouterTimelinePayload,
  isLowConfidenceIntent,
  routeRequirementsIntent,
  routeRequirementsIntentAsync,
  routeRequirementsIntentDirect,
  type IntentRoutingResult,
} from "@/lib/requirements/requirementsIntentRouter";
import {
  filterQuickActionsForChatProjection,
  listAllowedActionIdsForStage,
} from "@/lib/requirements/requirementsQuickActionPolicy";
import { postRequirementsIntentRouter } from "@/lib/requirements/requirementsIntentRouterClient";
import type { RequirementsOrchestrationContextWire } from "@/lib/requirements/requirementsOrchestrationContextWire";
import type { RequirementsIntentRouterInput } from "@/lib/requirements/requirementsIntentRouterTypes";

export type { RequirementsOrchestrationContextWire } from "@/lib/requirements/requirementsOrchestrationContextWire";
export { buildIntentRouterStateFromOrchestrationContext } from "@/lib/requirements/requirementsOrchestrationContextWire";

export type RequirementsIntentDispatchContext = Readonly<{
  readonly authoritativeStage: OrchestrationStage;
  readonly availableActionIds: readonly QuickActionId[];
  readonly chatQuickActions: readonly QuickAction[];
  readonly featureMetrics: FeatureDetailProjectionMetrics;
  readonly projectionSlice: Pick<
    RequirementsOrchestrationProjection,
    "authoritativeStage" | "quickActions" | "featureDetail" | "conversationState"
  >;
}>;

export type RequirementsIntentDispatchResult = Readonly<{
  readonly intent: IntentRoutingResult;
  readonly guard: GuardResult;
  readonly effectiveActionId: QuickActionId | null;
  readonly effectiveQuickAction: QuickAction | null;
  readonly timelineDetail: string;
  readonly userFacingMessage?: string;
  readonly fallbackQuickActions?: readonly QuickAction[];
}>;

export function buildRequirementsIntentDispatchContext(
  state: RequirementsStateJson,
): RequirementsIntentDispatchContext {
  const authoritativeStage = resolveAuthoritativeOrchestrationStage(state);
  const projection = buildQuickReplyProjection({ state, authoritativeStage });
  const conv = state.serviceFlowV1 ? resolveServiceFlowConversationState(state.serviceFlowV1) : "PROPOSAL";
  const raw = quickActionsForConversationState(conv);
  const stageDef = getOrchestrationStageDefinition(authoritativeStage);
  const stageFiltered = filterQuickActionsForOrchestrationStage(authoritativeStage, raw, {
    allowedActionIds: stageDef.allowedActionIds,
    obsoleteActionIds: stageDef.obsoleteActionIds,
  });
  const routerActions = [...stageFiltered];
  for (const viewId of ["OPEN_CANVAS", "OPEN_ARTIFACT_HUB"] as const) {
    if (
      !routerActions.some((a) => a.id === viewId) &&
      (!stageDef.allowedActionIds.length || stageDef.allowedActionIds.includes(viewId))
    ) {
      routerActions.push(quickActionFromDefinition(getQuickActionDefinition(viewId)));
    }
  }
  const availableActionIds = listAllowedActionIdsForStage({
    stage: authoritativeStage,
    candidateActions: routerActions,
    featureMetrics: projection.featureDetail,
  });
  const chatQuickActions = filterQuickActionsForChatProjection(projection.quickActions);
  return {
    authoritativeStage,
    availableActionIds,
    chatQuickActions,
    featureMetrics: projection.featureDetail,
    projectionSlice: {
      authoritativeStage,
      quickActions: chatQuickActions,
      featureDetail: projection.featureDetail,
      conversationState: projection.conversationState,
    },
  };
}

function buildRouterInput(
  input: {
    readonly userMessage: string;
    readonly ctx: RequirementsIntentDispatchContext;
    readonly projectName?: string;
    readonly projectDescription?: string;
  },
): RequirementsIntentRouterInput {
  return {
    userMessage: input.userMessage,
    authoritativeStage: input.ctx.authoritativeStage,
    availableActionIds: input.ctx.availableActionIds,
    chatVisibleActionIds: input.ctx.chatQuickActions.map((a) => a.id),
    projection: input.ctx.projectionSlice,
    featureMetrics: input.ctx.featureMetrics,
    projectName: input.projectName,
    projectDescription: input.projectDescription,
  };
}

function resolveGuardedEffectiveActionId(
  suggested: QuickActionId | null,
  guard: GuardResult,
): QuickActionId | null {
  if (!suggested) return null;
  if (!guard.allowed) return null;
  return guard.effectiveActionId ?? suggested;
}

function finalizeDispatchResult(input: {
  readonly intent: IntentRoutingResult;
  readonly guard: GuardResult;
  readonly ctx: RequirementsIntentDispatchContext;
  readonly directQuickActionLabel?: string | null;
  readonly skipLowConfidenceCheck?: boolean;
}): RequirementsIntentDispatchResult {
  const suggested = input.intent.suggestedActionId;
  const effectiveId = resolveGuardedEffectiveActionId(suggested, input.guard);
  const timelineDetail = intentRouterTimelinePayload(input.intent, input.guard, {
    availableActionIds: input.ctx.availableActionIds,
  });

  if (!effectiveId) {
    const fallbackIds = input.guard.fallbackActionIds ?? [];
    const fallbackQuickActions = fallbackIds
      .map((id) => quickActionFromDefinition(getQuickActionDefinition(id)))
      .filter((a) => input.ctx.availableActionIds.includes(a.id));
    const parts = [input.guard.reason, input.guard.warning, input.intent.clarificationQuestion].filter(Boolean);
    return {
      intent: input.intent,
      guard: input.guard,
      effectiveActionId: null,
      effectiveQuickAction: null,
      timelineDetail,
      userFacingMessage: parts.join("\n") || undefined,
      fallbackQuickActions,
    };
  }

  if (!input.skipLowConfidenceCheck && isLowConfidenceIntent(input.intent)) {
    return {
      intent: input.intent,
      guard: { allowed: false, reason: input.intent.clarificationQuestion },
      effectiveActionId: null,
      effectiveQuickAction: null,
      timelineDetail,
      userFacingMessage: input.intent.clarificationQuestion,
      fallbackQuickActions: input.ctx.chatQuickActions,
    };
  }

  const effectiveQuickAction = quickActionFromDefinition(
    getQuickActionDefinition(effectiveId),
    input.directQuickActionLabel ?? undefined,
  );
  return {
    intent: input.intent,
    guard: input.guard,
    effectiveActionId: effectiveId,
    effectiveQuickAction,
    timelineDetail,
    ...(input.guard.warning ? { userFacingMessage: input.guard.warning } : {}),
  };
}

/** Sync dispatch — deterministic router only (unit tests). */
export function dispatchRequirementsUserIntent(input: {
  readonly userMessage: string;
  readonly directQuickActionId?: QuickActionId | null;
  readonly directQuickActionLabel?: string | null;
  readonly ctx: RequirementsIntentDispatchContext;
}): RequirementsIntentDispatchResult {
  const directId =
    input.directQuickActionId ??
    resolveQuickActionIdFromLegacyLabel(input.directQuickActionLabel) ??
    null;

  const intent: IntentRoutingResult =
    directId && input.ctx.availableActionIds.includes(directId) ?
      routeRequirementsIntentDirect(buildRouterInput({ userMessage: input.userMessage, ctx: input.ctx }), directId)
    : routeRequirementsIntent(buildRouterInput({ userMessage: input.userMessage, ctx: input.ctx }));

  const suggested = intent.suggestedActionId;
  const guard: GuardResult =
    suggested ?
      guardRequirementsAction({
        suggestedActionId: suggested,
        authoritativeStage: input.ctx.authoritativeStage,
        availableActionIds: input.ctx.availableActionIds,
        featureMetrics: input.ctx.featureMetrics,
      })
    : { allowed: false, reason: intent.clarificationQuestion ?? "요청을 이해하지 못했습니다." };

  return finalizeDispatchResult({
    intent,
    guard,
    ctx: input.ctx,
    directQuickActionLabel: input.directQuickActionLabel,
    skipLowConfidenceCheck: Boolean(directId),
  });
}

/** Async dispatch — LLM router for free text; direct path skips LLM. */
export async function dispatchRequirementsUserIntentAsync(input: {
  readonly userMessage: string;
  readonly directQuickActionId?: QuickActionId | null;
  readonly directQuickActionLabel?: string | null;
  readonly ctx: RequirementsIntentDispatchContext;
  readonly projectId: string;
  readonly projectName?: string;
  readonly projectDescription?: string;
  readonly orchestrationContext?: RequirementsOrchestrationContextWire;
  readonly serviceFlowV1?: RequirementsServiceFlowV1 | null;
}): Promise<RequirementsIntentDispatchResult> {
  const directId =
    input.directQuickActionId ??
    resolveQuickActionIdFromLegacyLabel(input.directQuickActionLabel) ??
    null;

  const routerInput = buildRouterInput({
    userMessage: input.userMessage,
    ctx: input.ctx,
    projectName: input.projectName,
    projectDescription: input.projectDescription,
  });

  let intent: IntentRoutingResult;
  if (directId && input.ctx.availableActionIds.includes(directId)) {
    intent = routeRequirementsIntentDirect(routerInput, directId);
  } else {
    const llmRes = await postRequirementsIntentRouter({
      projectId: input.projectId,
      projectName: input.projectName,
      projectDescription: input.projectDescription,
      userMessage: input.userMessage,
      authoritativeStage: input.ctx.authoritativeStage,
      availableActionIds: input.ctx.availableActionIds,
      chatVisibleActionIds: input.ctx.chatQuickActions.map((a) => a.id),
      conversationState: input.ctx.projectionSlice.conversationState,
      featureMetrics: input.ctx.featureMetrics,
    });
    intent =
      llmRes.ok ? llmRes.intent : (
        await routeRequirementsIntentAsync(routerInput, { skipLlm: true })
      );
  }

  const guardSuggested = intent.suggestedActionId;
  const guard: GuardResult =
    guardSuggested ?
      guardRequirementsAction({
        suggestedActionId: guardSuggested,
        authoritativeStage: input.ctx.authoritativeStage,
        availableActionIds: input.ctx.availableActionIds,
        featureMetrics: input.ctx.featureMetrics,
      })
    : { allowed: false, reason: intent.clarificationQuestion ?? "요청을 이해하지 못했습니다." };

  return finalizeDispatchResult({
    intent,
    guard,
    ctx: input.ctx,
    directQuickActionLabel: input.directQuickActionLabel,
    skipLowConfidenceCheck: Boolean(directId),
  });
}

export function fallbackQuickReplyLabels(actions: readonly QuickAction[] | undefined): readonly string[] {
  if (!actions?.length) return [];
  return quickActionsToLabels(actions);
}

export function buildIntentRouterPromptTimelineEntry(input: {
  readonly userMessage: string;
  readonly dispatch: RequirementsIntentDispatchResult;
}): {
  readonly stage: "service-flow";
  readonly action: "intentRouterGuard";
  readonly source: "system";
  readonly promptText: string;
  readonly responseText: string;
} {
  return {
    stage: "service-flow",
    action: "intentRouterGuard",
    source: "system",
    promptText: input.userMessage.slice(0, 500),
    responseText: input.dispatch.timelineDetail,
  };
}
