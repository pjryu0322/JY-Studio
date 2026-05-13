import { describe, expect, it } from "vitest";

import {
  buildOverlayContextAssemblyPlan,
  parseOverlayAssemblyPlanFromUnknown,
  summarizeOverlayAssemblyPlan,
  OVERLAY_ASSEMBLY_PLAN_ITEMS_MAX,
  OVERLAY_ASSEMBLY_PLAN_HIGH_PRIORITY_THRESHOLD,
} from "@/lib/overlay/overlayContextAssemblyPlan";
import { buildOverlaySelectedContextRefs } from "@/lib/overlay/overlayContextSelection";
import { buildOverlayContextBudgetMetadata } from "@/lib/overlay/overlayContextBudget";

describe("buildOverlayContextAssemblyPlan", () => {
  it("excludes role refs and assigns priority/estimatedCost per type", () => {
    const refs = buildOverlaySelectedContextRefs({
      roleKey: "planner",
      memoryScopes: ["platform"],
      knowledgeHints: ["pack1"],
      timelineEnabled: true,
      workspaceScreenKey: "design.canvas",
      policyHintSource: "planner",
    });
    const plan = buildOverlayContextAssemblyPlan({ selectedContextRefs: refs });
    expect(plan.find((p) => p.type === "memory")?.priority).toBe(10);
    expect(plan.find((p) => p.type === "knowledge")?.priority).toBe(20);
    expect(plan.find((p) => p.type === "timeline")?.priority).toBe(30);
    expect(plan.every((p) => p.type !== ("role" as unknown as typeof p.type))).toBe(true);
    for (const item of plan) {
      expect(item.estimatedCost).toBeGreaterThanOrEqual(1);
      expect(typeof item.includeReason).toBe("string");
    }
  });

  it("marks timeline/workspace/knowledge as pruning candidates when overflow is high", () => {
    const refs = buildOverlaySelectedContextRefs({
      roleKey: "planner",
      memoryScopes: ["platform"],
      knowledgeHints: ["pack1"],
      timelineEnabled: true,
      workspaceScreenKey: "design.canvas",
      policyHintSource: "planner",
    });
    const budget = buildOverlayContextBudgetMetadata({
      promptLength: 80_000,
      selectedContextCount: refs.length,
    });
    expect(budget.overflowRisk).toBe("high");
    const plan = buildOverlayContextAssemblyPlan({ selectedContextRefs: refs, budgetMetadata: budget });
    const byType = Object.fromEntries(plan.map((p) => [p.type, p.pruningCandidate]));
    expect(byType.timeline).toBe(true);
    expect(byType.workspace).toBe(true);
    expect(byType.knowledge).toBe(true);
    expect(byType.memory).toBe(false);
    expect(byType.policy).toBe(false);
  });

  it("caps items at OVERLAY_ASSEMBLY_PLAN_ITEMS_MAX", () => {
    const refs = Array.from({ length: OVERLAY_ASSEMBLY_PLAN_ITEMS_MAX + 5 }, (_, i) => ({
      type: "knowledge" as const,
      source: `pack-${i}`,
      priority: 20 + i,
      reason: "knowledge_hint",
    }));
    const plan = buildOverlayContextAssemblyPlan({ selectedContextRefs: refs });
    expect(plan.length).toBe(OVERLAY_ASSEMBLY_PLAN_ITEMS_MAX);
  });
});

describe("parseOverlayAssemblyPlanFromUnknown", () => {
  it("drops invalid entries and clamps priority/cost", () => {
    const parsed = parseOverlayAssemblyPlanFromUnknown([
      { type: "memory", source: "platform", priority: -1, includeReason: "role_memory_scope", estimatedCost: -10, pruningCandidate: false },
      { type: "role", source: "planner", priority: 0, includeReason: "always" },
      { type: "knowledge", source: "", priority: 20, includeReason: "x" },
      { type: "unknown", source: "x", priority: 1, includeReason: "x" },
      "garbage",
      null,
    ]);
    expect(parsed.length).toBe(1);
    expect(parsed[0].source).toBe("platform");
    expect(parsed[0].priority).toBe(0);
    expect(parsed[0].estimatedCost).toBe(1);
  });
});

describe("summarizeOverlayAssemblyPlan", () => {
  it("counts totals, high-priority items, pruning candidates, and totalEstimatedCost", () => {
    const refs = buildOverlaySelectedContextRefs({
      roleKey: "planner",
      memoryScopes: ["platform"],
      knowledgeHints: ["pack1"],
      timelineEnabled: true,
      workspaceScreenKey: "design.canvas",
      policyHintSource: "planner",
    });
    const budget = buildOverlayContextBudgetMetadata({
      promptLength: 80_000,
      selectedContextCount: refs.length,
    });
    const plan = buildOverlayContextAssemblyPlan({ selectedContextRefs: refs, budgetMetadata: budget });
    const s = summarizeOverlayAssemblyPlan({ plan, budgetMetadata: budget });
    expect(s.totalItems).toBe(plan.length);
    expect(s.pruningCandidateCount).toBeGreaterThan(0);
    expect(s.highPriorityItems).toBe(plan.filter((p) => p.priority <= OVERLAY_ASSEMBLY_PLAN_HIGH_PRIORITY_THRESHOLD).length);
    expect(s.totalEstimatedCost).toBeGreaterThan(0);
    expect(s.budgetPolicy).toBe(budget.budgetPolicy);
    expect(s.overflowRisk).toBe(budget.overflowRisk);
  });
});
