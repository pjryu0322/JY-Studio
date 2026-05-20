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
  type IntentRoutingResult,
} from "@/lib/requirements/requirementsIntentRouter";
import {
  filterQuickActionsForChatProjection,
  listAllowedActionIdsForStage,
} from "@/lib/requirements/requirementsQuickActionPolicy";

export type RequirementsOrchestrationContextWire = Readonly<{
  readonly singleChatOrchestrationV1?: unknown;
  readonly requirementsOrchestrationStageV1?: unknown;
  readonly featurePlanningSlotsV1?: unknown;
  readonly featureDetailSlotsV1?: unknown;
}>;

export function buildIntentRouterStateFromOrchestrationContext(
  flow: RequirementsServiceFlowV1 | null,
  orchCtx: RequirementsOrchestrationContextWire | undefined,
): RequirementsStateJson {
  return {
    serviceFlowV1: flow,
    singleChatOrchestrationV1: orchCtx?.singleChatOrchestrationV1 as RequirementsStateJson["singleChatOrchestrationV1"],
    requirementsOrchestrationStageV1:
      orchCtx?.requirementsOrchestrationStageV1 as RequirementsStateJson["requirementsOrchestrationStageV1"],
    featurePlanningSlotsV1: orchCtx?.featurePlanningSlotsV1 as RequirementsStateJson["featurePlanningSlotsV1"],
    featureDetailSlotsV1: orchCtx?.featureDetailSlotsV1 as RequirementsStateJson["featureDetailSlotsV1"],
  };
}

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

export function dispatchRequirementsUserIntent(input: {
  readonly userMessage: string;
  readonly directQuickActionId?: QuickActionId | null;
  readonly directQuickActionLabel?: string | null;
  readonly ctx: RequirementsIntentDispatchContext;
}): RequirementsIntentDispatchResult {
  const directId =
    input.directQuickActionId ??
    resolveQuickActionIdFromLegacyLabel(input.directQuickActionLabel) ??
    resolveQuickActionIdFromLegacyLabel(input.userMessage);

  const intent: IntentRoutingResult =
    directId && input.ctx.availableActionIds.includes(directId) ?
      {
        intentType: "orchestration_action",
        suggestedActionId: directId,
        confidence: 1,
        reason: "direct quick action",
      }
    : routeRequirementsIntent({
        userMessage: input.userMessage,
        authoritativeStage: input.ctx.authoritativeStage,
        availableActionIds: input.ctx.availableActionIds,
        projection: input.ctx.projectionSlice,
        featureMetrics: input.ctx.featureMetrics,
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

  const timelineDetail = intentRouterTimelinePayload(intent, guard);

  if (!suggested || !guard.allowed) {
    const fallbackIds = guard.fallbackActionIds ?? [];
    const fallbackQuickActions = fallbackIds
      .map((id) => quickActionFromDefinition(getQuickActionDefinition(id)))
      .filter((a) => input.ctx.availableActionIds.includes(a.id));
    const parts = [guard.reason, guard.warning, intent.clarificationQuestion].filter(Boolean);
    return {
      intent,
      guard,
      effectiveActionId: null,
      effectiveQuickAction: null,
      timelineDetail,
      userFacingMessage: parts.join("\n") || undefined,
      fallbackQuickActions,
    };
  }

  if (!directId && isLowConfidenceIntent(intent)) {
    return {
      intent,
      guard: { allowed: false, reason: intent.clarificationQuestion },
      effectiveActionId: null,
      effectiveQuickAction: null,
      timelineDetail,
      userFacingMessage: intent.clarificationQuestion,
      fallbackQuickActions: input.ctx.chatQuickActions,
    };
  }

  const effectiveQuickAction = quickActionFromDefinition(
    getQuickActionDefinition(suggested),
    input.directQuickActionLabel ?? undefined,
  );
  return {
    intent,
    guard,
    effectiveActionId: suggested,
    effectiveQuickAction,
    timelineDetail,
  };
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
