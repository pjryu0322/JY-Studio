import { describe, expect, it } from "vitest";
import {
  buildOverlayContextBudgetMetadata,
  parseOverlayContextBudgetMetadataFromUnknown,
} from "@/lib/overlay/overlayContextBudget";

describe("buildOverlayContextBudgetMetadata", () => {
  it("picks compact policy for short prompts", () => {
    const m = buildOverlayContextBudgetMetadata({ promptLength: 800, selectedContextCount: 2 });
    expect(m.budgetPolicy).toBe("compact");
    expect(m.overflowRisk).toBe("low");
    expect(m.estimatedInputTokens).toBeGreaterThan(0);
    expect(m.estimatedOutputTokens).toBeGreaterThanOrEqual(256);
  });

  it("picks balanced policy when prompt grows or many contexts", () => {
    const m = buildOverlayContextBudgetMetadata({ promptLength: 10_000, selectedContextCount: 8 });
    expect(m.budgetPolicy).toBe("balanced");
  });

  it("picks extended policy for very large prompts or many contexts", () => {
    const m = buildOverlayContextBudgetMetadata({ promptLength: 30_000, selectedContextCount: 25 });
    expect(m.budgetPolicy).toBe("extended");
  });

  it("escalates overflowRisk when estimated tokens approach budget (balanced)", () => {
    const m = buildOverlayContextBudgetMetadata({ promptLength: 18_000, selectedContextCount: 8 });
    expect(m.budgetPolicy).toBe("balanced");
    expect(["medium", "high"]).toContain(m.overflowRisk);
  });

  it("computes high overflowRisk for extended policy at the edge", () => {
    const m = buildOverlayContextBudgetMetadata({
      promptLength: 80_000,
      selectedContextCount: 25,
    });
    expect(m.budgetPolicy).toBe("extended");
    expect(m.overflowRisk).toBe("high");
  });

  it("returns null tokens for zero-length prompt", () => {
    const m = buildOverlayContextBudgetMetadata({ promptLength: 0, selectedContextCount: 0 });
    expect(m.estimatedInputTokens).toBeNull();
    expect(m.estimatedOutputTokens).toBeNull();
  });
});

describe("parseOverlayContextBudgetMetadataFromUnknown", () => {
  it("round-trips a built metadata", () => {
    const built = buildOverlayContextBudgetMetadata({ promptLength: 4_000, selectedContextCount: 6 });
    const parsed = parseOverlayContextBudgetMetadataFromUnknown(built);
    expect(parsed).toEqual(built);
  });

  it("returns null for invalid input (unknown policy/risk)", () => {
    expect(
      parseOverlayContextBudgetMetadataFromUnknown({
        budgetPolicy: "weird",
        overflowRisk: "low",
        estimatedInputTokens: 1,
        estimatedOutputTokens: 1,
      })
    ).toBeNull();
    expect(parseOverlayContextBudgetMetadataFromUnknown(null)).toBeNull();
    expect(parseOverlayContextBudgetMetadataFromUnknown("x")).toBeNull();
  });
});
