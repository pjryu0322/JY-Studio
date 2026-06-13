import { describe, expect, it } from "vitest";
import {
  CODE_TASK_GITHUB_FIRST_POLL_DELAY_MS,
  CODE_TASK_GITHUB_POLL_INTERVAL_MS,
  resolveFirstGithubPollAt,
} from "@/lib/prototype/implementationGithubPollingScheduler";
import {
  isGithubProgressPollDue,
  resolveGithubProgressNextPollDelayMs,
} from "@/lib/prototype/taskCursorGithubFallbackVerifyPolicy";
import { pollTaskCursorExecutionOnce } from "@/lib/prototype/taskCursorPollService";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import { hasVerifiedCodeTaskCompletionEvidence } from "@/lib/prototype/implementationCodeTaskCompletionEvidence";
import { vi, beforeEach } from "vitest";

const pollStepMock = vi.fn();
const verifyGithubMock = vi.fn();

vi.mock("@/lib/prototype/taskCursorCloudAgentClient", () => ({
  pollTaskCursorCloudAgentStep: (...args: unknown[]) => pollStepMock(...args),
}));

vi.mock("@/lib/prototype/taskCursorGithubVerify", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/prototype/taskCursorGithubVerify")>();
  return {
    ...actual,
    verifyTaskCursorGithubResult: (...args: unknown[]) => verifyGithubMock(...args),
  };
});

const AGENT_ID = "bc-12345678-1234-1234-1234-123456789012";

function execution(partial: Partial<TaskCursorExecutionV1> = {}): TaskCursorExecutionV1 {
  return {
    version: "task_cursor_execution_v1",
    projectId: "p1",
    taskId: "DEV-1",
    workItemIds: [],
    status: "cursor_running",
    cursorProvider: "cursor",
    cursorRunId: AGENT_ID,
    targetRepository: "o/r",
    baseBranch: "main",
    workBranch: "wip/feature/core-flow",
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

describe("implementationGithubPollingScheduler", () => {
  it("schedules github polling 60 seconds after CodeTask cursor dispatch", () => {
    const dispatchedAt = new Date("2026-06-03T12:00:00.000Z");
    const firstPollAt = resolveFirstGithubPollAt(dispatchedAt);
    expect(firstPollAt.getTime() - dispatchedAt.getTime()).toBe(CODE_TASK_GITHUB_FIRST_POLL_DELAY_MS);
    expect(CODE_TASK_GITHUB_FIRST_POLL_DELAY_MS).toBe(60_000);
    expect(CODE_TASK_GITHUB_POLL_INTERVAL_MS).toBe(10_000);
  });

  it("does not mark CodeTask completed before first github poll", () => {
    const launchMs = Date.now() - 30_000;
    expect(
      isGithubProgressPollDue({
        launchMs,
        lastCheckMs: null,
        nowMs: Date.now(),
      }),
    ).toBe(false);

    const evidence = hasVerifiedCodeTaskCompletionEvidence({
      commitSha: null,
      githubBranchHeadCommit: null,
      branchHeadCommit: null,
      noCodeChangeEvidence: false,
    });
    expect(evidence).toBe(false);
  });

  it("keeps retrying when workBranch is missing before timeout", async () => {
    pollStepMock.mockReset();
    verifyGithubMock.mockReset();
    verifyGithubMock.mockResolvedValue({
      ok: false,
      allBranchesMissing: true,
      uiReason: "github_branch_missing",
      detailReason: "branch_not_found",
      message: "branch not found",
    });

    const launchedAt = new Date(Date.now() - 120_000).toISOString();
    const result = await pollTaskCursorExecutionOnce({
      projectId: "p1",
      execution: execution({ createdAt: launchedAt, updatedAt: launchedAt }),
      codeTaskId: "CODE-1",
      workItems: [],
      verifyGithub: true,
      context,
    });

    expect(pollStepMock).not.toHaveBeenCalled();
    expect(result.terminal).toBe(false);
    expect(result.success).toBe(false);
    const actions =
      result.orchestrationPatch.promptTimeline?.map((e) => e.action).join(" ") ?? "";
    expect(actions).toContain("implementation_execution_unit_github_branch_missing_retry_scheduled");
    expect(hasVerifiedCodeTaskCompletionEvidence({ commitSha: null })).toBe(false);
  });

  it("marks CodeTask completed when github workBranch head commit is resolved", async () => {
    pollStepMock.mockReset();
    verifyGithubMock.mockReset();
    verifyGithubMock.mockResolvedValue({
      ok: true,
      verifiedCommitSha: "abc123deadbeef",
    });

    const launchedAt = new Date(Date.now() - 120_000).toISOString();
    const result = await pollTaskCursorExecutionOnce({
      projectId: "p1",
      execution: execution({ createdAt: launchedAt, updatedAt: launchedAt }),
      codeTaskId: "CODE-1",
      workItems: [],
      verifyGithub: true,
      context,
    });

    expect(pollStepMock).not.toHaveBeenCalled();
    expect(result.githubVerifyResult?.ok).toBe(true);
    expect(
      hasVerifiedCodeTaskCompletionEvidence({
        commitSha: result.githubVerifyResult?.verifiedCommitSha,
      }),
    ).toBe(true);
    const actions =
      result.orchestrationPatch.promptTimeline?.map((e) => e.action).join(" ") ?? "";
    expect(actions).toContain("implementation_execution_unit_github_verify_passed");
  });

  it("does not require cursor result api for CodeTask completion", async () => {
    pollStepMock.mockReset();
    verifyGithubMock.mockReset();
    verifyGithubMock.mockResolvedValue({
      ok: true,
      verifiedCommitSha: "sha-only-from-github",
    });

    const launchedAt = new Date(Date.now() - 120_000).toISOString();
    const result = await pollTaskCursorExecutionOnce({
      projectId: "p1",
      execution: execution({ createdAt: launchedAt, updatedAt: launchedAt }),
      codeTaskId: "CODE-1",
      workItems: [],
      verifyGithub: true,
      context,
    });

    expect(pollStepMock).not.toHaveBeenCalled();
    expect(result.terminal).toBe(true);
  });
});

describe("poll delay before first github check", () => {
  beforeEach(() => {
    pollStepMock.mockReset();
    verifyGithubMock.mockReset();
  });

  it("waits with poll_waiting timeline when cursor started less than 60s ago", async () => {
    const freshIso = new Date().toISOString();
    const result = await pollTaskCursorExecutionOnce({
      projectId: "p1",
      execution: execution({ createdAt: freshIso, updatedAt: freshIso }),
      codeTaskId: "CODE-1",
      workItems: [],
      verifyGithub: true,
      context,
    });

    expect(pollStepMock).not.toHaveBeenCalled();
    expect(verifyGithubMock).not.toHaveBeenCalled();
    expect(result.nextPollDelayMs).toBeGreaterThanOrEqual(1_000);
    const actions =
      result.orchestrationPatch.promptTimeline?.map((e) => e.action).join(" ") ?? "";
    expect(actions).toContain("implementation_execution_unit_github_poll_waiting");
    const launchMs = Date.parse(freshIso);
    expect(
      resolveGithubProgressNextPollDelayMs({
        launchMs,
        lastCheckMs: null,
        nowMs: Date.now(),
      }),
    ).toBeGreaterThan(30_000);
  });
});
