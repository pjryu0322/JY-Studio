import { describe, expect, it } from "vitest";
import { toSafeBranchSlug } from "@/lib/execution/branchSlug";

describe("toSafeBranchSlug", () => {
  it("slugifies ASCII project names", () => {
    expect(toSafeBranchSlug("Runtime Event", "p-fallback", 28)).toBe("runtime-event");
  });

  it("falls back for Korean-only names", () => {
    expect(toSafeBranchSlug("회의록 자동화", "p-a1b2c3d4", 28)).toBe("p-a1b2c3d4");
  });

  it("collapses special characters", () => {
    expect(toSafeBranchSlug("Foo  Bar!!", "fb", 20)).toBe("foo-bar");
  });
});
