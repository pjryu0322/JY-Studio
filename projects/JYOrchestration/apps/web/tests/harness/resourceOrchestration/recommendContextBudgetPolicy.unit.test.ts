import { describe, expect, it } from "vitest";

import { recommendContextBudgetPolicy } from "@/lib/harness/resourceOrchestration/recommendContextBudgetPolicy";
import type { ResourcePressureSummary } from "@/lib/harness/resourceOrchestration/resourceOrchestrationTypes";

const lowPressure: ResourcePressureSummary = { level: "low", score: 10, factors: [] };
const highPressure: ResourcePressureSummary = { level: "high", score: 80, factors: ["x"] };

describe("recommendContextBudgetPolicy", () => {
  it("suggests compact under high pressure", () => {
    const r = recommendContextBudgetPolicy({
      budget: { budgetPolicy: "extended", overflowRisk: "high", estimatedInputTokens: 1, estimatedOutputTokens: 1 },
      pressure: highPressure,
    });
    expect(r.recommendedPolicy).toBe("compact");
    expect(r.aligned).toBe(false);
  });

  it("marks aligned when current matches recommendation", () => {
    const r = recommendContextBudgetPolicy({
      budget: { budgetPolicy: "compact", overflowRisk: "high", estimatedInputTokens: 1, estimatedOutputTokens: 1 },
      pressure: highPressure,
    });
    expect(r.recommendedPolicy).toBe("compact");
    expect(r.aligned).toBe(true);
  });

  it("handles missing budget metadata", () => {
    const r = recommendContextBudgetPolicy({ budget: null, pressure: lowPressure });
    expect(r.currentPolicy).toBeNull();
    expect(r.aligned).toBe(false);
    expect(r.rationale).toContain("예산");
  });
});
