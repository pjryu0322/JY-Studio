import { afterEach, describe, expect, it, vi } from "vitest";
import { ENV_TEST_TASK_KIND } from "@/lib/execution/envTestTaskKind";

const workerMock = vi.fn();

vi.mock("@/lib/runtime/normalTaskWorkerDispatch", () => ({
  runNormalTaskViaRuntimeWorkers: (...args: unknown[]) => workerMock(...args),
}));

vi.mock("@/lib/executionLoop/workflowState", () => ({
  refreshWorkflowStates: vi.fn().mockResolvedValue(undefined),
}));

import {
  assertLegacyInlineAllowedForTaskKind,
  isLegacyInlineNormalTaskPathActive,
  runLegacyInlineNormalTaskExecution,
} from "@/lib/executionLoop/legacyInlineNormalTaskExecution";

describe("legacyInlineNormalTaskExecution", () => {
  afterEach(() => {
    delete process.env.EXECUTION_LOOP_FORCE_INLINE_CURSOR;
    workerMock.mockReset();
  });

  it("active only when FORCE_INLINE=1", () => {
    expect(isLegacyInlineNormalTaskPathActive()).toBe(false);
    process.env.EXECUTION_LOOP_FORCE_INLINE_CURSOR = "1";
    expect(isLegacyInlineNormalTaskPathActive()).toBe(true);
  });

  it("rejects ENV_TEST task kinds", () => {
    expect(assertLegacyInlineAllowedForTaskKind(ENV_TEST_TASK_KIND).allowed).toBe(false);
  });

  it("runs worker dispatch for normal task", async () => {
    workerMock.mockResolvedValue({
      ok: true,
      message: "ok",
      steps: [{ phase: "cursor_job", ok: true }],
    });
    const out = await runLegacyInlineNormalTaskExecution({
      projectId: "p1",
      taskId: "t1",
      execRunId: "r1",
      actorUserId: "u1",
      singleTaskId: "t1",
    });
    expect(out.kind).toBe("return");
    expect(workerMock).toHaveBeenCalled();
  });
});
