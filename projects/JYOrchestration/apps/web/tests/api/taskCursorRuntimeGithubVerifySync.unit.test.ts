import { describe, expect, it } from "vitest";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import {
  shouldApplyRuntimeGithubVerifyInput,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeTaskCursorSync";
import type { ProjectTargetRepository } from "@/lib/prototype/projectTargetRepository";

const targetRepo: ProjectTargetRepository = { owner: "o", repo: "r", defaultBranch: "main" };

function exec(status: TaskCursorExecutionV1["status"]): TaskCursorExecutionV1 {
  return {
    version: "task_cursor_execution_v1",
    projectId: "p1",
    taskId: "CT-1",
    status,
    createdAt: "2026-06-03T00:00:00.000Z",
    updatedAt: "2026-06-03T00:00:00.000Z",
  } as TaskCursorExecutionV1;
}

describe("shouldApplyRuntimeGithubVerifyInput", () => {
  const verifyInput = {
    execution: exec("github_verifying"),
    targetRepository: targetRepo,
    githubToken: "ghp_x",
    allowedPathGlobs: [],
  };

  it("skips verify input during cursor_running", () => {
    expect(shouldApplyRuntimeGithubVerifyInput(exec("cursor_running"), verifyInput)).toBe(false);
  });

  it("applies verify input during github phases", () => {
    expect(shouldApplyRuntimeGithubVerifyInput(exec("cursor_completed"), verifyInput)).toBe(true);
    expect(shouldApplyRuntimeGithubVerifyInput(exec("github_verifying"), verifyInput)).toBe(true);
  });
});
