import { describe, expect, it } from "vitest";
import { guardRequirementsAction } from "@/lib/requirements/requirementsActionGuard";
import {
  buildIntentRouterPromptTimelineEntry,
  buildRequirementsIntentDispatchContext,
  dispatchRequirementsUserIntent,
} from "@/lib/requirements/requirementsIntentDispatch";
import { routeRequirementsIntentAsync } from "@/lib/requirements/requirementsIntentRouter";
import { routeRequirementsIntentDeterministic } from "@/lib/requirements/requirementsIntentRouterDeterministic";
import {
  filterQuickActionsForChatProjection,
  getQuickActionPolicy,
} from "@/lib/requirements/requirementsQuickActionPolicy";
import { buildQuickReplyProjection } from "@/lib/requirements/requirementsOrchestrationProjection";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import {
  projectFeatureDetailMetrics,
  seedFeatureDetailSlotsFromServiceFlow,
} from "@/lib/requirements/featureDetailSlots";
import {
  createSampleServiceFlow,
  ORCHESTRATION_REGRESSION_NOW,
} from "../orchestration/helpers/orchestrationRegressionHarness";

const now = ORCHESTRATION_REGRESSION_NOW;

function featureDetailState(confirmedCount: number): RequirementsStateJson {
  const flow = createSampleServiceFlow({ conversationState: "FEATURE_DETAIL" });
  const seeded = seedFeatureDetailSlotsFromServiceFlow(flow, now);
  const featureDetailSlotsV1 = {
    ...seeded,
    slots: seeded.slots.map((s, i) => ({
      ...s,
      status: i < confirmedCount ? ("confirmed" as const) : s.status,
      updatedAt: now,
    })),
  };
  return {
    serviceFlowV1: flow,
    requirementsOrchestrationStageV1: {
      activePhase: "FEATURE_DETAIL",
      updatedAt: now,
    },
    featureDetailSlotsV1,
  };
}

function routerInputFromState(state: RequirementsStateJson, userMessage: string) {
  const ctx = buildRequirementsIntentDispatchContext(state);
  return {
    userMessage,
    authoritativeStage: ctx.authoritativeStage,
    availableActionIds: ctx.availableActionIds,
    chatVisibleActionIds: ctx.chatQuickActions.map((a) => a.id),
    projection: ctx.projectionSlice,
    featureMetrics: ctx.featureMetrics,
  };
}

