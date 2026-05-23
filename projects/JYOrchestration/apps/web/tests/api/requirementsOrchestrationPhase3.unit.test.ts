import { describe, expect, it, beforeEach } from "vitest";
import { buildPrioritizedRecommendationQueue, splitPrioritizedRecommendations } from "@/lib/requirements/requirementsActionRecommendation";
import {
  artifactLifecycleHasStale,
  buildArtifactLifecycleEntries,
  computeOrchestrationSourceHash,
} from "@/lib/requirements/requirementsArtifactLifecycle";
import {
  abandonClarification,
  enrichClarificationWithLifecycle,
  tickClarificationOnUserMessage,
} from "@/lib/requirements/requirementsClarificationLifecycle";
import { applyFocusDriftToOrchestration, detectFocusSoftStale } from "@/lib/requirements/requirementsFocusDrift";
import {
  buildIntentRouterPromptTimelineEntry,
  dispatchRequirementsUserIntent,
  buildRequirementsIntentDispatchContext,
} from "@/lib/requirements/requirementsIntentDispatch";
import {
  clearIntentRouterCache,
  intentRouterCacheFingerprint,
  intentRouterCacheProjectionHash,
} from "@/lib/requirements/requirementsIntentRouterCache";
import { INTENT_ROUTER_CACHE_SCHEMA_VERSION } from "@/lib/requirements/requirementsOrchestrationConstants";
import { compactRequirementsIntentOrchestration } from "@/lib/requirements/requirementsOrchestrationCompaction";
import { buildOrchestrationHumanExplainability } from "@/lib/requirements/requirementsOrchestrationExplainability";
import { recoverRequirementsIntentOrchestration } from "@/lib/requirements/requirementsOrchestrationRecovery";
import {
  formatOrchestrationTimelineResponse,
  orchestrationTimelineGroupForAction,
} from "@/lib/requirements/requirementsOrchestrationTimeline";
import { mergeIntentOrchestrationPatch, parseRequirementsIntentOrchestrationV1 } from "@/lib/requirements/requirementsIntentOrchestrationWire";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { seedFeatureDetailSlotsFromServiceFlow } from "@/lib/requirements/featureDetailSlots";
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
      focusFeatureId: null,
    },
  };
}

