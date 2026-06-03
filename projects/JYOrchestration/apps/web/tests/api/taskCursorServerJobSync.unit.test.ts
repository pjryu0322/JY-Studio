import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import type { ProjectTargetRepository } from "@/lib/prototype/projectTargetRepository";

const syncRuntimeMock = vi.fn();

vi.mock("@/lib/runtime/implementationRuntime/implementationRuntimeTaskCursorSync", () => ({
  syncImplementationRuntimeFromTaskCursor: (...args: unknown[]) => syncRuntimeMock(...args),
}));

import {
  buildGithubVerifyInputForRuntimeSync,
  shouldSyncTaskCursorServerJobPollState,
  syncDbRuntimeAfterTaskCursorServerPoll,
} from "@/lib/prototype/taskCursorServerJobSync";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

const targetRepo: ProjectTargetRepository = {
  owner: "o",
  repo: "r",
  defaultBranch: "main",
};

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

describe("buildGithubVerifyInputForRuntimeSync", () => {
  it("returns null without githubToken or targetRepository", () => {
    expect(
      buildGithubVerifyInputForRuntimeSync({
        execution: exec("github_verifying"),
        githubToken: "",
        targetRepository: targetRepo,
      }),
    ).toBeNull();
    expect(
      buildGithubVerifyInputForRuntimeSync({
        execution: exec("github_verifying"),
        githubToken: "ghp_x",
        targetRepository: null,
      }),
    ).toBeNull();
  });

  it("builds verify input when token and repository exist", () => {
    const input = buildGithubVerifyInputForRuntimeSync({
      execution: exec("cursor_completed"),
      githubToken: "ghp_test",
      targetRepository: targetRepo,
      allowedPathGlobs: ["src/**"],
    });
    expect(input?.githubToken).toBe("ghp_test");
    expect(input?.targetRepository).toEqual(targetRepo);
    expect(input?.execution.status).toBe("cursor_completed");
  });
});

describe("syncDbRuntimeAfterTaskCursorServerPoll", () => {
  beforeEach(() => {
    syncRuntimeMock.mockReset();
    syncRuntimeMock.mockResolvedValue(undefined);
  });

  it("forwards githubVerify to syncImplementationRuntimeFromTaskCursor", async () => {
    const execution = exec("github_verifying");
    const githubVerify = {
      execution,
      targetRepository: targetRepo,
      githubToken: "ghp_x",
      allowedPathGlobs: [],
    };
    await syncDbRuntimeAfterTaskCursorServerPoll({
      projectId: "p1",
      taskId: "CT-1",
      execution,
      githubVerify,
    });
    expect(syncRuntimeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "p1",
        githubVerify,
      }),
    );
  });

  it("forwards githubVerifyResult to syncImplementationRuntimeFromTaskCursor", async () => {
    const execution = exec("review_pending");
    const githubVerifyResult = { ok: true, verifiedCommitSha: "sha-poll" };
    await syncDbRuntimeAfterTaskCursorServerPoll({
      projectId: "p1",
      taskId: "CT-1",
      execution,
      githubVerifyResult,
    });
    expect(syncRuntimeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        githubVerifyResult,
      }),
    );
  });
});

describe("shouldSyncTaskCursorServerJobPollState", () => {
  it("returns false when execution and quick run are cleared", () => {
    expect(shouldSyncTaskCursorServerJobPollState({} as RequirementsStateJson)).toBe(false);
    expect(
      shouldSyncTaskCursorServerJobPollState({
        taskCursorExecutionV1: null,
        implementationQuickRunV1: null,
      } as RequirementsStateJson),
    ).toBe(false);
  });

  it("returns true when task cursor execution is in flight", () => {
    expect(
      shouldSyncTaskCursorServerJobPollState({
        taskCursorExecutionV1: {
          version: "task_cursor_execution_v1",
          projectId: "p1",
          taskId: "DEV-1",
          workItemIds: [],
          status: "cursor_running",
          cursorProvider: "cursor",
          targetRepository: "o/r",
          baseBranch: "main",
          workBranch: "wip/x",
          createdAt: "2026-06-01T12:00:00.000Z",
          updatedAt: "2026-06-01T12:00:00.000Z",
        },
      } as RequirementsStateJson),
    ).toBe(true);
  });

  it("returns true when an implementation execution job is active", () => {
    expect(
      shouldSyncTaskCursorServerJobPollState({
        implementationExecutionJobsV1: [
          {
            version: "implementation_execution_job_v1",
            jobId: "j1",
            projectId: "p1",
            processTaskId: "DEV-1",
            codeTaskIds: [],
            workItemIds: [],
            attemptNo: 1,
            status: "running",
            currentStep: "cursor_running",
            createdAt: "2026-06-01T12:00:00.000Z",
            updatedAt: "2026-06-01T12:00:00.000Z",
          },
        ],
      } as RequirementsStateJson),
    ).toBe(true);
  });

  it("returns true when quick run is running", () => {
    expect(
      shouldSyncTaskCursorServerJobPollState({
        implementationQuickRunV1: {
          version: "implementation_quick_run_v1",
          projectId: "p1",
          status: "running",
          updatedAt: "2026-06-01T12:00:00.000Z",
        },
      } as RequirementsStateJson),
    ).toBe(true);
  });
});
