import { describe, expect, it } from "vitest";
import {
  buildImplementationActionExecutedTimelineEntry,
  buildImplementationActionRouteTimelineEntries,
  buildImplementationStageActionTimelineEntry,
  buildSyntheticImplementationActionClassification,
  mergePromptTimelineWithBootstrapEntries,
} from "@/lib/prototype/implementationIntentTimeline";

const classification = {
  intentType: "orchestration_action" as const,
  suggestedActionId: "CREATE_WORK_PLAN" as const,
  confidence: 0.88,
  executionIntent: "explicit_execute" as const,
  actionInvocationStrength: "explicit" as const,
  extractedRules: [],
  requiresPreActionPatch: false,
  shouldExecuteAction: true,
  targetAction: "CREATE_WORK_PLAN" as const,
  routerSource: "rule" as const,
};

describe("implementation intent timeline", () => {
  it("records action executed with router metadata", () => {
    const entry = buildImplementationActionExecutedTimelineEntry({
      actionId: "CREATE_WORK_PLAN",
      classification,
    });
    expect(entry.action).toBe("implementation_action_executed");
    expect(entry.responseText).toContain("actionId=CREATE_WORK_PLAN");
    expect(entry.responseText).toContain("routerSource=rule");
    expect(entry.responseText).toContain("confidence=0.88");
  });

  it("builds routed and executed pair", () => {
    const entries = buildImplementationActionRouteTimelineEntries({
      actionId: "CREATE_WORK_PLAN",
      classification,
    });
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.action)).toEqual([
      "implementation_intent_routed",
      "implementation_action_executed",
    ]);
  });

  it("builds routed and executed timeline entries for bootstrap CTA", () => {
    const ctaClassification = buildSyntheticImplementationActionClassification({
      actionId: "CREATE_WORK_PLAN",
      reason: "bootstrap_cta_clicked",
      routerSource: "platform",
    });
    const entries = buildImplementationActionRouteTimelineEntries({
      actionId: "CREATE_WORK_PLAN",
      classification: ctaClassification,
    });
    expect(entries.map((e) => e.action)).toEqual([
      "implementation_intent_routed",
      "implementation_action_executed",
    ]);
    expect(entries[0]?.responseText).toContain("source=platform");
    expect(entries[0]?.responseText).toContain("reason=bootstrap_cta_clicked");
    expect(entries[1]?.responseText).toContain("actionId=CREATE_WORK_PLAN");
    expect(entries[1]?.responseText).toContain("routerSource=platform");
  });

  it("builds stage action routed entry", () => {
    const entry = buildImplementationStageActionTimelineEntry({
      action: "routed",
      actionId: "CONFIRM_IMPLEMENTATION_WORK_PLAN",
      source: "cta",
      runId: "run-1",
    });
    expect(entry.action).toBe("implementation_stage_action_routed");
    expect(entry.responseText).toContain("actionId=CONFIRM_IMPLEMENTATION_WORK_PLAN");
    expect(entry.responseText).toContain("source=cta");
    expect(entry.responseText).toContain("runId=run-1");
  });

  it("builds stage action executed entry", () => {
    const entry = buildImplementationStageActionTimelineEntry({
      action: "executed",
      actionId: "CONFIRM_IMPLEMENTATION_WORK_PLAN",
      source: "cta",
      runId: "run-1",
    });
    expect(entry.action).toBe("implementation_stage_action_executed");
    expect(entry.responseText).toContain("runId=run-1");
  });

  it("builds stage action blocked entry with message", () => {
    const entry = buildImplementationStageActionTimelineEntry({
      action: "blocked",
      actionId: "GENERATE_IMPLEMENTATION_WORK_PLAN",
      source: "cta",
      message: "seed not confirmed",
      runId: "run-2",
    });
    expect(entry.action).toBe("implementation_stage_action_blocked");
    expect(entry.responseText).toContain("seed not confirmed");
    expect(entry.responseText).toContain("runId=run-2");
  });

  it("merges orchestration timeline with bootstrap entries without dropping bootstrap", () => {
    const base = [
      {
        stage: "implementation",
        action: "generation_readiness_checked",
        responseText: "base",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ] as const;
    const orchestration = [
      ...base,
      {
        stage: "implementation",
        action: "implementation_work_plan_draft_created",
        responseText: "draft",
        createdAt: "2026-01-01T00:00:01.000Z",
      },
    ] as const;
    const bootstrap = buildImplementationActionRouteTimelineEntries({
      actionId: "CREATE_WORK_PLAN",
      classification,
    });
    const merged = mergePromptTimelineWithBootstrapEntries({
      baseTimeline: base,
      orchestrationTimeline: orchestration,
      bootstrapTimeline: bootstrap,
    });
    expect(merged.map((e) => e.action)).toEqual([
      "generation_readiness_checked",
      "implementation_work_plan_draft_created",
      "implementation_intent_routed",
      "implementation_action_executed",
    ]);
  });
});
