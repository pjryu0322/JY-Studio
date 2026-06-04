import { describe, expect, it } from "vitest";
import { patchTaskCursorExecution } from "@/lib/prototype/taskCursorExecution";

describe("prepareSelectedCodeTaskCursorExecution pending execution", () => {
  it("does not use cursor_requested before API (prompt_ready only)", () => {
    const base = {
      projectId: "p",
      taskId: "TASK-1",
      workItemIds: ["w1"],
      targetRepository: "owner/repo",
      baseBranch: "main",
      workBranch: "wip/cursor/code-app-shell-001",
      status: "prompt_ready" as const,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const pending = patchTaskCursorExecution(base, {
      status: "prompt_ready",
      cursorRunId: undefined,
      failureReason: undefined,
      errorMessage: undefined,
    });
    expect(pending.status).toBe("prompt_ready");
    expect(pending.status).not.toBe("cursor_requested");
    expect(pending.status).not.toBe("cursor_running");
  });
});
