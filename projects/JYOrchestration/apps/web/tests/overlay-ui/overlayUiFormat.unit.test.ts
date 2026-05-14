import { describe, expect, it } from "vitest";

import { formatKoreanInt, OVERLAY_UI_MISSING_NUMBER } from "@/lib/overlay-ui/overlayUiFormat";

describe("formatKoreanInt", () => {
  it("returns the missing marker for nullish/NaN/Infinity", () => {
    expect(formatKoreanInt(null)).toBe(OVERLAY_UI_MISSING_NUMBER);
    expect(formatKoreanInt(undefined)).toBe(OVERLAY_UI_MISSING_NUMBER);
    expect(formatKoreanInt(Number.NaN)).toBe(OVERLAY_UI_MISSING_NUMBER);
    expect(formatKoreanInt(Number.POSITIVE_INFINITY)).toBe(OVERLAY_UI_MISSING_NUMBER);
    expect(formatKoreanInt(Number.NEGATIVE_INFINITY)).toBe(OVERLAY_UI_MISSING_NUMBER);
  });

  it("formats integers with Korean locale grouping", () => {
    expect(formatKoreanInt(0)).toBe("0");
    expect(formatKoreanInt(1234)).toBe("1,234");
    expect(formatKoreanInt(1_000_000)).toBe("1,000,000");
  });

  it("clamps negative values to 0 and floors fractions", () => {
    expect(formatKoreanInt(-42)).toBe("0");
    expect(formatKoreanInt(3.9)).toBe("3");
    expect(formatKoreanInt(1234.5)).toBe("1,234");
  });
});
