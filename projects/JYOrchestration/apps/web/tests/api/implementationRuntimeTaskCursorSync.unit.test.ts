import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";

const getBundleMock = vi.fn();
const markCursorCompletedMock = vi.fn();
const completeRecordedMock = vi.fn();
const verifyOnGithubMock = vi.fn();
const applyPrecomputedMock = vi.fn();
const advanceMock = vi.fn();

vi.mock("@/lib/runtime/implementationRuntime/implementationRuntimeRepository", () => ({
  getImplementationRuntimeBundle: (...args: unknown[]) => getBundleMock(...args),
  transitionImplementationCodeTaskRun: vi.fn(),
}));

vi.mock("@/lib/runtime/implementationRuntime/implementationRuntimeCursorService", () => ({
  markImplementationRuntimeDispatching: vi.fn(),
  markImplementationRuntimeCursorRunning: vi.fn(),
  markImplementationRuntimeCursorCompleted: (...args: unknown[]) => markCursorCompletedMock(...args),
  markImplementationRuntimeGithubVerifying: vi.fn(),
  markImplementationRuntimeFailed: vi.fn(),
  recordImplementationRuntimeCursorHeartbeat: vi.fn(),
}));

vi.mock("@/lib/runtime/implementationRuntime/implementationRuntimeExecutionService", () => ({
  failImplementationRuntimeGithubVerify: vi.fn(),
  advanceImplementationRuntimeJob: (...args: unknown[]) => advanceMock(...args),
  completeImplementationRuntimeGithubVerifyAndAdvance: vi.fn(),
}));

vi.mock("@/lib/runtime/implementationRuntime/implementationGithubVerificationService", () => ({
  verifyImplementationRuntimeRunOnGithub: (...args: unknown[]) => verifyOnGithubMock(...args),
  applyImplementationRuntimeGithubVerifyResult: (...args: unknown[]) =>
    applyPrecomputedMock(...args),
  completeImplementationRuntimeFromRecordedGithubOutcome: (...args: unknown[]) =>
    completeRecordedMock(...args),
}));

