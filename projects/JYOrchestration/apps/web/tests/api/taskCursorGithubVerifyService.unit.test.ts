import { describe, expect, it } from "vitest";
import { validateTaskCursorGithubVerifyExecution } from "@/lib/prototype/taskCursorGithubVerifyService";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";

function exec(status: TaskCursorExecutionV1["status"], workBranch?: string): TaskCursorExecutionV1 {
  return {
    version: "task_cursor_execution_v1",
    projectId: "p1",
    taskId: "T1",
    status,
    workItemIds: [],
    workBranch,
    createdAt: "2026-06-04T00:00:00.000Z",
    updatedAt: "2026-06-04T00:00:00.000Z",
  } as TaskCursorExecutionV1;
}

describe("taskCursorGithubVerifyService", () => {
  it("validateTaskCursorGithubVerifyExecution blocks cursor_requested", () => {
    const blocked = validateTaskCursorGithubVerifyExecution(exec("cursor_requested"));
    expect(blocked?.kind).toBe("blocked");
  });

  it("validateTaskCursorGithubVerifyExecution requires workBranch for cursor_running", () => {
    expect(validateTaskCursorGithubVerifyExecution(exec("cursor_running"))?.kind).toBe("blocked");
    expect(validateTaskCursorGithubVerifyExecution(exec("cursor_running", "wip/x"))).toBeNull();
  });
});
