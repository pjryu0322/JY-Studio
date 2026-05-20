import { describe, expect, it } from "vitest";
import { guardRequirementsAction } from "@/lib/requirements/requirementsActionGuard";
import {
  buildIntentRouterPromptTimelineEntry,
  buildRequirementsIntentDispatchContext,
  dispatchRequirementsUserIntent,
} from "@/lib/requirements/requirementsIntentDispatch";
import {
  intentRouterTimelinePayload,
  routeRequirementsIntent,
} from "@/lib/requirements/requirementsIntentRouter";
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

describe("requirementsIntentRouter + guard", () => {
  it("A: free text infers DEFINE_SCREEN", () => {
    const state = featureDetailState(1);
    const ctx = buildRequirementsIntentDispatchContext(state);
    const intent = routeRequirementsIntent({
      userMessage: "화면으로 넘어가자",
      authoritativeStage: ctx.authoritativeStage,
      availableActionIds: ctx.availableActionIds,
      projection: ctx.projectionSlice,
      featureMetrics: ctx.featureMetrics,
    });
    expect(intent.suggestedActionId).toBe("DEFINE_SCREEN");
    expect(intent.confidence).toBeGreaterThan(0.8);
  });

  it("B: guard rejects GENERATE_DOCUMENT without confirmed features and suggests fallbacks", () => {
    const state = featureDetailState(0);
    const metrics = projectFeatureDetailMetrics(state.featureDetailSlotsV1);
    const guard = guardRequirementsAction({
      suggestedActionId: "GENERATE_DOCUMENT",
      authoritativeStage: "FEATURE_DETAIL",
      availableActionIds: ["EDIT_FEATURES", "OPEN_ARTIFACT_HUB", "GENERATE_DOCUMENT"],
      featureMetrics: metrics,
    });
    expect(guard.allowed).toBe(false);
    expect(guard.reason).toMatch(/확정된 기능/);
    expect(guard.fallbackActionIds).toContain("EDIT_FEATURES");
  });

  it("C: document request routes to Artifact Hub when GENERATE_DOCUMENT unavailable", () => {
    const state = featureDetailState(0);
    const ctx = buildRequirementsIntentDispatchContext(state);
    const dispatch = dispatchRequirementsUserIntent({
      userMessage: "문서로 정리해줘",
      ctx,
    });
    expect(dispatch.intent.suggestedActionId).toBe("OPEN_ARTIFACT_HUB");
    expect(dispatch.guard.allowed).toBe(true);
    expect(dispatch.effectiveActionId).toBe("OPEN_ARTIFACT_HUB");
  });

  it("D: quick action and free text share dispatch pipeline", () => {
    const state = featureDetailState(1);
    const ctx = buildRequirementsIntentDispatchContext(state);
    const fromChip = dispatchRequirementsUserIntent({
      userMessage: "화면 정의",
      directQuickActionId: "DEFINE_SCREEN",
      ctx,
    });
    const fromText = dispatchRequirementsUserIntent({
      userMessage: "화면으로 넘어가자",
      ctx,
    });
    expect(fromChip.effectiveActionId).toBe("DEFINE_SCREEN");
    expect(fromText.effectiveActionId).toBe("DEFINE_SCREEN");
    expect(fromChip.guard.allowed).toBe(true);
    expect(fromText.guard.allowed).toBe(true);
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

  it("F: timeline metadata includes intent and guard fields", () => {
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
    expect(entry.action).toBe("intentRouterGuard");
    expect(entry.responseText).toContain("intentType:");
    expect(entry.responseText).toContain("guardAllowed:");
    expect(intentRouterTimelinePayload(dispatch.intent, dispatch.guard)).toBe(entry.responseText);
  });

  it("artifact action is hidden from FEATURE_DETAIL chat chips", () => {
    const state = featureDetailState(1);
    const projection = buildQuickReplyProjection({
      state,
      authoritativeStage: "FEATURE_DETAIL",
    });
    const ids = projection.quickActions.map((a) => a.id);
    expect(ids).not.toContain("GENERATE_DOCUMENT");
    expect(getQuickActionPolicy("GENERATE_DOCUMENT").chatChipVisible).toBe(false);
    const filtered = filterQuickActionsForChatProjection([
      { id: "GENERATE_DOCUMENT", label: "문서 생성" },
      { id: "EDIT_FEATURES", label: "기능 수정" },
    ]);
    expect(filtered.map((a) => a.id)).toEqual(["EDIT_FEATURES"]);
  });
});
