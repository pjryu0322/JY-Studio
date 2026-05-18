import { describe, expect, it } from "vitest";

import { clipWithHiddenCount, OVERLAY_MAX_VISIBLE_WARNING_GROUPS } from "@/lib/overlay-ui/overlayRenderingBudget";

describe("clipWithHiddenCount", () => {
  it("returns hidden count when over max", () => {
    const xs = [1, 2, 3, 4, 5, 6];
    const r = clipWithHiddenCount(xs, OVERLAY_MAX_VISIBLE_WARNING_GROUPS);
    expect(r.visible.length).toBe(OVERLAY_MAX_VISIBLE_WARNING_GROUPS);
    expect(r.hiddenCount).toBe(1);
  });
});
