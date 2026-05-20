import { describe, expect, it, beforeEach } from "vitest";
import { buildGovernedOrchestrationAggregateProjection } from "@/lib/requirements/requirementsIntentOrchestrationAggregateProjection";
import {
  dismissRecommendation,
  isRecommendationOnCooldown,
  mergeGovernedRecommendations,
} from "@/lib/requirements/requirementsRecommendationGovernance";
import { buildFoldedOrchestrationTimeline } from "@/lib/requirements/requirementsOrchestrationTimelineFolding";
import { resolveContestedFocus } from "@/lib/requirements/requirementsFocusPriority";
import { buildArtifactVersionLineage } from "@/lib/requirements/requirementsArtifactVersionLineage";
import {
  createOrchestrationTimer,
  formatRuntimeMetricsForTimeline,
} from "@/lib/requirements/requirementsOrchestrationInstrumentation";
import {
  buildOrchestrationReplaySnapshot,
  replaySnapshotTimelineDetail,
} from "@/lib/requirements/requirementsOrchestrationReplay";
import {
  applyStageGovernanceToScore,
  stageGovernanceFor,
} from "@/lib/requirements/requirementsStageGovernance";
import { applyIntentOrchestrationProduct } from "@/lib/requirements/requirementsIntentOrchestrationProductRuntime";
import { buildOrchestrationUiProjection } from "@/lib/requirements/requirementsOrchestrationUiProjection";
import {
  dispatchRequirementsUserIntent,
  buildRequirementsIntentDispatchContext,
} from "@/lib/requirements/requirementsIntentDispatch";
import { mergeIntentOrchestrationPatch } from "@/lib/requirements/requirementsIntentOrchestrationWire";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { seedFeatureDetailSlotsFromServiceFlow } from "@/lib/requirements/featureDetailSlots";
import { clearIntentRouterCache } from "@/lib/requirements/requirementsIntentRouterCache";
import {
  createSampleServiceFlow,
  ORCHESTRATION_REGRESSION_NOW,
} from "../orchestration/helpers/orchestrationRegressionHarness";
import { RECOMMENDATION_COOLDOWN_MS } from "@/lib/requirements/requirementsOrchestrationConstants";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

const now = ORCHESTRATION_REGRESSION_NOW;

function featureDetailState(confirmedCount: number) {
  const flow = createSampleServiceFlow({ conversationState: "FEATURE_DETAIL" });
  const seeded = seedFeatureDetailSlotsFromServiceFlow(flow, now);
  return parseRequirementsStateJson({
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
  });
}

