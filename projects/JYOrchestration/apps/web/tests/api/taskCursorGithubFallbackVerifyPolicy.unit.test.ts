import { describe, expect, it } from "vitest";
import { shouldRunTaskCursorGithubProgressVerify } from "@/lib/prototype/taskCursorGithubFallbackVerifyPolicy";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";

function exec(partial: Partial<TaskCursorExecutionV1>): TaskCursorExecutionV1 {
  return {
    version: "task_cursor_execution_v1",
    projectId: "p1",
    taskId: "T1",
    workItemIds: [],
    status: "github_verifying",
    cursorProvider: "cursor",
    cursorRunId: "bc-12345678-1234-1234-1234-123456789012",
    targetRepository: "o/r",
    baseBranch: "main",
    workBranch: "wip/cursor/t1",
    createdAt: "2026-06-03T00:00:00.000Z",
    updatedAt: "2026-06-03T00:00:00.000Z",
    ...partial,
  } as TaskCursorExecutionV1;
}

describe("shouldRunTaskCursorGithubProgressVerify", () => {
  it("allows github_verifying status after initial wait", () => {
    const launchedAt = Date.now() - 90_000;
    expect(
      shouldRunTaskCursorGithubProgressVerify({
        execution: exec({
          status: "github_verifying",
          createdAt: new Date(launchedAt).toISOString(),
        }),
        nowMs: Date.now(),
      }),
    ).toBe(true);
  });
});
