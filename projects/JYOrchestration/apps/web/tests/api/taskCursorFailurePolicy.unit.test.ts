import { describe, expect, it } from "vitest";
import {
  resolveTaskCursorFailurePolicy,
  canContinueTaskCursorAutoChainAfterFailure,
} from "@/lib/prototype/taskCursorFailurePolicy";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";

const NOW = "2026-05-30T12:00:00.000Z";

function execution(partial: Partial<TaskCursorExecutionV1>): TaskCursorExecutionV1 {
  return {
    version: "task_cursor_execution_v1",
    projectId: "p1",
    taskId: "DEV-SCREEN-002",
    workItemIds: [],
    status: "github_verify_failed",
    cursorProvider: "cursor",
    targetRepository: "owner/repo",
    baseBranch: "main",
    workBranch: "wip/cursor/dev-screen-002",
    createdAt: NOW,
    updatedAt: NOW,
    ...partial,
  };
}

describe("taskCursorFailurePolicy", () => {
  it("classifies github_verify_failed as task_rework with continue", () => {
    const policy = resolveTaskCursorFailurePolicy({
      failureReason: "github_verify_failed",
    });
    expect(policy.scope).toBe("task_rework");
    expect(policy.canContinueIndependentTasks).toBe(true);
    expect(policy.shouldStopAll).toBe(false);
  });

  it("classifies github_auth_failed as global blocker", () => {
    const policy = resolveTaskCursorFailurePolicy({ failureReason: "github_auth_failed" });
    expect(policy.scope).toBe("global_blocker");
    expect(policy.shouldStopAll).toBe(true);
  });

  it("classifies push_failed with auth message as global blocker", () => {
    const policy = resolveTaskCursorFailurePolicy({
      failureReason: "push_failed",
      message: "GitHub token auth failed",
    });
    expect(policy.scope).toBe("global_blocker");
  });

  it("canContinueTaskCursorAutoChainAfterFailure for verify failure", () => {
    expect(
      canContinueTaskCursorAutoChainAfterFailure(
        execution({ failureReason: "github_verify_failed" }),
      ),
    ).toBe(true);
    expect(
      canContinueTaskCursorAutoChainAfterFailure(
        execution({ status: "cursor_failed", failureReason: "github_auth_failed" }),
      ),
    ).toBe(false);
  });
});