describe("orchestration runtime phase 4", () => {
  beforeEach(() => clearIntentRouterCache());

  it("A: projection aggregation consistency between aggregate and UI", () => {
    const state = featureDetailState(2);
    const aggregate = buildGovernedOrchestrationAggregateProjection({ state, catalogCount: 1 });
    const ui = buildOrchestrationUiProjection({ state, catalogCount: 1 });
    expect(aggregate.artifacts.badgeCount).toBe(ui.artifactBadgeCount);
    expect(aggregate.artifacts.badgeHasStale).toBe(ui.artifactBadgeHasStale);
    expect(aggregate.recommendations.primaryReason).toBe(ui.topRecommendation?.reason);
  });

  it("B: recommendation dedupe and cooldown after dismiss", () => {
    const nowIso = now;
    const merged = mergeGovernedRecommendations({
      incoming: [
        {
          actionId: "DEFINE_API",
          score: 70,
          reason: "API",
          blocking: false,
          generatedAt: nowIso,
          targetKey: "f1",
        },
        {
          actionId: "DEFINE_API",
          score: 75,
          reason: "API",
          blocking: false,
          generatedAt: nowIso,
          targetKey: "f1",
        },
      ],
      nowIso,
    });
    expect(merged).toHaveLength(1);
    const dismissed = dismissRecommendation(merged[0]!, nowIso);
    expect(isRecommendationOnCooldown(dismissed, Date.parse(nowIso))).toBe(true);
    const again = mergeGovernedRecommendations({
      incoming: [
        {
          actionId: "DEFINE_API",
          score: 80,
          reason: "API",
          blocking: false,
          generatedAt: nowIso,
          targetKey: "f1",
        },
      ],
      previous: [dismissed],
      nowIso,
    });
    expect(again).toHaveLength(0);
    expect(RECOMMENDATION_COOLDOWN_MS).toBeGreaterThan(0);
  });

  it("C: timeline folding produces summary when rows exceed cap", () => {
    const entries: RequirementsPromptTimelineEntry[] = [];
    for (let i = 0; i < 15; i++) {
      entries.push({
        stage: "service-flow",
        action: "intentRouterGuard",
        source: "system",
        provider: "internal",
        createdAt: new Date(Date.parse(now) + i * 1000).toISOString(),
        orchestrationTraceGroup: "Intent Routing",
        responseText: `trace-${i}`,
      });
    }
    const folded = buildFoldedOrchestrationTimeline(entries, 3);
    const routing = folded.find((g) => g.group === "Intent Routing");
    expect(routing?.folded).toBe(true);
    expect(routing?.hiddenCount).toBeGreaterThan(0);
    expect(routing?.summaryEntry?.action).toBe("orchestrationTimelineSummary");
  });

  it("D: focus priority — clarification beats inference", () => {
    const orch = mergeIntentOrchestrationPatch(null, {
      clarification: { pending: true, question: "q" },
      currentEditingTarget: { featureId: "clarify-f" },
      activeFocus: { type: "feature", id: "infer-f", label: "Inferred" },
    });
    const resolved = resolveContestedFocus({
      orchestration: orch,
      featureDetailSlotsV1: {
        version: 1,
        updatedAt: now,
        slots: [{ id: "clarify-f", title: "C", status: "draft", updatedAt: now }],
        focusFeatureId: null,
      },
      inferred: { type: "feature", id: "infer-f", label: "Inferred" },
    });
    expect(resolved?.id).toBe("clarify-f");
    expect(resolved?.focusSource).toBe("clarification");
  });

  it("E: artifact version lineage tracks parent on hash change", () => {
    const state = featureDetailState(1);
    const first = buildArtifactVersionLineage({ state, stage: "FEATURE_DETAIL", nowIso: now });
    const slot0 = state.featureDetailSlotsV1!.slots[0]!;
    const changed = parseRequirementsStateJson({
      ...state,
      featureDetailSlotsV1: {
        ...state.featureDetailSlotsV1!,
        slots: [{ ...slot0, status: "confirmed", updatedAt: new Date(Date.parse(now) + 60_000).toISOString() }],
      },
    });
    const second = buildArtifactVersionLineage({
      state: changed,
      stage: "FEATURE_DETAIL",
      prev: first,
      nowIso: now,
    });
    const head = second.find((e) => !e.stale);
    expect(head?.parentArtifactVersionId).toBeDefined();
    expect(second.some((e) => e.stale)).toBe(true);
  });

  it("F: runtime latency metrics in timeline format", () => {
    const timer = createOrchestrationTimer();
    timer.mark("projection");
    timer.mark("post-projection");
    const metrics = timer.finish({ cacheHit: true, projectionCost: 3 });
    const line = formatRuntimeMetricsForTimeline(metrics);
    expect(line).toContain("durationMs:");
    expect(line).toContain("cacheHit:true");
    expect(line).toContain("projectionCost:3");
  });

  it("G: replay snapshot generation", () => {
    const before = mergeIntentOrchestrationPatch(null, { turnCount: 1 });
    const after = mergeIntentOrchestrationPatch(before, {
      turnCount: 2,
      recommendationQueue: [
        {
          actionId: "DEFINE_API",
          score: 70,
          reason: "API",
          blocking: false,
          generatedAt: now,
        },
      ],
    });
    const snap = buildOrchestrationReplaySnapshot({
      before,
      after,
      triggerMessage: "hello",
      triggerAction: "EDIT_FEATURES",
      nowIso: now,
    });
    expect(snap.beforeStateSummary).toContain("recs=");
    expect(snap.afterStateSummary).not.toBe(snap.beforeStateSummary);
    expect(replaySnapshotTimelineDetail(snap)).toContain("beforeStateSummary:");
  });

  it("H: stage governance blocks document generation at FEATURE_DETAIL", () => {
    const rule = stageGovernanceFor("FEATURE_DETAIL");
    expect(rule.blockedActions).toContain("GENERATE_DOCUMENT");
    expect(applyStageGovernanceToScore({ stage: "FEATURE_DETAIL", actionId: "GENERATE_DOCUMENT", score: 50 })).toBe(
      -999,
    );
    expect(
      applyStageGovernanceToScore({ stage: "FEATURE_DETAIL", actionId: "DEFINE_API", score: 50 }),
    ).toBeGreaterThan(50);
  });

  it("I: multi-agent metadata propagation via governed runtime", () => {
    const state = featureDetailState(2);
    const ctx = buildRequirementsIntentDispatchContext(state);
    const dispatch = dispatchRequirementsUserIntent({
      userMessage: "기능 수정해줘",
      ctx,
      routingState: state,
    });
    const patch = dispatch.intentOrchestrationPatch;
    expect(patch?.lastRouting?.actorId).toBe("system");
    expect(patch?.lastRouting?.agentRole).toBe("orchestration-planner");
    expect(patch?.lastRouting?.decisionSource).toBeDefined();
    expect(patch?.lastReplaySnapshot?.triggerMessage).toBeDefined();
    expect(dispatch.timelineDetail).toContain("durationMs:");
  });

  it("I2: applyIntentOrchestrationGoverned sets replay and metrics", () => {
    const state = featureDetailState(1);
    const ctx = buildRequirementsIntentDispatchContext(state);
    const governed = applyIntentOrchestrationProduct({
      before: state.requirementsIntentOrchestrationV1,
      routingState: state,
      userMessage: "화면 정의",
      intent: {
        suggestedActionId: "DEFINE_SCREEN",
        routerMode: "deterministic",
        reason: "direct",
        confidence: 1,
      },
      guard: { allowed: true },
      effectiveActionId: "DEFINE_SCREEN",
      clarificationResolved: false,
      featureMetrics: ctx.featureMetrics,
      availableActionIds: ctx.availableActionIds,
      runtimeMetrics: { totalMs: 12, cacheHit: false },
      nowMs: Date.parse(now),
    });
    expect(governed.lastRouting?.agentRole).toBe("orchestration-architect");
    expect(governed.lastReplaySnapshot?.afterStateSummary).toBeTruthy();
    expect(governed.lastRuntimeMetrics?.totalMs).toBe(12);
  });
});
