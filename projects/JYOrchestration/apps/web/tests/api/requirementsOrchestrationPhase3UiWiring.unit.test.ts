import { describe, expect, it } from "vitest";
import { artifactHubTopChromeBadgeCount } from "@/lib/requirements/requirementsArtifactHubOrchestration";
import { buildArtifactHubOrchestrationState } from "@/lib/requirements/requirementsArtifactHubOrchestration";
import {
  buildClarificationUserMessage,
  buildOrchestrationUiProjection,
} from "@/lib/requirements/requirementsOrchestrationUiProjection";
import { compactRequirementsIntentOrchestration } from "@/lib/requirements/requirementsOrchestrationCompaction";
import { splitPrioritizedRecommendations } from "@/lib/requirements/requirementsActionRecommendation";
import {
  buildOrchestrationRecoveryTimelineEntry,
  buildOrchestrationTimelineViewModel,
  isOrchestrationTraceTimelineEntry,
  parseOrchestrationTimelineDetail,
} from "@/lib/requirements/requirementsOrchestrationTimelineView";
import { applyIntentOrchestrationPhase3 } from "@/lib/requirements/requirementsIntentOrchestrationRuntime";
import { mergeIntentOrchestrationPatch } from "@/lib/requirements/requirementsIntentOrchestrationWire";
import {
  mergeRequirementsStateJson,
  parseRequirementsStateJson,
} from "@/lib/requirements/requirementsStateJson";
import { buildRequirementsIntentDispatchContext, dispatchRequirementsUserIntent } from "@/lib/requirements/requirementsIntentDispatch";
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

describe("orchestration phase3 UI wiring", () => {
  it("A: phase3 fields survive parse after persist merge", () => {
    const patch = mergeIntentOrchestrationPatch(null, {
      orchestrationSessionId: "sess-ui",
      activeFocus: {
        type: "feature",
        id: "f1",
        confidence: 0.8,
        softStale: true,
        referenceCount: 2,
        lastReferencedAt: now,
      },
      clarification: {
        pending: true,
        question: "어떤 기능?",
        createdAt: now,
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
      },
      recommendationQueue: [
        {
          actionId: "DEFINE_SCREEN",
          score: 90,
          reason: "화면 정의 권장",
          blocking: false,
          generatedAt: now,
        },
      ],
      artifactLifecycle: [
        {
          artifactKey: "project-artifacts",
          generated: true,
          stale: true,
          sourceStage: "FEATURE_DETAIL",
          sourceHash: "h1",
        },
      ],
    });
    const merged = mergeRequirementsStateJson({ serviceFlowV1: null }, { requirementsIntentOrchestrationV1: patch });
    const parsed = parseRequirementsStateJson(merged);
    expect(parsed?.requirementsIntentOrchestrationV1?.activeFocus?.softStale).toBe(true);
    expect(parsed?.requirementsIntentOrchestrationV1?.recommendationQueue?.[0]?.actionId).toBe("DEFINE_SCREEN");
    expect(parsed?.requirementsIntentOrchestrationV1?.artifactLifecycle?.[0]?.stale).toBe(true);
    expect(parsed?.requirementsIntentOrchestrationV1?.orchestrationSessionId).toBe("sess-ui");
  });

  it("B: softStale focus surfaces UI banner projection", () => {
    const state = featureDetailState(1);
    const ui = buildOrchestrationUiProjection({
      state: {
        ...state,
        requirementsIntentOrchestrationV1: mergeIntentOrchestrationPatch(null, {
          activeFocus: { type: "feature", id: "x", label: "업로드", softStale: true },
        }),
      },
    });
    expect(ui.focusDrift?.message).toContain("오래");
  });

  it("C: clarification abandoned produces user-facing message", () => {
    const msg = buildClarificationUserMessage({
      pending: false,
      abandoned: true,
      userMessage: "",
    });
    expect(msg).toContain("만료");
  });

  it("D: only top recommendation is primary for chat projection", () => {
    const queue = [
      { actionId: "DEFINE_SCREEN" as const, score: 90, reason: "a", blocking: false, generatedAt: now },
      { actionId: "DEFINE_API" as const, score: 70, reason: "b", blocking: false, generatedAt: now },
    ];
    const split = splitPrioritizedRecommendations(queue);
    expect(split.primary?.actionId).toBe("DEFINE_SCREEN");
    expect(split.secondary).toHaveLength(1);
  });

  it("E: stale artifact count affects TopChrome badge", () => {
    const state = featureDetailState(1);
    const hub = buildArtifactHubOrchestrationState({ state });
    const withStale = { ...hub, staleArtifactCount: 2, generatableCount: 1 };
    expect(artifactHubTopChromeBadgeCount(1, withStale)).toBeGreaterThanOrEqual(2);
  });

  it("F: timeline view model groups orchestration traces", () => {
    const entry = buildOrchestrationRecoveryTimelineEntry({
      sessionId: "s1",
      recoveredAt: now,
    });
    expect(isOrchestrationTraceTimelineEntry(entry)).toBe(true);
    const vm = buildOrchestrationTimelineViewModel([entry]);
    expect(vm.groups.some((g) => g.group === "Recovery")).toBe(true);
    const parsed = parseOrchestrationTimelineDetail(entry.responseText);
    expect(parsed.humanReadableReason).toContain("복구");
  });

  it("G: dispatch applies compaction via phase3 runtime", () => {
    const state = featureDetailState(1);
    const ctx = buildRequirementsIntentDispatchContext(state);
    const dispatch = dispatchRequirementsUserIntent({
      userMessage: "API 정의",
      ctx,
      routingState: state,
    });
    const patch = dispatch.intentOrchestrationPatch;
    expect(patch?.recommendationQueue?.length).toBeGreaterThan(0);
    const bloated = mergeIntentOrchestrationPatch(patch, {
      recentConversationSummary: "x".repeat(3000),
      recentTransitions: Array.from({ length: 30 }, (_, i) => `t${i}`),
    });
    const compact = compactRequirementsIntentOrchestration(bloated);
    expect((compact.recentConversationSummary?.length ?? 0)).toBeLessThanOrEqual(2001);
    expect((compact.recentTransitions?.length ?? 0)).toBeLessThanOrEqual(12);
  });

  it("H: recovery timeline entry uses Recovery group", () => {
    const entry = buildOrchestrationRecoveryTimelineEntry({
      sessionId: "abc",
      recoveredAt: now,
    });
    expect(entry.orchestrationTraceGroup).toBe("Recovery");
    expect(entry.action).toBe("orchestrationRecovery");
  });

  it("phase3 runtime preserves session on apply", () => {
    const state = featureDetailState(1);
    const ctx = buildRequirementsIntentDispatchContext(state);
    const base = mergeIntentOrchestrationPatch(null, { orchestrationSessionId: "keep-me" });
    const applied = applyIntentOrchestrationPhase3({
      base,
      routingState: state,
      userMessage: "화면",
      intent: {
        intentType: "orchestration_action",
        suggestedActionId: "DEFINE_SCREEN",
        confidence: 0.9,
        routerMode: "deterministic",
      },
      guard: { allowed: true },
      effectiveActionId: "DEFINE_SCREEN",
      clarificationResolved: false,
      featureMetrics: ctx.featureMetrics,
      availableActionIds: ctx.availableActionIds,
    });
    expect(applied.orchestrationSessionId).toBe("keep-me");
    expect(applied.recommendationQueue?.length).toBeGreaterThan(0);
  });
});