import {
  findRuntimeTransitionPath,
  hasRecordedGithubVerifyOutcome,
  mapTaskCursorStatusToRuntimeState,
  syncImplementationRuntimeFromTaskCursor,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeTaskCursorSync";

function sampleExecution(
  overrides: Partial<TaskCursorExecutionV1> = {},
): TaskCursorExecutionV1 {
  return {
    version: "task_cursor_execution_v1",
    projectId: "p1",
    taskId: "CT-1",
    status: "cursor_running",
    cursorRunId: "agent-1",
    workBranch: "wip/ct-1",
    baseBranch: "main",
    targetRepository: { owner: "o", repo: "r", defaultBranch: "main" },
    createdAt: "2026-06-03T00:00:00.000Z",
    updatedAt: "2026-06-03T00:00:00.000Z",
    ...overrides,
  } as TaskCursorExecutionV1;
}

const baseRun = {
  id: "run-1",
  projectId: "p1",
  jobId: "job-1",
  codeTaskId: "CT-1",
  runtimeState: "cursor_running" as const,
  cursorAgentId: "agent-1",
  branchName: "wip/ct-1",
  commitSha: null,
  pullRequestUrl: null,
  failureReason: null,
  lastHeartbeatAt: null,
  startedAt: null,
  completedAt: null,
  updatedAt: "2026-06-03T00:00:00.000Z",
};

describe("implementationRuntimeTaskCursorSync", () => {
  beforeEach(() => {
    getBundleMock.mockReset();
    markCursorCompletedMock.mockReset();
    completeRecordedMock.mockReset();
    verifyOnGithubMock.mockReset();
    applyPrecomputedMock.mockReset();
    advanceMock.mockReset();
    markCursorCompletedMock.mockResolvedValue(undefined);
    completeRecordedMock.mockResolvedValue({ ok: true, outcomeType: "github_verified", bundle: {} });
    verifyOnGithubMock.mockResolvedValue({ ok: true, outcomeType: "github_verified", bundle: {} });
    applyPrecomputedMock.mockResolvedValue({ ok: true, outcomeType: "github_verified", bundle: {} });
  });

  it("maps cursor statuses to runtime states (never completed from cursor alone)", () => {
    expect(mapTaskCursorStatusToRuntimeState("cursor_requested")).toBe("dispatching");
    expect(mapTaskCursorStatusToRuntimeState("cursor_running")).toBe("cursor_running");
    expect(mapTaskCursorStatusToRuntimeState("cursor_completed")).toBe("github_verifying");
    expect(mapTaskCursorStatusToRuntimeState("github_verifying")).toBe("github_verifying");
    expect(mapTaskCursorStatusToRuntimeState("github_verified")).toBe("github_verifying");
    expect(mapTaskCursorStatusToRuntimeState("review_pending")).toBe("github_verifying");
    expect(mapTaskCursorStatusToRuntimeState("cursor_failed")).toBe("failed");
  });

  it("finds multi-hop path queued → cursor_running", () => {
    expect(findRuntimeTransitionPath("queued", "cursor_running")).toEqual([
      "dispatching",
      "cursor_running",
    ]);
  });

  it("finds path cursor_running → github_verifying (not completed without github outcome)", () => {
    expect(findRuntimeTransitionPath("cursor_running", "github_verifying")).toEqual([
      "github_verifying",
    ]);
    expect(findRuntimeTransitionPath("cursor_running", "completed")).toEqual([
      "github_verifying",
      "completed",
    ]);
  });

  it("cursor_completed does not complete runtime or advance", async () => {
    getBundleMock
      .mockResolvedValueOnce({
        job: { id: "job-1", status: "running", currentCodeTaskId: "CT-1" },
        currentRun: { ...baseRun, runtimeState: "cursor_running" },
        runs: [{ ...baseRun, runtimeState: "cursor_running" }],
      })
      .mockResolvedValueOnce({
        job: { id: "job-1", status: "running", currentCodeTaskId: "CT-1" },
        currentRun: { ...baseRun, runtimeState: "github_verifying" },
        runs: [{ ...baseRun, runtimeState: "github_verifying" }],
      });

    await syncImplementationRuntimeFromTaskCursor({
      projectId: "p1",
      codeTaskId: "CT-1",
      execution: sampleExecution({ status: "cursor_completed" }),
    });

    expect(completeRecordedMock).not.toHaveBeenCalled();
    expect(verifyOnGithubMock).not.toHaveBeenCalled();
    expect(advanceMock).not.toHaveBeenCalled();
  });

  it("github_verified with commitSha completes via recorded github outcome", async () => {
    getBundleMock.mockResolvedValue({
      job: { id: "job-1", status: "running", currentCodeTaskId: "CT-1" },
      currentRun: { ...baseRun, runtimeState: "github_verifying" },
      runs: [{ ...baseRun, runtimeState: "github_verifying" }],
    });

    await syncImplementationRuntimeFromTaskCursor({
      projectId: "p1",
      codeTaskId: "CT-1",
      execution: sampleExecution({ status: "github_verified", commitSha: "sha-abc" }),
    });

    expect(completeRecordedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "p1",
        jobId: "job-1",
        runId: "run-1",
        commitSha: "sha-abc",
      }),
    );
  });

  it("review_pending without github outcome does not complete", async () => {
    getBundleMock.mockResolvedValue({
      job: { id: "job-1", status: "running", currentCodeTaskId: "CT-1" },
      currentRun: { ...baseRun, runtimeState: "github_verifying" },
      runs: [{ ...baseRun, runtimeState: "github_verifying" }],
    });

    await syncImplementationRuntimeFromTaskCursor({
      projectId: "p1",
      codeTaskId: "CT-1",
      execution: sampleExecution({ status: "review_pending", commitSha: null }),
    });

    expect(completeRecordedMock).not.toHaveBeenCalled();
    expect(verifyOnGithubMock).not.toHaveBeenCalled();
  });

  it("prefers precomputed githubVerifyResult over REST verify input", async () => {
    getBundleMock.mockResolvedValue({
      job: { id: "job-1", status: "running", currentCodeTaskId: "CT-1" },
      currentRun: { ...baseRun, runtimeState: "github_verifying" },
      runs: [{ ...baseRun, runtimeState: "github_verifying" }],
    });

    await syncImplementationRuntimeFromTaskCursor({
      projectId: "p1",
      codeTaskId: "CT-1",
      execution: sampleExecution({ status: "github_verifying" }),
      githubVerifyResult: { ok: true, verifiedCommitSha: "pre-sha" },
      githubVerify: {
        execution: sampleExecution({ status: "github_verifying" }),
        targetRepository: { owner: "o", repo: "r", defaultBranch: "main" },
        githubToken: "ghp_x",
        allowedPathGlobs: [],
      },
    });

    expect(applyPrecomputedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        verifyResult: expect.objectContaining({ ok: true, verifiedCommitSha: "pre-sha" }),
      }),
    );
    expect(verifyOnGithubMock).not.toHaveBeenCalled();
  });

  it("hasRecordedGithubVerifyOutcome requires github_verified and commitSha", () => {
    expect(
      hasRecordedGithubVerifyOutcome(sampleExecution({ status: "github_verified", commitSha: "x" })),
    ).toBe(true);
    expect(hasRecordedGithubVerifyOutcome(sampleExecution({ status: "review_pending" }))).toBe(false);
  });
});
