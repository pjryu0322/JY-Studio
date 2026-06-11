import { describe, expect, it } from "vitest";
import { hasRecentServerQuickRunContinuationTimeline } from "@/lib/prototype/implementationRecoverServerQuickRunContinuation";

describe("implementationRecoverServerQuickRunContinuation", () => {
  it("detects recent server quick-run continuation timeline entries", () => {
    const now = Date.parse("2026-06-03T12:00:00.000Z");
    const timeline = [
      { action: "other", createdAt: "2026-06-03T11:00:00.000Z" },
      { action: "quick_run_next_dispatch_planned", createdAt: "2026-06-03T11:59:30.000Z" },
    ];
    expect(hasRecentServerQuickRunContinuationTimeline(timeline, now)).toBe(true);
  });

  it("ignores old continuation entries outside the window", () => {
    const now = Date.parse("2026-06-03T12:00:00.000Z");
    const timeline = [{ action: "quick_run_next_dispatch_executed", createdAt: "2026-06-03T11:00:00.000Z" }];
    expect(hasRecentServerQuickRunContinuationTimeline(timeline, now)).toBe(false);
  });
});
