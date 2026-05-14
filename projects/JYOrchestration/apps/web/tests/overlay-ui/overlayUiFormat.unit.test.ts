import { describe, expect, it } from "vitest";

import {
  OVERLAY_UI_MISSING_NUMBER,
  OVERLAY_UI_MISSING_RATE,
  formatKoreanInt,
  formatRateLabel,
} from "@/lib/overlay-ui/overlayUiFormat";

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

describe("formatRateLabel", () => {
  it("formats 0..1 ratio as integer percent by default", () => {
    expect(formatRateLabel(0)).toBe("0%");
    expect(formatRateLabel(0.247)).toBe("25%");
    expect(formatRateLabel(1)).toBe("100%");
  });

  it("supports 1/2 fraction digits", () => {
    expect(formatRateLabel(0.2456, 1)).toBe("24.6%");
    expect(formatRateLabel(0.2456, 2)).toBe("24.56%");
  });

  it("clamps values above 1 and below 0", () => {
    expect(formatRateLabel(1.5)).toBe("100%");
    expect(formatRateLabel(-0.01)).toBe(OVERLAY_UI_MISSING_RATE);
  });

  it("returns the missing marker for nullish/NaN/Infinity", () => {
    expect(formatRateLabel(null)).toBe(OVERLAY_UI_MISSING_RATE);
    expect(formatRateLabel(undefined)).toBe(OVERLAY_UI_MISSING_RATE);
    expect(formatRateLabel(Number.NaN)).toBe(OVERLAY_UI_MISSING_RATE);
    expect(formatRateLabel(Number.POSITIVE_INFINITY)).toBe(OVERLAY_UI_MISSING_RATE);
  });

  it("accepts a custom fallback string", () => {
    expect(formatRateLabel(null, 0, "—")).toBe("—");
  });
});
