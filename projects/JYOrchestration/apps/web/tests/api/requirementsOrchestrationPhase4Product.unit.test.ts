import { describe, expect, it, beforeEach } from "vitest";
import { buildOrchestrationReadModel } from "@/lib/requirements/requirementsOrchestrationReadModel";
import { buildOrchestrationUiProjection } from "@/lib/requirements/requirementsOrchestrationUiProjection";
import { markRecommendationsObsolete } from "@/lib/requirements/requirementsRecommendationLifecycle";
import {
  appendReplayWithRetention,
  replayImportanceForTransition,
} from "@/lib/requirements/requirementsOrchestrationReplayGovernance";
import { compactArtifactLineage } from "@/lib/requirements/requirementsArtifactLineageGovernance";
import { resolveStageGovernanceForAction } from "@/lib/requirements/requirementsStageGovernanceResolver";
import { isActionAuthorizedForRole } from "@/lib/requirements/requirementsMultiAgentAuthority";
import {
  resolveInstrumentationLevel,
  sampleRuntimeMetrics,
} from "@/lib/requirements/requirementsOrchestrationInstrumentation";
import { rollbackOrchestrationTransaction, startOrchestrationTransaction } from "@/lib/requirements/requirementsOrchestrationTransaction";
import {
  artifactPropagationLabelsKo,
  buildArtifactDependencyGraph,
} from "@/lib/requirements/requirementsArtifactDependencyGraph";
import { buildHumanReadableDebugSummary } from "@/lib/requirements/requirementsOrchestrationDebug";
import { mergeIntentOrchestrationPatch } from "@/lib/requirements/requirementsIntentOrchestrationWire";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { seedFeatureDetailSlotsFromServiceFlow } from "@/lib/requirements/featureDetailSlots";
import { clearIntentRouterCache } from "@/lib/requirements/requirementsIntentRouterCache";
import { MAX_REPLAY_HISTORY_ENTRIES } from "@/lib/requirements/requirementsOrchestrationConstants";
import {
  createSampleServiceFlow,
  ORCHESTRATION_REGRESSION_NOW,
} from "../orchestration/helpers/orchestrationRegressionHarness";

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

describe("orchestration phase 4 product runtime", () => {
  beforeEach(() => clearIntentRouterCache());

  it("A: read model projection consistency with UI adapter", () => {
    const state = featureDetailState(2);
    const rm = buildOrchestrationReadModel({ state, catalogCount: 1 });
    const ui = buildOrchestrationUiProjection({ state, catalogCount: 1 });
    expect(rm.artifactBadge.count).toBe(ui.artifactBadgeCount);
    expect(rm.topRecommendation?.reason).toBe(ui.topRecommendation?.reason);
    expect(rm.humanReadableDebugSummary).toBe(ui.humanReadableDebugSummary);
  });

  it("B: recommendation obsolete cleanup on stage change", () => {
    const queue = markRecommendationsObsolete({
      queue: [
        {
          actionId: "DEFINE_API",
          score: 70,
          reason: "API",
          blocking: false,
          generatedAt: now,
          targetKey: "f1",
        },
      ],
      stage: "SCREEN_DEFINE",
      previousStage: "FEATURE_DETAIL",
      focusTargetKey: "f2",
      previousFocusTargetKey: "f1",
    });
    expect(queue).toHaveLength(0);
  });

  it("C: replay retention policy caps history", () => {
    const entries = [];
    for (let i = 0; i < 60; i++) {
      entries.push({
        beforeStateSummary: "a",
        afterStateSummary: "b",
        at: new Date(Date.parse(now) + i * 1000).toISOString(),
        replayImportance: replayImportanceForTransition(i % 5 === 0 ? "dispatch:x" : "route:x"),
      });
    }
    let history = entries.slice(0, 1);
    for (const snap of entries) {
      history = appendReplayWithRetention({ history, snapshot: snap });
    }
    expect(history.length).toBeLessThanOrEqual(MAX_REPLAY_HISTORY_ENTRIES);
  });

  it("D: artifact lineage compaction bounds entries", () => {
    const stale = Array.from({ length: 10 }, (_, i) => ({
      artifactKey: "project-artifacts",
      generated: true,
      stale: true,
      sourceStage: "FEATURE_DETAIL",
      sourceHash: `h${i}`,
      updatedAt: now,
    }));
    const compact = compactArtifactLineage([
      ...stale,
      {
        artifactKey: "project-artifacts",
        generated: true,
        stale: false,
        sourceStage: "FEATURE_DETAIL",
        sourceHash: "head",
        updatedAt: now,
      },
    ]);
    expect(compact.length).toBeLessThanOrEqual(8);
  });

  it("E: governance conflict resolver — blocked wins", () => {
    const res = resolveStageGovernanceForAction({
      stage: "FEATURE_DETAIL",
      actionId: "GENERATE_DOCUMENT",
      score: 100,
    });
    expect(res.resolution).toBe("blocked");
    expect(res.allowed).toBe(false);
  });

  it("F: multi-agent authority enforcement", () => {
    expect(
      isActionAuthorizedForRole({
        role: "orchestration-architect",
        actionId: "GENERATE_DOCUMENT",
      }),
    ).toBe(false);
    expect(
      isActionAuthorizedForRole({
        role: "orchestration-developer",
        actionId: "GENERATE_DOCUMENT",
        actorId: "system",
      }),
    ).toBe(true);
  });

  it("G: instrumentation sampling strips detail in minimal mode", () => {
    const sampled = sampleRuntimeMetrics(
      { totalMs: 120, routerMs: 40, projectionMs: 90, cacheHit: false },
      "minimal",
    );
    expect(sampled.sampled).toBe(true);
    expect(sampled.routerMs).toBeUndefined();
    expect(resolveInstrumentationLevel(true)).toBe("debug");
  });

  it("H: transaction rollback trace", () => {
    const trace = startOrchestrationTransaction(now);
    const rolled = rollbackOrchestrationTransaction({
      trace,
      reason: "patch failed",
      before: mergeIntentOrchestrationPatch(null, { turnCount: 1 }),
      nowIso: now,
    });
    expect(rolled.trace.status).toBe("rolled_back");
    expect(rolled.trace.rollbackReason).toContain("patch");
  });

  it("I: artifact dependency propagation labels", () => {
    const state = featureDetailState(1);
    const edges = buildArtifactDependencyGraph({ state, flowChanged: true });
    const labels = artifactPropagationLabelsKo(edges);
    expect(labels.some((l) => l.includes("갱신"))).toBe(true);
  });

  it("J: debug summary generation", () => {
    const orch = mergeIntentOrchestrationPatch(null, {
      recommendationQueue: [
        {
          actionId: "EDIT_FEATURES",
          score: 90,
          reason: "기능 확정 필요",
          blocking: true,
          generatedAt: now,
        },
      ],
    });
    const summary = buildHumanReadableDebugSummary({
      orch,
      intent: {
        routerMode: "deterministic",
        reason: "matched",
        confidence: 0.9,
        intentType: "orchestration_action",
        suggestedActionId: "EDIT_FEATURES",
      },
      guard: { allowed: true },
    });
    expect(summary).toContain("추천");
    expect(summary).toContain("라우팅");
  });
});
