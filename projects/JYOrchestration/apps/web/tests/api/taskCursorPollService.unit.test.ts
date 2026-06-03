import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";

const pollStepMock = vi.fn();
const verifyGithubMock = vi.fn();

vi.mock("@/lib/prototype/taskCursorCloudAgentClient", () => ({
  pollTaskCursorCloudAgentStep: (...args: unknown[]) => pollStepMock(...args),
}));

vi.mock("@/lib/prototype/taskCursorGithubVerify", () => ({
  verifyTaskCursorGithubResult: (...args: unknown[]) => verifyGithubMock(...args),
}));

import { pollTaskCursorExecutionOnce } from "@/lib/prototype/taskCursorPollService";

const AGENT_ID = "bc-12345678-1234-1234-1234-123456789012";

function execution(partial: Partial<TaskCursorExecutionV1> = {}): TaskCursorExecutionV1 {
  return {
    version: "task_cursor_execution_v1",
    projectId: "p1",
    taskId: "CT-1",
    workItemIds: [],
    status: "cursor_running",
    cursorProvider: "cursor",
    cursorRunId: AGENT_ID,
    targetRepository: "o/r",
    baseBranch: "main",
    workBranch: "wip/ct-1",
    createdAt: "2026-06-03T00:00:00.000Z",
    updatedAt: "2026-06-03T00:00:00.000Z",
    ...partial,
  } as TaskCursorExecutionV1;
}

const context = {
  cursorApiUrl: "https://api.cursor.com",
  cursorApiToken: "cursor-token",
  githubToken: "ghp_test",
  targetRepository: { owner: "o", repo: "r", defaultBranch: "main", gitRepoUrl: "https://github.com/o/r" },
  workspaceRoot: "/ws",
  baseBranch: "main",
  allowedPathGlobs: ["src/**"],
} as const;

describe("pollTaskCursorExecutionOnce githubVerifyResult", () => {
  beforeEach(() => {
    pollStepMock.mockReset();
    verifyGithubMock.mockReset();
    verifyGithubMock.mockResolvedValue({
      ok: true,
      verifiedCommitSha: "sha-from-poll",
    });
  });

  it("includes githubVerifyResult when poll completes and verifyGithub runs", async () => {
    pollStepMock.mockResolvedValue({
      kind: "completed",
      result: {
        ok: true,
        status: "completed",
        taskId: "CT-1",
        branchName: "wip/ct-1",
        commitSha: "sha-from-poll",
        changedFiles: ["src/a.ts"],
        pushed: true,
      },
    });

    const result = await pollTaskCursorExecutionOnce({
      projectId: "p1",
      execution: execution(),
      workItems: [],
      verifyGithub: true,
      context,
    });

    expect(verifyGithubMock).toHaveBeenCalledTimes(1);
    expect(result.githubVerifyResult).toEqual(
      expect.objectContaining({ ok: true, verifiedCommitSha: "sha-from-poll" }),
    );
  });

  it("does not verify when verifyGithub is false", async () => {
    pollStepMock.mockResolvedValue({
      kind: "completed",
      result: {
        ok: true,
        status: "completed",
        taskId: "CT-1",
        branchName: "wip/ct-1",
        changedFiles: [],
        pushed: true,
      },
    });

    const result = await pollTaskCursorExecutionOnce({
      projectId: "p1",
      execution: execution(),
      workItems: [],
      verifyGithub: false,
      context,
    });

    expect(verifyGithubMock).not.toHaveBeenCalled();
    expect(result.githubVerifyResult).toBeUndefined();
  });

  it("does not verify while agent is still running", async () => {
    pollStepMock.mockResolvedValue({ kind: "running", statusUpper: "RUNNING" });

    const result = await pollTaskCursorExecutionOnce({
      projectId: "p1",
      execution: execution(),
      workItems: [],
      verifyGithub: true,
      context,
    });

    expect(verifyGithubMock).not.toHaveBeenCalled();
    expect(result.githubVerifyResult).toBeUndefined();
    expect(result.status).toBe("cursor_running");
  });
});
