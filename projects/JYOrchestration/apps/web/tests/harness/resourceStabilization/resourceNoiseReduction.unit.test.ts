import { describe, expect, it } from "vitest";

import { dedupeExplainabilitySummaryLines, clipExplainabilitySummaryLinesForDisplay } from "@/lib/harness/resourceStabilization/resourceNoiseReduction";

describe("resourceNoiseReduction", () => {
  it("dedupes adjacent identical summary lines", () => {
    expect(dedupeExplainabilitySummaryLines(["a", "a", "  a  ", "b"])).toEqual(["a", "b"]);
  });

  it("clips with hidden count", () => {
    const r = clipExplainabilitySummaryLinesForDisplay(["1", "2", "3", "3", "4", "5"], 4);
    expect(r.visible.length).toBe(4);
    expect(r.hiddenLineCount).toBe(1);
  });
});
