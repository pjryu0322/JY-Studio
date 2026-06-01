import { describe, expect, it } from "vitest";
import { runWithConcurrency } from "@/lib/async/runWithConcurrency";

describe("runWithConcurrency", () => {
  it("preserves result order and limits concurrency", async () => {
    const items = Array.from({ length: 14 }, (_, i) => i);
    let inFlight = 0;
    let maxInFlight = 0;

    const results = await runWithConcurrency(items, 3, async (item, index) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 20));
      inFlight -= 1;
      return item * 10 + index;
    });

    expect(results).toEqual(items.map((item, index) => item * 10 + index));
    expect(maxInFlight).toBeLessThanOrEqual(3);
    expect(maxInFlight).toBeGreaterThan(1);
  });

  it("propagates worker throw to caller", async () => {
    await expect(
      runWithConcurrency([1, 2, 3], 2, async (item) => {
        if (item === 2) throw new Error("boom");
        return item;
      }),
    ).rejects.toThrow("boom");
  });
});
