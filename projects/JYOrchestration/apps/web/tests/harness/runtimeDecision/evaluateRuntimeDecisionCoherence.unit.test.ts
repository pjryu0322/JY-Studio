import { describe, expect, it } from "vitest";

import { buildRuntimeDecisionPlanningReports } from "@/lib/harness/runtimeDecision/buildRuntimeDecisionPlanningReports";
import { evaluateRuntimeDecisionCoherence } from "@/lib/harness/runtimeDecision/evaluateRuntimeDecisionCoherence";
import { buildDecisionPlanningTestFixtures } from "./decisionTestFixtures";

describe("H19.5 evaluateRuntimeDecisionCoherence", () => {
  it("evaluates cross-layer coherence with read-only mode", () => {
    const { reasoning, semantic } = buildDecisionPlanningTestFixtures();
    const coherence = evaluateRuntimeDecisionCoherence(reasoning, semantic);
    expect(coherence.mode).toBe("runtime_decision_coherence");
    expect(coherence.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(coherence.dimensions.length).toBe(6);
    expect(["aligned", "partial", "divergent"]).toContain(coherence.overallLevel);
  });

  it("builds full decision planning reports once", () => {
    const { reasoning, semantic } = buildDecisionPlanningTestFixtures();
    const reports = buildRuntimeDecisionPlanningReports(reasoning, semantic);
    expect(reports.runtimeDecisionSnapshot.mode).toBe("runtime_decision_snapshot");
    expect(reports.runtimeRecommendationSummary.mode).toBe("runtime_recommendation_summary");
  });
});
