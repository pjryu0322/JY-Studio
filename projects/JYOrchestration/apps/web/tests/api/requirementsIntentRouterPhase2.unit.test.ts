import { describe, expect, it, beforeEach } from "vitest";
import { buildProactiveActionRecommendations } from "@/lib/requirements/requirementsActionRecommendation";
import { buildArtifactHubOrchestrationState } from "@/lib/requirements/requirementsArtifactHubOrchestration";
import { buildOrchestrationConversationMemory } from "@/lib/requirements/requirementsConversationMemory";
import { inferFocusFromMessage, messageRefersToActiveFocus } from "@/lib/requirements/requirementsConversationFocus";
import {
  buildClarificationPendingState,
  tryResolveClarification,
} from "@/lib/requirements/requirementsIntentClarification";
import {
  clearIntentRouterCache,
  getCachedIntentRoute,
  intentRouterCacheSize,
  setCachedIntentRoute,
} from "@/lib/requirements/requirementsIntentRouterCache";
import { mapLlmFailureToRouterMode } from "@/lib/requirements/requirementsIntentRouterTypes";
import { routeRequirementsIntentDeterministic } from "@/lib/requirements/requirementsIntentRouterDeterministic";
import {
  buildRequirementsIntentDispatchContext,
  dispatchRequirementsUserIntent,
} from "@/lib/requirements/requirementsIntentDispatch";
import { routeRequirementsIntentAsync } from "@/lib/requirements/requirementsIntentRouter";
import { mergeIntentOrchestrationPatch } from "@/lib/requirements/requirementsIntentOrchestrationWire";
import {
  projectFeatureDetailMetrics,
  seedFeatureDetailSlotsFromServiceFlow,
} from "@/lib/requirements/featureDetailSlots";
import type { RequirementsIntentRouterInput } from "@/lib/requirements/requirementsIntentRouterTypes";
import {
  createSampleServiceFlow,
  ORCHESTRATION_REGRESSION_NOW,
} from "../orchestration/helpers/orchestrationRegressionHarness";

const now = ORCHESTRATION_REGRESSION_NOW;

function featureDetailState(confirmedCount: number) {
  const flow = createSampleServiceFlow({ conversationState: "FEATURE_DETAIL" });
  const seeded = seedFeatureDetailSlotsFromServiceFlow(flow, now);
  return {
    serviceFlowV1: flow,
    requirementsOrchestrationStageV1: { activePhase: "FEATURE_DETAIL", updatedAt: now },
    featureDetailSlotsV1: {
      ...seeded,
      slots: seeded.slots.map((s, i) => ({
        ...s,
        status: i < confirmedCount ? ("confirmed" as const) : s.status,
        updatedAt: now,
      })),
      focusFeatureId: seeded.slots[0]?.id,
    },
  };
}

