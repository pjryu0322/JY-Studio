import { describe, expect, it } from "vitest";

import { buildResourcePressureSummary } from "@/lib/harness/resourceOrchestration/resourcePressureSummary";

describe("buildResourcePressureSummary", () => {
  it("returns low pressure for empty extract", () => {
    const s = buildResourcePressureSummary(null);
    expect(s.level).toBe("low");
    expect(s.score).toBeLessThan(34);
    expect(s.factors.length).toBeGreaterThan(0);
  });

  it("elevates pressure when budget overflow is high", () => {
    const s = buildResourcePressureSummary({
      overlayContextBudget: {
        estimatedInputTokens: 9000,
        estimatedOutputTokens: 2000,
        budgetPolicy: "compact",
        overflowRisk: "high",
      },
    });
    expect(s.level).toBe("high");
    expect(s.factors.some((f) => f.includes("토큰"))).toBe(true);
  });

  it("adds weight for assembly plan cost", () => {
    const s = buildResourcePressureSummary({
      overlayContextAssemblyPlan: [
        {
          type: "memory",
          source: "m",
          priority: 1,
          includeReason: "r",
          estimatedCost: 5000,
          includeMode: "required",
          pruningCandidate: false,
        },
      ],
    });
    expect(s.score).toBeGreaterThan(10);
  });
});
