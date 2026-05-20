import { describe, expect, it, beforeEach } from "vitest";
import {
  artifactHubTopChromeBadgeCount,
  buildArtifactHubOrchestrationState,
} from "@/lib/requirements/requirementsArtifactHubOrchestration";
import { buildProactiveActionRecommendations } from "@/lib/requirements/requirementsActionRecommendation";
import { inferFocusFromMessage } from "@/lib/requirements/requirementsConversationFocus";
import {
  buildTargetResolutionClarification,
  tryResolveClarification,
} from "@/lib/requirements/requirementsIntentClarification";
import {
  clearIntentRouterCache,
  getCachedIntentRoute,
  intentRouterCacheFingerprint,
  setCachedIntentRoute,
} from "@/lib/requirements/requirementsIntentRouterCache";
import { routeRequirementsIntentDeterministic } from "@/lib/requirements/requirementsIntentRouterDeterministic";
import {
  buildIntentRouterPromptTimelineEntry,
  buildRequirementsIntentDispatchContext,
  dispatchRequirementsUserIntent,
} from "@/lib/requirements/requirementsIntentDispatch";
import { buildIntentRouterStateFromOrchestrationContext } from "@/lib/requirements/requirementsOrchestrationContextWire";
import { mergeIntentOrchestrationPatch } from "@/lib/requirements/requirementsIntentOrchestrationWire";
import {
  parseRequirementsStateJson,
  mergeRequirementsStateJson,
} from "@/lib/requirements/requirementsStateJson";
import {
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
        title: i === 0 ? "업로드 기능" : s.title,
        status: i < confirmedCount ? ("confirmed" as const) : s.status,
        updatedAt: now,
      })),
      focusFeatureId: seeded.slots[0]?.id,
    },
  };
}