describe("intent router phase 2", () => {
  beforeEach(() => clearIntentRouterCache());

  it("A: multi-turn context continuity via focus + deictic message", () => {
    const state = featureDetailState(1);
    const slot = state.featureDetailSlotsV1!.slots[0]!;
    const memory = buildOrchestrationConversationMemory({
      state,
      recentMessageLines: [{ role: "user", body: "업로드 기능 먼저 보자" }],
      orchestration: mergeIntentOrchestrationPatch(null, {
        activeFocus: { type: "feature", id: slot.id, label: slot.title },
        lastSuggestedActionId: "DEFINE_SCREEN",
      }),
    });
    const ctx = buildRequirementsIntentDispatchContext(state);
    const input: RequirementsIntentRouterInput = {
      userMessage: "그건 PDF도 가능해야 해",
      authoritativeStage: ctx.authoritativeStage,
      availableActionIds: ctx.availableActionIds,
      chatVisibleActionIds: ctx.chatQuickActions.map((a) => a.id),
      projection: ctx.projectionSlice,
      featureMetrics: ctx.featureMetrics,
      conversationMemory: memory,
      activeFocus: memory.activeFocus,
    };
    expect(messageRefersToActiveFocus("그건 PDF도 가능해야 해")).toBe(true);
    const intent = routeRequirementsIntentDeterministic(input);
    expect(intent.suggestedActionId).toBe("EDIT_FEATURES");
    expect(intent.explainability?.focusReason).toContain("activeFocus");
  });

  it("B: clarification resolution flow", () => {
    const clarification = buildClarificationPendingState({
      question: "어떤 작업을 진행할까요?",
      candidateActionIds: ["EDIT_FEATURES", "DEFINE_SCREEN"],
    });
    const resolved = tryResolveClarification({
      userMessage: "화면 정의",
      clarification,
      availableActionIds: ["EDIT_FEATURES", "DEFINE_SCREEN", "DEFINE_API"],
    });
    expect(resolved?.suggestedActionId).toBe("DEFINE_SCREEN");
    expect(resolved?.routerMode).toBe("deterministic");
  });

  it("C: focus-based routing infers feature from title in message", () => {
    const state = featureDetailState(1);
    const slot = state.featureDetailSlotsV1!.slots[0]!;
    const focus = inferFocusFromMessage(`「${slot.title}」 수정하자`, {
      orchestration: null,
      featureDetailSlotsV1: state.featureDetailSlotsV1,
      serviceFlowV1: state.serviceFlowV1,
    });
    expect(focus?.id).toBe(slot.id);
  });

  it("D: router cache reuses result for same utterance", () => {
    const state = featureDetailState(1);
    const ctx = buildRequirementsIntentDispatchContext(state);
    const input: RequirementsIntentRouterInput = {
      userMessage: "화면으로 넘어가자",
      authoritativeStage: ctx.authoritativeStage,
      availableActionIds: ctx.availableActionIds,
      chatVisibleActionIds: ctx.chatQuickActions.map((a) => a.id),
      projection: ctx.projectionSlice,
      featureMetrics: ctx.featureMetrics,
    };
    const first = routeRequirementsIntentDeterministic(input);
    setCachedIntentRoute(input, first);
    expect(intentRouterCacheSize()).toBe(1);
    const cached = getCachedIntentRoute(input);
    expect(cached?.suggestedActionId).toBe(first.suggestedActionId);
    expect(cached?.reason).toContain("cached");
  });

  it("E: timeout fallback metadata maps from LLM failure code", () => {
    expect(mapLlmFailureToRouterMode("NETWORK")).toBe("timeout_fallback");
    expect(mapLlmFailureToRouterMode("HTTP_429")).toBe("rate_limit_fallback");
    expect(mapLlmFailureToRouterMode("PARSE")).toBe("invalid_json_fallback");
  });

  it("F: artifact hub orchestration state exposes generatable count", () => {
    const state = featureDetailState(1);
    const hub = buildArtifactHubOrchestrationState({ state });
    expect(hub.badgeEligible).toBe(true);
    expect(hub.generatableCount).toBeGreaterThan(0);
  });

  it("G: proactive recommendation suggests DEFINE_SCREEN when coverage high", () => {
    const state = featureDetailState(2);
    const metrics = projectFeatureDetailMetrics(state.featureDetailSlotsV1);
    const ctx = buildRequirementsIntentDispatchContext(state);
    const recs = buildProactiveActionRecommendations({
      stage: ctx.authoritativeStage,
      metrics: { ...metrics, featureCoverage: 0.85, hasConfirmedFeature: true },
      availableActionIds: ctx.availableActionIds,
    });
    expect(recs.some((r) => r.actionId === "DEFINE_SCREEN")).toBe(true);
  });

  it("dispatch persists clarification pending on low confidence", () => {
    const state = featureDetailState(1);
    const ctx = buildRequirementsIntentDispatchContext(state);
    const dispatch = dispatchRequirementsUserIntent({
      userMessage: "음... 뭔가",
      ctx,
      routingState: state,
    });
    expect(dispatch.intentOrchestrationPatch?.clarification?.pending).toBe(true);
    expect(dispatch.timelineDetail).toContain("routerMode:");
  });

  it("async fallback routerMode when LLM caller returns null", async () => {
    const state = featureDetailState(1);
    const ctx = buildRequirementsIntentDispatchContext(state);
    const input: RequirementsIntentRouterInput = {
      userMessage: "뭔가 이상한 말을 함",
      authoritativeStage: ctx.authoritativeStage,
      availableActionIds: ctx.availableActionIds,
      chatVisibleActionIds: ctx.chatQuickActions.map((a) => a.id),
      projection: ctx.projectionSlice,
      featureMetrics: ctx.featureMetrics,
    };
    const intent = await routeRequirementsIntentAsync(input, {
      llmCaller: async () => null,
    });
    expect(intent.routerMode).toBe("fallback");
  });
});