describe("orchestration runtime phase 3", () => {
  beforeEach(() => clearIntentRouterCache());

  it("A: focus stale detection after turns without reference", () => {
    const orch = mergeIntentOrchestrationPatch(null, {
      activeFocus: {
        type: "feature",
        id: "f1",
        label: "Upload",
        focusSetAtStage: "FEATURE_DETAIL",
        lastReferencedAt: now,
      },
      turnCount: 10,
      lastFocusReferencedTurn: 0,
    });
    expect(
      detectFocusSoftStale({
        orch,
        currentStage: "FEATURE_DETAIL",
      }),
    ).toBe(true);
    const updated = applyFocusDriftToOrchestration({
      orch,
      currentStage: "SCREEN_DEFINE",
      nowIso: now,
    });
    expect(updated.activeFocus?.softStale).toBe(true);
  });

  it("B: clarification abandonment after unrelated messages", () => {
    const nowMs = Date.now();
    const c = enrichClarificationWithLifecycle(
      {
        pending: true,
        topic: "target_resolution",
        question: "어떤 항목?",
        askedAt: new Date(nowMs).toISOString(),
      },
      nowMs,
    );
    let current = c;
    let event: string | undefined;
    for (let i = 0; i < 3; i++) {
      const tick = tickClarificationOnUserMessage({
        clarification: current,
        treatedAsResolution: false,
        nowMs,
      });
      current = tick.clarification!;
      event = tick.event;
    }
    expect(event).toBe("abandoned_unrelated");
    expect(current.abandoned).toBe(true);
    expect(current.pending).toBe(false);
  });

  it("B2: clarification timeout abandonment", () => {
    const expired = abandonClarification({
      clarification: enrichClarificationWithLifecycle({
        pending: true,
        question: "q",
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      }),
      reason: "timeout",
    });
    expect(expired.abandonedReason).toBe("timeout");
  });

  it("C: recommendation prioritization orders by score", () => {
    const state = featureDetailState(2);
    const ctx = buildRequirementsIntentDispatchContext(state);
    const queue = buildPrioritizedRecommendationQueue({
      stage: ctx.authoritativeStage,
      metrics: { ...ctx.featureMetrics, featureCoverage: 0.85, hasConfirmedFeature: true },
      availableActionIds: ctx.availableActionIds,
    });
    expect(queue.length).toBeGreaterThan(0);
    expect(queue[0]!.score).toBeGreaterThanOrEqual(queue[queue.length - 1]!.score);
    const split = splitPrioritizedRecommendations(queue);
    expect(split.primary).toBeTruthy();
    expect(split.secondary.length).toBe(queue.length - 1);
  });

  it("D: artifact stale marking on source hash change", () => {
    const state = featureDetailState(1);
    const stage = "FEATURE_DETAIL";
    const first = buildArtifactLifecycleEntries({ state, stage, nowIso: now });
    const hash = computeOrchestrationSourceHash(state);
    expect(first[0]?.sourceHash).toBe(hash);
    const changed = {
      ...state,
      featureDetailSlotsV1: {
        ...state.featureDetailSlotsV1!,
        slots: state.featureDetailSlotsV1!.slots.map((s) => ({ ...s, updatedAt: "2020-01-01T00:00:00.000Z" })),
      },
    };
    const second = buildArtifactLifecycleEntries({ state: changed, stage, prev: first, nowIso: now });
    expect(artifactLifecycleHasStale(second)).toBe(true);
  });

  it("E: runtime recovery assigns session and lastRecoveredAt", () => {
    const orch = mergeIntentOrchestrationPatch(null, {
      activeFocus: { type: "feature", id: "a", label: "A" },
      clarification: { pending: true, question: "q", askedAt: now },
      recommendationQueue: [
        {
          actionId: "EDIT_FEATURES",
          score: 1,
          reason: "r",
          blocking: false,
          generatedAt: now,
        },
      ],
    });
    const recovered = recoverRequirementsIntentOrchestration(orch);
    expect(recovered.orchestrationSessionId).toBeTruthy();
    expect(recovered.lastRecoveredAt).toBeTruthy();
    const reparsed = parseRequirementsStateJson({
      serviceFlowV1: null,
      requirementsIntentOrchestrationV1: recovered,
    });
    expect(reparsed?.requirementsIntentOrchestrationV1?.orchestrationSessionId).toBe(
      recovered.orchestrationSessionId,
    );
    const firstRecoveredAt = reparsed?.requirementsIntentOrchestrationV1?.lastRecoveredAt;
    const reparsedAgain = parseRequirementsStateJson({
      serviceFlowV1: null,
      requirementsIntentOrchestrationV1: reparsed?.requirementsIntentOrchestrationV1,
    });
    expect(reparsedAgain?.requirementsIntentOrchestrationV1?.lastRecoveredAt).toBe(firstRecoveredAt);
  });

  it("F: orchestration compaction trims long summary", () => {
    const orch = mergeIntentOrchestrationPatch(null, {
      recentConversationSummary: "x".repeat(3000),
      recentTransitions: Array.from({ length: 20 }, (_, i) => `t${i}`),
    });
    const compact = compactRequirementsIntentOrchestration(orch);
    expect((compact.recentConversationSummary?.length ?? 0)).toBeLessThanOrEqual(2001);
    expect((compact.recentTransitions?.length ?? 0)).toBeLessThanOrEqual(12);
  });

  it("G: cache invalidation on schema / projection change", () => {
    const state = featureDetailState(1);
    const ctx = buildRequirementsIntentDispatchContext(state);
    const input = {
      userMessage: "화면",
      authoritativeStage: ctx.authoritativeStage,
      availableActionIds: ctx.availableActionIds,
      chatVisibleActionIds: ctx.chatQuickActions.map((a) => a.id),
      projection: ctx.projectionSlice,
      featureMetrics: ctx.featureMetrics,
    };
    const h1 = intentRouterCacheProjectionHash(input);
    const h2 = intentRouterCacheProjectionHash({
      ...input,
      authoritativeStage: "SCREEN_DEFINE",
    });
    expect(h1).not.toBe(h2);
    expect(intentRouterCacheFingerprint(input)).toContain(`v${INTENT_ROUTER_CACHE_SCHEMA_VERSION}`);
  });

  it("H: timeline grouping metadata", () => {
    expect(orchestrationTimelineGroupForAction("intentRouterGuard")).toBe("Intent Routing");
    const formatted = formatOrchestrationTimelineResponse({
      group: "Clarification",
      detail: "routerMode:deterministic",
      humanReadableReason: "확인 필요",
    });
    expect(formatted).toContain("orchestrationGroup:Clarification");
    expect(formatted).toContain("humanReadableReason:");
  });

  it("I: human-readable explainability", () => {
    const state = featureDetailState(1);
    const ctx = buildRequirementsIntentDispatchContext(state);
    const dispatch = dispatchRequirementsUserIntent({
      userMessage: "API 정의",
      ctx,
      routingState: state,
    });
    expect(dispatch.humanExplainability?.humanReadableReason).toBeTruthy();
    expect(dispatch.humanExplainability?.humanReadableGuardReason).toBeTruthy();
    const entry = buildIntentRouterPromptTimelineEntry({
      userMessage: "API 정의",
      dispatch,
    });
    expect(entry.orchestrationTraceGroup).toBe("Intent Routing");
    expect(entry.responseText).toContain("humanReadableReason:");
  });

  it("parse preserves phase3 wire fields", () => {
    const raw = mergeIntentOrchestrationPatch(null, {
      orchestrationSessionId: "sess-1",
      activeFocus: {
        type: "feature",
        id: "f1",
        confidence: 0.9,
        softStale: true,
        referenceCount: 2,
      },
      clarification: enrichClarificationWithLifecycle({ pending: true, question: "q" }),
    });
    const parsed = parseRequirementsIntentOrchestrationV1(raw);
    expect(parsed?.activeFocus?.softStale).toBe(true);
    expect(parsed?.activeFocus?.confidence).toBe(0.9);
    expect(parsed?.clarification?.expiresAt).toBeTruthy();
  });
});
