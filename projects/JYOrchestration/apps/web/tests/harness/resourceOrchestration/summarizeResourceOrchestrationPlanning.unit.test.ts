import { describe, expect, it } from "vitest";

import { summarizeResourceOrchestrationPlanning } from "@/lib/harness/resourceOrchestration/summarizeResourceOrchestrationPlanning";

describe("summarizeResourceOrchestrationPlanning", () => {
  it("serializes core fields for diagnostics", () => {
    const s = summarizeResourceOrchestrationPlanning({
      overlayIdentity: { roleKey: "planner", perspective: "기획", provider: "openai", capabilities: [] },
      overlayContextBudget: {
        budgetPolicy: "balanced",
        overflowRisk: "low",
        estimatedInputTokens: 100,
        estimatedOutputTokens: 50,
      },
    });
    expect(s.hasData).toBe(true);
    expect(s.roleKey).toBe("planner");
    expect(s.pressureLevel).toMatch(/low|medium|high/);
    expect(s.recommendedBudgetPolicy.length).toBeGreaterThan(1);
  });
});
