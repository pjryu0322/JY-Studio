import { describe, expect, it } from "vitest";
import { advanceQuickRunOrchestrationAfterGithubVerify } from "@/lib/prototype/implementationQuickRunGithubAdvanceService";
import { deriveImplementationQuickRunStatus } from "@/lib/prototype/implementationQuickRun";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";

describe("implementationQuickRunGithubAdvanceService", () => {
  it("returns base patch only when github verify failed", () => {
    const base = { taskCursorExecutionV1: { taskId: "T1" } as TaskCursorExecutionV1 };
    const result = advanceQuickRunOrchestrationAfterGithubVerify({
      projectId: "p1",
      githubVerifyOk: false,
      basePatch: base,
      quickRun: {
        version: "implementation_quick_run_v1",
        projectId: "p1",
        status: "running",
        updatedAt: "2026-06-04T00:00:00.000Z",
      },
    });
    expect(result.nextDispatch).toBeNull();
    expect(result.orchestrationPatch).toEqual(base);
  });

  it("deriveImplementationQuickRunStatus treats review_pending as running when quickRun blocked", () => {
    const execution = {
      version: "task_cursor_execution_v1",
      projectId: "p1",
      taskId: "DEV-FRAME-001",
      status: "review_pending",
      commitSha: "abc123",
      workItemIds: [],
      createdAt: "2026-06-04T00:00:00.000Z",
      updatedAt: "2026-06-04T00:00:00.000Z",
    } as TaskCursorExecutionV1;
    expect(
      deriveImplementationQuickRunStatus({
        quickRun: {
          version: "implementation_quick_run_v1",
          projectId: "p1",
          status: "blocked",
          updatedAt: "2026-06-04T00:00:00.000Z",
        },
        taskCursorExecution: execution,
      }),
    ).toBe("running");
  });
});
