import { describe, expect, it } from "vitest";
import {
  buildTaskCursorAutoChainIdempotencyKey,
  hasTaskCursorAutoChainIdempotencyKey,
  rememberTaskCursorAutoChainIdempotencyKey,
} from "@/lib/prototype/taskCursorAutoChainIdempotency";

describe("taskCursorAutoChainIdempotency", () => {
  it("builds stable key for continue_after_failure", () => {
    const key = buildTaskCursorAutoChainIdempotencyKey({
      projectId: "p1",
      decision: {
        kind: "continue_after_failure",
        failedTaskId: "DEV-MOCK-001",
        toTaskId: "DEV-COMMON-001",
        blockedTaskIds: [],
      },
      activeRunId: "bc-run-1",
    });
    expect(key).toBe("p1:DEV-MOCK-001:DEV-COMMON-001:bc-run-1");
  });

  it("dedupes repeated keys in memory set", () => {
    const executed = new Set<string>();
    const key = "p1:DEV-MOCK-001:DEV-COMMON-001:bc-run-1";
    expect(hasTaskCursorAutoChainIdempotencyKey(executed, key)).toBe(false);
    rememberTaskCursorAutoChainIdempotencyKey(executed, key);
    expect(hasTaskCursorAutoChainIdempotencyKey(executed, key)).toBe(true);
  });
});
