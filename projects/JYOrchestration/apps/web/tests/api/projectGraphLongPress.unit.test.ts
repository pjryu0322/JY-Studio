import { describe, expect, it } from "vitest";
import { shouldCancelLongPress } from "@/components/project-graph/projectGraphLongPress";

describe("projectGraphLongPress", () => {
  it("cancels when pointer moves beyond threshold", () => {
    expect(shouldCancelLongPress(0, 0)).toBe(false);
    expect(shouldCancelLongPress(12, 0)).toBe(true);
  });
});
