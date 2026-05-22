import { describe, expect, it } from "vitest";
import {
  shouldBlockRepeatedFailure,
  shouldRetryExecution,
} from "@/lib/runtime/executionRetryPolicy";

describe("executionRetryPolicy", () => {
  it("shouldRetryExecution returns true when retry verdict and under max", () => {
    expect(
      shouldRetryExecution({
        verdict: "retry",
        evaluationReason: "needs fix",
        loopRetryCount: 1,
        maxLoopRetries: 3,
        stopOnRepeatedFailure: true,
        priorRetryReason: null,
      }),
    ).toBe(true);
  });

  it("shouldRetryExecution returns false when repeated failure blocked", () => {
    expect(
      shouldRetryExecution({
        verdict: "retry",
        evaluationReason: "same",
        loopRetryCount: 1,
        maxLoopRetries: 3,
        stopOnRepeatedFailure: true,
        priorRetryReason: "same",
      }),
    ).toBe(false);
  });

  it("shouldBlockRepeatedFailure detects identical prior reason", () => {
    expect(
      shouldBlockRepeatedFailure({
        verdict: "retry",
        evaluationReason: "duplicate",
        loopRetryCount: 2,
        maxLoopRetries: 5,
        stopOnRepeatedFailure: true,
        priorRetryReason: "duplicate",
      }),
    ).toBe(true);
  });
});
