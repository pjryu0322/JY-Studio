import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ExecuteCursorRunOutcome } from "@/lib/execution/cursorExecutionAdapter";

const updateMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    taskExecutionRun: {
      update: (...args: unknown[]) => updateMock(...args),
    },
  },
}));

import {
  isCursorRunSuccessWithResult,
  persistCursorExecutionFailure,
  persistCursorExecutionSuccess,
} from "@/lib/runtime/cursorExecutionJobPersist";

describe("cursorExecutionJobPersist", () => {
  beforeEach(() => {
    updateMock.mockReset();
    updateMock.mockResolvedValue({});
  });

  it("persistCursorExecutionSuccess stores required cursor fields", async () => {
    const outcome: ExecuteCursorRunOutcome = {
      ok: true,
      result: {
        runId: "run-abc",
        summary: "done summary",
        changedFiles: ["src/a.ts"],
        branchName: "orch/task-1",
        commitHash: "abc123",
        prUrl: "https://github.com/o/r/pull/9",
      },
      logs: [],
    };

    expect(isCursorRunSuccessWithResult(outcome)).toBe(true);
    await persistCursorExecutionSuccess("exec-1", outcome, "orch/fallback");

    expect(updateMock).toHaveBeenCalledOnce();
    const arg = updateMock.mock.calls[0][0] as { where: { id: string }; data: Record<string, unknown> };
    expect(arg.where.id).toBe("exec-1");
    expect(arg.data.cursorRunId).toBe("run-abc");
    expect(arg.data.cursorSummary).toContain("done summary");
    expect(arg.data.branchName).toBe("orch/task-1");
    expect(arg.data.commitSha).toBe("abc123");
    expect(arg.data.gitSummary).toBeTruthy();
    expect(arg.data.commitStatus).toBe("reported_by_cursor");
    expect(arg.data.pushStatus).toBe("pr_reported_by_cursor");
    expect(arg.data.status).toBe("awaiting_git_reflection");
    expect(arg.data.evaluationReason).toBe("cursor_worker_completed");
  });

  it("persistCursorExecutionFailure stores failed status and runError", async () => {
    await persistCursorExecutionFailure("exec-2", "boom");

    expect(updateMock).toHaveBeenCalledOnce();
    const arg = updateMock.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.status).toBe("failed");
    expect(arg.data.runError).toBe("boom");
    expect(arg.data.evaluationDecision).toBe("failed");
    expect(String(arg.data.evaluationReason)).toContain("cursor_worker");
  });
});
