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
import { buildProactiveActionRecommendations } from "@/lib/requirements/requirementsActionRecommendation";
import { buildArtifactHubOrchestrationState } from "@/lib/requirements/requirementsArtifactHubOrchestration";
import {
  buildOrchestrationConversationMemory,
  compressRecentMessagesForMemory,
} from "@/lib/requirements/requirementsConversationMemory";
import { inferFocusFromMessage, updateFocusAfterAction } from "@/lib/requirements/requirementsConversationFocus";
import {
  buildClarificationPendingState,
  buildTargetResolutionClarification,
  clearClarificationState,
  isAmbiguousTargetEditRequest,
} from "@/lib/requirements/requirementsIntentClarification";
import {
  mergeIntentOrchestrationPatch,
  type RequirementsIntentOrchestrationV1,
} from "@/lib/requirements/requirementsIntentOrchestrationWire";
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
  readonly intentOrchestrationPatch?: RequirementsIntentOrchestrationV1;
  readonly proactiveRecommendations?: readonly string[];
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

function buildRouterInput(input: {
  readonly userMessage: string;
  readonly ctx: RequirementsIntentDispatchContext;
  readonly routingState?: RequirementsStateJson;
  readonly recentMessageLines?: readonly { readonly role: "user" | "ai"; readonly body: string }[];
  readonly projectName?: string;
  readonly projectDescription?: string;
}): RequirementsIntentRouterInput {
  const state = input.routingState;
  const memory = state
    ? buildOrchestrationConversationMemory({
        state,
        recentMessageLines: input.recentMessageLines,
        orchestration: state.requirementsIntentOrchestrationV1,
      })
    : undefined;
  const focusCtx = state
    ? {
        orchestration: state.requirementsIntentOrchestrationV1,
        featureDetailSlotsV1: state.featureDetailSlotsV1,
        serviceFlowV1: state.serviceFlowV1,
      }
    : null;
  const focus = focusCtx ? inferFocusFromMessage(input.userMessage, focusCtx) : null;
  const artifactHubState = state ? buildArtifactHubOrchestrationState({ state }) : undefined;
  return {
    userMessage: input.userMessage,
    authoritativeStage: input.ctx.authoritativeStage,
    availableActionIds: input.ctx.availableActionIds,
    chatVisibleActionIds: input.ctx.chatQuickActions.map((a) => a.id),
    projection: input.ctx.projectionSlice,
    featureMetrics: input.ctx.featureMetrics,
    projectName: input.projectName,
    projectDescription: input.projectDescription,
    conversationMemory: memory,
    activeFocus: focus,
    artifactHubState,
    featureDetailSlotsV1: state?.featureDetailSlotsV1,
  };
}

