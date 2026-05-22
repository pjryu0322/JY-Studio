import { afterEach, describe, expect, it, vi } from "vitest";
import { ENV_TEST_TASK_KIND } from "@/lib/execution/envTestTaskKind";
import { isLegacyInlineNormalTaskPathActive } from "@/lib/executionLoop/legacyInlineNormalTaskExecution";
import { isRuntimeCursorChainPipelineEnabled } from "@/lib/runtime/cursorToPipelineChain";
import { shouldUseRuntimeWorkerPathForTask } from "@/lib/runtime/normalTaskWorkerDispatch";

describe("normalTaskRuntimeWorkerFlow policy", () => {
  afterEach(() => {
    delete process.env.EXECUTION_LOOP_FORCE_INLINE_CURSOR;
    delete process.env.RUNTIME_CURSOR_CHAIN_PIPELINE;
  });

  it("normal task uses worker path by default", () => {
    expect(shouldUseRuntimeWorkerPathForTask(null)).toBe(true);
    expect(isLegacyInlineNormalTaskPathActive()).toBe(false);
    expect(isRuntimeCursorChainPipelineEnabled()).toBe(true);
  });

  it("ENV_TEST never uses worker path", () => {
    expect(shouldUseRuntimeWorkerPathForTask(ENV_TEST_TASK_KIND)).toBe(false);
  });

  it("force inline disables worker path", () => {
    process.env.EXECUTION_LOOP_FORCE_INLINE_CURSOR = "1";
    expect(shouldUseRuntimeWorkerPathForTask(null)).toBe(false);
  });

  it("background cursor chain enabled unless RUNTIME_CURSOR_CHAIN_PIPELINE=0", () => {
    expect(isRuntimeCursorChainPipelineEnabled()).toBe(true);
    process.env.RUNTIME_CURSOR_CHAIN_PIPELINE = "0";
    expect(isRuntimeCursorChainPipelineEnabled()).toBe(false);
  });
});
