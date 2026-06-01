import { describe, expect, it } from "vitest";
import { buildPseudoImplementationPrepProgress } from "@/lib/requirements/implementationPrepProgress";

describe("buildPseudoImplementationPrepProgress", () => {
  it("enters codetask_refining phase without fake batch counts", () => {
    const snap = buildPseudoImplementationPrepProgress(50_000);
    expect(snap.phase).toBe("codetask_refining");
    expect(snap.detail).toContain("Batch 기준");
    expect(snap.detail).not.toMatch(/\d+\/\d+/);
    expect(snap.percent).toBeGreaterThanOrEqual(40);
    expect(snap.percent).toBeLessThan(90);
  });
});