function buildIntentOrchestrationPatchAfterDispatch(input: {
  readonly prev: RequirementsIntentOrchestrationV1 | null | undefined;
  readonly intent: IntentRoutingResult;
  readonly guard: GuardResult;
  readonly effectiveActionId: QuickActionId | null;
  readonly userMessage: string;
  readonly recentMessageLines?: readonly { readonly role: "user" | "ai"; readonly body: string }[];
  readonly routingState?: RequirementsStateJson;
  readonly lowConfidenceClarification?: boolean;
}): RequirementsIntentOrchestrationV1 {
  const summary = compressRecentMessagesForMemory(input.recentMessageLines ?? []);
  const focus =
    input.routingState && input.effectiveActionId ?
      updateFocusAfterAction({
        actionId: input.effectiveActionId,
        focus: inferFocusFromMessage(input.userMessage, {
          orchestration: input.prev,
          featureDetailSlotsV1: input.routingState.featureDetailSlotsV1,
          serviceFlowV1: input.routingState.serviceFlowV1,
        }),
        featureDetailSlotsV1: input.routingState.featureDetailSlotsV1,
      })
    : input.prev?.activeFocus;

  const focusCtx = input.routingState
    ? {
        orchestration: input.prev,
        featureDetailSlotsV1: input.routingState.featureDetailSlotsV1,
        serviceFlowV1: input.routingState.serviceFlowV1,
      }
    : null;
  const hasFocus = Boolean(focusCtx && inferFocusFromMessage(input.userMessage, focusCtx)?.id);
  const targetResolutionPending =
    input.lowConfidenceClarification &&
    isAmbiguousTargetEditRequest(input.userMessage, hasFocus);
  const clarification =
    targetResolutionPending ?
      buildTargetResolutionClarification({
        question: input.intent.clarificationQuestion ?? "어떤 항목을 수정할까요?",
      })
    : input.lowConfidenceClarification && input.intent.clarificationQuestion ?
      buildClarificationPendingState({
        question: input.intent.clarificationQuestion,
        candidateActionIds:
          input.guard.fallbackActionIds ??
          (input.routingState ?
            buildRequirementsIntentDispatchContext(input.routingState).chatQuickActions.map((a) => a.id)
          : undefined),
      })
    : input.intent.routerMode === "clarification_resolution" ? clearClarificationState()
    : input.effectiveActionId ? clearClarificationState()
    : input.prev?.clarification;

  return mergeIntentOrchestrationPatch(input.prev, {
    activeFocus: focus,
    recentConversationSummary: summary,
    lastSuggestedActionId: input.intent.suggestedActionId,
    lastConfirmedActionId: input.effectiveActionId ?? input.prev?.lastConfirmedActionId ?? null,
    clarification,
    lastRouting: {
      routerMode: input.intent.routerMode,
      routingReason: input.intent.explainability?.routingReason ?? input.intent.reason,
      guardReason: input.guard.reason,
      fallbackReason: input.intent.explainability?.fallbackReason,
      focusReason: input.intent.explainability?.focusReason,
      confidenceFactors: input.intent.confidenceFactors,
      at: new Date().toISOString(),
    },
  });
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
  readonly routingState?: RequirementsStateJson;
  readonly userMessage?: string;
  readonly recentMessageLines?: readonly { readonly role: "user" | "ai"; readonly body: string }[];
}): RequirementsIntentDispatchResult {
  const suggested = input.intent.suggestedActionId;
  const effectiveId = resolveGuardedEffectiveActionId(suggested, input.guard);
  const artifactHub = input.routingState
    ? buildArtifactHubOrchestrationState({ state: input.routingState })
    : undefined;
  const proactive = buildProactiveActionRecommendations({
    stage: input.ctx.authoritativeStage,
    metrics: input.ctx.featureMetrics,
    availableActionIds: input.ctx.availableActionIds,
    artifactHub,
  });
  const proactiveLabel = proactive[0]?.reason;
  const focusLabel = input.routingState
    ? (() => {
        const f = inferFocusFromMessage(input.userMessage ?? "", {
          orchestration: input.routingState!.requirementsIntentOrchestrationV1,
          featureDetailSlotsV1: input.routingState!.featureDetailSlotsV1,
          serviceFlowV1: input.routingState!.serviceFlowV1,
        });
        return f ? `${f.type}:${f.id}` : undefined;
      })()
    : undefined;
  const timelineDetail = intentRouterTimelinePayload(input.intent, input.guard, {
    availableActionIds: input.ctx.availableActionIds,
    proactiveRecommendation: proactiveLabel,
    activeFocus: focusLabel,
    clarificationPending: input.routingState?.requirementsIntentOrchestrationV1?.clarification?.pending === true,
  });
  const lowConfidence = !input.skipLowConfidenceCheck && isLowConfidenceIntent(input.intent);
  const orchPatch =
    input.routingState && input.userMessage ?
      buildIntentOrchestrationPatchAfterDispatch({
        prev: input.routingState.requirementsIntentOrchestrationV1,
        intent: input.intent,
        guard: input.guard,
        effectiveActionId: effectiveId,
        userMessage: input.userMessage,
        recentMessageLines: input.recentMessageLines,
        routingState: input.routingState,
        lowConfidenceClarification: lowConfidence && !effectiveId,
      })
    : undefined;

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
      ...(orchPatch ? { intentOrchestrationPatch: orchPatch } : {}),
      proactiveRecommendations: proactive.map((p) => p.reason),
    };
  }

  if (lowConfidence) {
    return {
      intent: input.intent,
      guard: { allowed: false, reason: input.intent.clarificationQuestion },
      effectiveActionId: null,
      effectiveQuickAction: null,
      timelineDetail,
      userFacingMessage: input.intent.clarificationQuestion,
      fallbackQuickActions: input.ctx.chatQuickActions,
      ...(orchPatch ? { intentOrchestrationPatch: orchPatch } : {}),
      proactiveRecommendations: proactive.map((p) => p.reason),
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
    ...(orchPatch ? { intentOrchestrationPatch: orchPatch } : {}),
    proactiveRecommendations: proactive.map((p) => p.reason),
  };
}

