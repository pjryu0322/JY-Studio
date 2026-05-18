import { describe, expect, it } from "vitest";

import { buildRuntimeRecommendationSummary } from "@/lib/harness/runtimeDecision/buildRuntimeRecommendationSummary";
import { buildDecisionPlanningTestFixtures } from "./decisionTestFixtures";

describe("H19.5 buildRuntimeRecommendationSummary", () => {
  it("returns deterministic recommendations without duplicate kinds", () => {
    const { semantic } = buildDecisionPlanningTestFixtures();
    const summary = buildRuntimeRecommendationSummary(semantic);
    expect(summary.mode).toBe("runtime_recommendation_summary");
    expect(summary.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(summary.primaryRecommendationKo.length).toBeGreaterThan(0);
    const kinds = summary.recommendations.map((r) => r.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
  });
});
