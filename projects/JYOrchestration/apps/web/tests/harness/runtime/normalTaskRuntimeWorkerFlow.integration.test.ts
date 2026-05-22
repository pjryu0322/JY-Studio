import { afterEach, describe, expect, it, vi } from "vitest";
import { ENV_TEST_TASK_KIND } from "@/lib/execution/envTestTaskKind";
import { isLegacyInlineNormalTaskPathActive } from "@/lib/executionLoop/legacyInlineNormalTaskExecution";
import { shouldUseRuntimeWorkerPathForTask } from "@/lib/runtime/normalTaskWorkerDispatch";

describe("normalTaskRuntimeWorkerFlow policy", () => {
  afterEach(() => {
    delete process.env.EXECUTION_LOOP_FORCE_INLINE_CURSOR;
  });

  it("normal task uses worker path by default", () => {
    expect(shouldUseRuntimeWorkerPathForTask(null)).toBe(true);
    expect(isLegacyInlineNormalTaskPathActive()).toBe(false);
  });

  it("ENV_TEST never uses worker path", () => {
    expect(shouldUseRuntimeWorkerPathForTask(ENV_TEST_TASK_KIND)).toBe(false);
  });

  it("force inline disables worker path", () => {
    process.env.EXECUTION_LOOP_FORCE_INLINE_CURSOR = "1";
    expect(shouldUseRuntimeWorkerPathForTask(null)).toBe(false);
    expect(isLegacyInlineNormalTaskPathActive()).toBe(true);
  });
});