describe("intent router phase2 runtime wiring", () => {
  beforeEach(() => clearIntentRouterCache());

  it("A: requirementsIntentOrchestrationV1 survives parse round-trip", () => {
    const patch = mergeIntentOrchestrationPatch(null, {
      activeFocus: { type: "feature", id: "upload_feature", label: "업로드" },
      clarification: buildTargetResolutionClarification(),
      lastConfirmedActionId: "EDIT_FEATURES",
    });
    const merged = mergeRequirementsStateJson(
      { serviceFlowV1: null },
      { requirementsIntentOrchestrationV1: patch },
    );
    const parsed = parseRequirementsStateJson({
      serviceFlowV1: null,
      requirementsIntentOrchestrationV1: merged.requirementsIntentOrchestrationV1,
    });
    expect(parsed?.requirementsIntentOrchestrationV1?.activeFocus?.id).toBe("upload_feature");
    expect(parsed?.requirementsIntentOrchestrationV1?.clarification?.pending).toBe(true);
    expect(parsed?.requirementsIntentOrchestrationV1?.clarification?.topic).toBe("target_resolution");
    expect(parsed?.requirementsIntentOrchestrationV1?.lastConfirmedActionId).toBe("EDIT_FEATURES");
  });

  it("B: deictic utterance keeps upload_feature focus for edit routing", () => {
    const state = featureDetailState(1);
    const slot = state.featureDetailSlotsV1!.slots[0]!;
    const orch = mergeIntentOrchestrationPatch(null, {
      activeFocus: { type: "feature", id: slot.id, label: slot.title },
    });
    const ctx = buildRequirementsIntentDispatchContext({ ...state, requirementsIntentOrchestrationV1: orch });
    const input: RequirementsIntentRouterInput = {
      userMessage: "그건 PDF도 가능해야 해",
      authoritativeStage: ctx.authoritativeStage,
      availableActionIds: ctx.availableActionIds,
      chatVisibleActionIds: ctx.chatQuickActions.map((a) => a.id),
      projection: ctx.projectionSlice,
      featureMetrics: ctx.featureMetrics,
      activeFocus: orch.activeFocus,
    };
    const intent = routeRequirementsIntentDeterministic(input);
    expect(intent.suggestedActionId).toBe("EDIT_FEATURES");
    expect(intent.explainability?.focusReason).toContain(slot.id);
  });

  it("C: ambiguous edit → pending → resolution clears pending", () => {
    const state = {
      ...featureDetailState(1),
      featureDetailSlotsV1: {
        ...featureDetailState(1).featureDetailSlotsV1!,
        focusFeatureId: null,
      },
    };
    const ctx = buildRequirementsIntentDispatchContext(state);
    const ambiguous = dispatchRequirementsUserIntent({
      userMessage: "그거 수정해줘",
      ctx,
      routingState: state,
    });
    expect(ambiguous.intentOrchestrationPatch?.clarification?.pending).toBe(true);
    expect(ambiguous.intentOrchestrationPatch?.clarification?.topic).toBe("target_resolution");

    const withPending = {
      ...state,
      requirementsIntentOrchestrationV1: ambiguous.intentOrchestrationPatch,
    };
    const resolved = tryResolveClarification({
      userMessage: "업로드 기능",
      clarification: withPending.requirementsIntentOrchestrationV1?.clarification,
      availableActionIds: ctx.availableActionIds,
      featureDetailSlotsV1: state.featureDetailSlotsV1,
    });
    expect(resolved?.routerMode).toBe("clarification_resolution");
    expect(resolved?.suggestedActionId).toBe("EDIT_FEATURES");

    const after = dispatchRequirementsUserIntent({
      userMessage: "업로드 기능",
      ctx: buildRequirementsIntentDispatchContext(withPending),
      routingState: withPending,
    });
    expect(after.intent.routerMode).toBe("clarification_resolution");
    expect(after.intentOrchestrationPatch?.clarification?.pending).toBe(false);
  });

  it("D: cache miss when activeFocus changes", () => {
    const state = featureDetailState(1);
    const ctx = buildRequirementsIntentDispatchContext(state);
    const base: RequirementsIntentRouterInput = {
      userMessage: "화면으로 넘어가자",
      authoritativeStage: ctx.authoritativeStage,
      availableActionIds: ctx.availableActionIds,
      chatVisibleActionIds: ctx.chatQuickActions.map((a) => a.id),
      projection: ctx.projectionSlice,
      featureMetrics: ctx.featureMetrics,
      activeFocus: { type: "feature", id: "f1", label: "A" },
    };
    setCachedIntentRoute(base, routeRequirementsIntentDeterministic(base));
    const shifted = { ...base, activeFocus: { type: "feature", id: "f2", label: "B" } };
    expect(intentRouterCacheFingerprint(base)).not.toBe(intentRouterCacheFingerprint(shifted));
    expect(getCachedIntentRoute(shifted)).toBeNull();
    const hit = getCachedIntentRoute(base);
    expect(hit?.routerMode).toBe("cache");
  });

  it("E: TopChrome badge uses max(catalog, generatableCount)", () => {
    const state = featureDetailState(1);
    const hub = buildArtifactHubOrchestrationState({ state });
    expect(artifactHubTopChromeBadgeCount(2, { ...hub, generatableCount: 3 })).toBe(3);
    expect(hub.badgeEligible).toBe(true);
  });

  it("F: proactive recommendation does not imply stage transition", () => {
    const state = featureDetailState(2);
    const ctx = buildRequirementsIntentDispatchContext(state);
    const recs = buildProactiveActionRecommendations({
      stage: ctx.authoritativeStage,
      metrics: ctx.featureMetrics,
      availableActionIds: ctx.availableActionIds,
    });
    expect(recs.length).toBeGreaterThan(0);
    for (const r of recs) {
      expect(r.actionId).not.toMatch(/TRANSITION|ADVANCE/i);
    }
    const dispatch = dispatchRequirementsUserIntent({
      userMessage: "안녕",
      ctx,
      routingState: state,
    });
    expect(dispatch.effectiveActionId).toBeNull();
    expect(state.requirementsOrchestrationStageV1?.activePhase).toBe("FEATURE_DETAIL");
  });

  it("G: timeline entry includes routerMode and guard metadata with createdAt", () => {
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
    expect(entry.routingDecision).toBe(dispatch.intent.routerMode);
    expect(entry.responseText).toContain("routerMode:");
    expect(entry.responseText).toContain("guardAllowed:");
    expect(entry.source).toBe("system");
    expect(entry.provider).toBe("internal");
  });

  it("orchestration context wire includes intent orchestration", () => {
    const state = featureDetailState(1);
    const orch = mergeIntentOrchestrationPatch(null, {
      activeFocus: { type: "feature", id: "x", label: "Y" },
    });
    const built = buildIntentRouterStateFromOrchestrationContext(state.serviceFlowV1, {
      featureDetailSlotsV1: state.featureDetailSlotsV1,
      requirementsIntentOrchestrationV1: orch,
    });
    expect(built.requirementsIntentOrchestrationV1?.activeFocus?.id).toBe("x");
    const focus = inferFocusFromMessage("그건 수정", {
      orchestration: built.requirementsIntentOrchestrationV1,
      featureDetailSlotsV1: built.featureDetailSlotsV1,
      serviceFlowV1: built.serviceFlowV1,
    });
    expect(focus?.id).toBe("x");
  });
});
