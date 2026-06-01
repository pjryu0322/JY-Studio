import { describe, expect, it } from "vitest";
import { resolveCodeTaskLlmBatchConcurrency } from "@/lib/prototype/codeTaskLlmBatchConcurrency";

describe("resolveCodeTaskLlmBatchConcurrency", () => {
  it("defaults to 3 for invalid values", () => {
    expect(resolveCodeTaskLlmBatchConcurrency(undefined)).toBe(3);
    expect(resolveCodeTaskLlmBatchConcurrency("")).toBe(3);
    expect(resolveCodeTaskLlmBatchConcurrency("nope")).toBe(3);
  });

  it("clamps between 1 and 5", () => {
    expect(resolveCodeTaskLlmBatchConcurrency(0)).toBe(1);
    expect(resolveCodeTaskLlmBatchConcurrency(99)).toBe(5);
    expect(resolveCodeTaskLlmBatchConcurrency(4)).toBe(4);
  });
});
