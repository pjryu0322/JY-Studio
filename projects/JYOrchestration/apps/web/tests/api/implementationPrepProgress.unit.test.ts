import { describe, expect, it } from "vitest";
import {
  buildImplementationPrepCompletedSnapshot,
  buildPseudoImplementationPrepProgress,
  IMPLEMENTATION_PREP_DEFAULT_BATCH_CONCURRENCY,
} from "@/lib/requirements/implementationPrepProgress";

describe("buildPseudoImplementationPrepProgress", () => {
  it("enters codetask_refining phase without fake batch counts", () => {
    const snap = buildPseudoImplementationPrepProgress(90_000);
    expect(snap.phase).toBe("codetask_refining");
    expect(snap.detailLine).toContain("Batch 기준");
    expect(snap.detailLine).not.toMatch(/\d+\/\d+/);
    expect(snap.percent).toBeGreaterThanOrEqual(40);
    expect(snap.percent).toBeLessThanOrEqual(99);
  });

  it("completed snapshot shows 100 percent and all steps done", () => {
    const snap = buildImplementationPrepCompletedSnapshot();
    expect(snap.percent).toBe(100);
    expect(snap.phase).toBe("ready");
    expect(snap.steps.every((s) => s.status === "done")).toBe(true);
  });

  it("shows 준비 중 meta and default concurrency", () => {
    const snap = buildPseudoImplementationPrepProgress(0);
    expect(snap.metaLines.join("\n")).toContain("준비 중");
    expect(snap.metaLines.some((l) => l.includes(`${IMPLEMENTATION_PREP_DEFAULT_BATCH_CONCURRENCY}개씩`))).toBe(
      true,
    );
    expect(snap.metaLines.join("\n")).not.toMatch(/Batch\s+\d+\/\d+/);
  });

  it("lists quick design confirm as done during prep", () => {
    const snap = buildPseudoImplementationPrepProgress(5_000);
    expect(snap.steps[0]?.label).toBe("Quick Design 확정");
    expect(snap.steps[0]?.status).toBe("done");
  });
});