/** Sync dispatch — deterministic router only (unit tests). */
export function dispatchRequirementsUserIntent(input: {
  readonly userMessage: string;
  readonly directQuickActionId?: QuickActionId | null;
  readonly directQuickActionLabel?: string | null;
  readonly ctx: RequirementsIntentDispatchContext;
  readonly routingState?: RequirementsStateJson;
  readonly recentMessageLines?: readonly { readonly role: "user" | "ai"; readonly body: string }[];
}): RequirementsIntentDispatchResult {
  const directId =
    input.directQuickActionId ??
    resolveQuickActionIdFromLegacyLabel(input.directQuickActionLabel) ??
    null;

  const routerInput = buildRouterInput({
    userMessage: input.userMessage,
    ctx: input.ctx,
    routingState: input.routingState,
    recentMessageLines: input.recentMessageLines,
  });
  const intent: IntentRoutingResult =
    directId && input.ctx.availableActionIds.includes(directId) ?
      routeRequirementsIntentDirect(routerInput, directId)
    : routeRequirementsIntent(routerInput, {
        clarification: input.routingState?.requirementsIntentOrchestrationV1?.clarification,
      });

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
    routingState: input.routingState,
    userMessage: input.userMessage,
    recentMessageLines: input.recentMessageLines,
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
  readonly routingState?: RequirementsStateJson;
  readonly recentMessageLines?: readonly { readonly role: "user" | "ai"; readonly body: string }[];
}): Promise<RequirementsIntentDispatchResult> {
  const directId =
    input.directQuickActionId ??
    resolveQuickActionIdFromLegacyLabel(input.directQuickActionLabel) ??
    null;

  const routingState =
    input.routingState ??
    buildIntentRouterStateFromOrchestrationContext(input.serviceFlowV1 ?? null, input.orchestrationContext);

  const routerInput = buildRouterInput({
    userMessage: input.userMessage,
    ctx: input.ctx,
    routingState,
    recentMessageLines: input.recentMessageLines,
    projectName: input.projectName,
    projectDescription: input.projectDescription,
  });

  const clarification = routingState.requirementsIntentOrchestrationV1?.clarification;

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
      conversationMemory: routerInput.conversationMemory,
      clarification,
    });
    intent =
      llmRes.ok ? llmRes.intent : (
        await routeRequirementsIntentAsync(routerInput, {
          skipLlm: true,
          clarification,
        })
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
    routingState,
    userMessage: input.userMessage,
    recentMessageLines: input.recentMessageLines,
  });
}

export function fallbackQuickReplyLabels(actions: readonly QuickAction[] | undefined): readonly string[] {
  if (!actions?.length) return [];
  return quickActionsToLabels(actions);
}

export function buildIntentRouterPromptTimelineEntry(input: {
  readonly userMessage: string;
  readonly dispatch: RequirementsIntentDispatchResult;
  readonly createdAt?: string;
}): import("@/lib/requirements/requirementsStateJson").RequirementsPromptTimelineEntry {
  const now = input.createdAt ?? new Date().toISOString();
  const routerMode = input.dispatch.intent.routerMode;
  return {
    stage: "service-flow",
    stageGroup: "service-planning",
    workspaceScreenKey: "service_flow_workshop",
    action: "intentRouterGuard",
    source: "system",
    provider: "internal",
    createdAt: now,
    routingDecision: routerMode,
    promptText: input.userMessage.slice(0, 500),
    responseText: input.dispatch.timelineDetail,
  };
}
