import { afterEach, describe, expect, it } from "vitest";
import { ENV_TEST_TASK_KIND } from "@/lib/execution/envTestTaskKind";
import { isLegacyInlineNormalTaskPathActive } from "@/lib/executionLoop/legacyInlineNormalTaskExecution";
import { shouldUseRuntimeWorkerPathForTask } from "@/lib/runtime/normalTaskWorkerDispatch";

describe("runExecutionLoop path selection", () => {
  afterEach(() => {
    delete process.env.EXECUTION_LOOP_FORCE_INLINE_CURSOR;
  });

  it("normal task default → worker path", () => {
    expect(shouldUseRuntimeWorkerPathForTask(null)).toBe(true);
    expect(isLegacyInlineNormalTaskPathActive()).toBe(false);
  });

  it("FORCE_INLINE → legacy module, not worker", () => {
    process.env.EXECUTION_LOOP_FORCE_INLINE_CURSOR = "1";
    expect(shouldUseRuntimeWorkerPathForTask(null)).toBe(false);
    expect(isLegacyInlineNormalTaskPathActive()).toBe(true);
  });

  it("ENV_TEST → sync loop regardless of FORCE_INLINE", () => {
    process.env.EXECUTION_LOOP_FORCE_INLINE_CURSOR = "1";
    expect(shouldUseRuntimeWorkerPathForTask(ENV_TEST_TASK_KIND)).toBe(false);
  });
});
