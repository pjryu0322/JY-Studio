import { describe, expect, it } from "vitest";

import { summarizeOverlayOverloadMitigation, overlayOverloadRiskLabelKo } from "@/lib/overlay-ui/overlayOverloadMitigation";

describe("overlayOverloadRiskLabelKo", () => {
  it("maps levels to Korean labels", () => {
    expect(overlayOverloadRiskLabelKo("low")).toBe("낮음");
    expect(overlayOverloadRiskLabelKo("high")).toBe("높음");
  });
});

describe("summarizeOverlayOverloadMitigation", () => {
  it("returns low risk for empty extract", () => {
    const s = summarizeOverlayOverloadMitigation({ extract: null });
    expect(s.overlayOverloadRisk).toBe("low");
    expect(s.maxAdvancedSections).toBeGreaterThan(0);
  });

  it("bumps overload risk when compact+narrow mitigation applies", () => {
    const s = summarizeOverlayOverloadMitigation({
      extract: {
        overlayContextBudget: {
          budgetPolicy: "default",
          overflowRisk: "low",
          estimatedInputTokens: 1,
          estimatedOutputTokens: 1,
        },
      },
      compactAndNarrowUi: true,
    });
    expect(s.overlayOverloadRisk).toBe("medium");
    expect(s.mitigationHints.some((h) => h.includes("compact"))).toBe(true);
  });
});