describe("requirementsIntentRouter + guard follow-up", () => {
  it("A: free text infers DEFINE_SCREEN (deterministic / fallback)", () => {
    const state = featureDetailState(1);
    const input = routerInputFromState(state, "이 기능 먼저 화면으로 보고 싶어");
    const intent = routeRequirementsIntentDeterministic(input);
    expect(intent.suggestedActionId).toBe("DEFINE_SCREEN");
    const guard = guardRequirementsAction({
      suggestedActionId: intent.suggestedActionId!,
      authoritativeStage: input.authoritativeStage,
      availableActionIds: input.availableActionIds,
      featureMetrics: input.featureMetrics,
    });
    expect(guard.allowed).toBe(true);
  });

  it("B: document request redirects to OPEN_ARTIFACT_HUB, not GENERATE_DOCUMENT", () => {
    const state = featureDetailState(0);
    const ctx = buildRequirementsIntentDispatchContext(state);
    const dispatch = dispatchRequirementsUserIntent({
      userMessage: "문서로 만들어줘",
      ctx,
    });
    expect(dispatch.intent.suggestedActionId).toBe("OPEN_ARTIFACT_HUB");
    expect(dispatch.effectiveActionId).toBe("OPEN_ARTIFACT_HUB");
    expect(dispatch.effectiveActionId).not.toBe("GENERATE_DOCUMENT");
  });

  it("C: guard rejects DEFINE_SCREEN without confirmed features → EDIT_FEATURES fallback", () => {
    const state = featureDetailState(0);
    const ctx = buildRequirementsIntentDispatchContext(state);
    const guard = guardRequirementsAction({
      suggestedActionId: "DEFINE_SCREEN",
      authoritativeStage: ctx.authoritativeStage,
      availableActionIds: [...ctx.availableActionIds, "DEFINE_SCREEN"],
      featureMetrics: ctx.featureMetrics,
    });
    expect(guard.allowed).toBe(false);
    expect(guard.fallbackActionIds).toContain("EDIT_FEATURES");

    const dispatch = dispatchRequirementsUserIntent({
      userMessage: "화면 정의하자",
      ctx,
    });
    expect(dispatch.effectiveActionId).toBeNull();
  });

  it("D: quick action direct path uses routerMode direct", () => {
    const state = featureDetailState(1);
    const ctx = buildRequirementsIntentDispatchContext(state);
    const dispatch = dispatchRequirementsUserIntent({
      userMessage: "기능 수정",
      directQuickActionId: "EDIT_FEATURES",
      ctx,
    });
    expect(dispatch.intent.routerMode).toBe("direct");
    expect(dispatch.effectiveActionId).toBe("EDIT_FEATURES");
    expect(dispatch.guard.allowed).toBe(true);
  });

  it("E: low confidence returns clarification", () => {
    const state = featureDetailState(1);
    const ctx = buildRequirementsIntentDispatchContext(state);
    const dispatch = dispatchRequirementsUserIntent({
      userMessage: "음... 뭔가 해줘",
      ctx,
    });
    expect(dispatch.effectiveActionId).toBeNull();
    expect(dispatch.userFacingMessage || dispatch.intent.clarificationQuestion).toBeTruthy();
  });

  it("F: timeline metadata includes routerMode and guard fields", () => {
    const state = featureDetailState(1);
    const ctx = buildRequirementsIntentDispatchContext(state);
    const dispatch = dispatchRequirementsUserIntent({
      userMessage: "API 정의 시작",
      ctx,
    });
    const entry = buildIntentRouterPromptTimelineEntry({
      userMessage: "API 정의 시작",
      dispatch,
    });
    expect(entry.createdAt).toBeTruthy();
    expect(entry.routingDecision).toBeTruthy();
    expect(entry.responseText).toContain("routerMode:");
    expect(entry.responseText).toContain("guardAllowed:");
    expect(entry.responseText).toContain("availableActionIds:");
    expect(dispatch.timelineDetail).toContain("routerMode:");
    expect(dispatch.timelineDetail).toContain("proactiveRecommendation:");
  });

  it("artifact actions hidden from chat projection", () => {
    const state = featureDetailState(1);
    const projection = buildQuickReplyProjection({
      state,
      authoritativeStage: "FEATURE_DETAIL",
    });
    expect(projection.quickActions.map((a) => a.id)).not.toContain("GENERATE_DOCUMENT");
    expect(getQuickActionPolicy("EXPORT_PDF").chatChipVisible).toBe(false);
    const filtered = filterQuickActionsForChatProjection([
      { id: "GENERATE_DOCUMENT", label: "문서 생성" },
      { id: "EXPORT_PDF", label: "PDF Export" },
      { id: "EDIT_FEATURES", label: "기능 수정" },
    ]);
    expect(filtered.map((a) => a.id)).toEqual(["EDIT_FEATURES"]);
  });

  it("LLM path uses injectable caller and falls back on failure", async () => {
    const state = featureDetailState(1);
    const input = routerInputFromState(state, "화면으로 넘어가자");
    const intent = await routeRequirementsIntentAsync(input, {
      skipLlm: true,
      llmCaller: async () => null,
    });
    expect(intent.routerMode).toBe("fallback");
    expect(intent.suggestedActionId).toBe("DEFINE_SCREEN");
  });

  it("guard redirects GENERATE_DOCUMENT suggestion to Artifact Hub", () => {
    const state = featureDetailState(1);
    const metrics = projectFeatureDetailMetrics(state.featureDetailSlotsV1);
    const guard = guardRequirementsAction({
      suggestedActionId: "GENERATE_DOCUMENT",
      authoritativeStage: "FEATURE_DETAIL",
      availableActionIds: ["EDIT_FEATURES", "OPEN_ARTIFACT_HUB", "GENERATE_DOCUMENT"],
      featureMetrics: metrics,
    });
    expect(guard.allowed).toBe(true);
    expect(guard.effectiveActionId).toBe("OPEN_ARTIFACT_HUB");
  });
});
