import { beforeEach, describe, expect, it, vi } from "vitest";

const markCompletedMock = vi.fn();
const markFailedMock = vi.fn();
const pauseJobMock = vi.fn();
const getJobMock = vi.fn();
const createRunMock = vi.fn();
const getBundleByJobMock = vi.fn();

vi.mock("@/lib/runtime/implementationRuntime/implementationRuntimeCodeTaskQueueService", () => ({
  getImplementationRuntimeCodeTaskQueue: vi.fn().mockResolvedValue([]),
  advanceImplementationRuntimeCodeTaskQueue: vi.fn(),
  applyGithubVerifyToImplementationRuntimeCodeTaskQueueItem: vi.fn(),
  assertQueueItemDispatchAllowed: vi.fn(),
  markImplementationRuntimeCodeTaskQueueItemDispatching: vi.fn(),
  markImplementationRuntimeCodeTaskQueueItemCursorRequested: vi.fn(),
}));

vi.mock("@/lib/runtime/implementationRuntime/implementationRuntimeCursorService", () => ({
  markImplementationRuntimeCompleted: (...args: unknown[]) => markCompletedMock(...args),
  markImplementationRuntimeCursorCompleted: vi.fn(),
  markImplementationRuntimeFailed: (...args: unknown[]) => markFailedMock(...args),
  markImplementationRuntimeDispatching: vi.fn(),
  markImplementationRuntimeCursorRunning: vi.fn(),
  markImplementationRuntimeGithubVerifying: vi.fn(),
  recordImplementationRuntimeCursorHeartbeat: vi.fn(),
}));

vi.mock("@/lib/runtime/implementationRuntime/implementationRuntimeRepository", () => ({
  getImplementationRuntimeJobWithRuns: (...args: unknown[]) => getJobMock(...args),
  getImplementationRuntimeBundleByJobId: (...args: unknown[]) => getBundleByJobMock(...args),
  createImplementationCodeTaskRun: (...args: unknown[]) => createRunMock(...args),
  completeImplementationRuntimeJob: vi.fn(),
  pauseImplementationRuntimeJob: (...args: unknown[]) => pauseJobMock(...args),
  transitionImplementationCodeTaskRun: vi.fn(),
}));

import {
  completeImplementationRuntimeGithubVerifyAndAdvance,
  failImplementationRuntimeGithubVerify,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeExecutionService";
import { mapTaskCursorStatusToRuntimeState } from "@/lib/runtime/implementationRuntime/implementationRuntimeTaskCursorSync";

describe("implementationRuntimeGithubAdvance", () => {
  beforeEach(() => {
    markCompletedMock.mockReset();
    markFailedMock.mockReset();
    pauseJobMock.mockReset();
    getJobMock.mockReset();
    createRunMock.mockReset();
    getBundleByJobMock.mockReset();
    markCompletedMock.mockResolvedValue(undefined);
    markFailedMock.mockResolvedValue(undefined);
    pauseJobMock.mockResolvedValue(undefined);
  });

  it("maps cursor_completed to github_verifying and github_verified stays verifying until outcome", () => {
    expect(mapTaskCursorStatusToRuntimeState("cursor_completed")).toBe("github_verifying");
    expect(mapTaskCursorStatusToRuntimeState("github_verified")).toBe("github_verifying");
  });

  it("completeImplementationRuntimeGithubVerifyAndAdvance stores commitSha and creates next queued run", async () => {
    getJobMock.mockResolvedValue({
      id: "job-1",
      projectId: "p1",
      status: "running",
      currentCodeTaskId: "ct-a",
      selectedCodeTaskIds: ["ct-a", "ct-b"],
      failureReason: null,
      startedAt: null,
      completedAt: null,
      updatedAt: "2026-06-03T00:00:00.000Z",
      runs: [
        {
          id: "run-a",
          projectId: "p1",
          jobId: "job-1",
          codeTaskId: "ct-a",
          runtimeState: "completed",
          cursorAgentId: "agent-1",
          branchName: "wip/a",
          commitSha: "sha1",
          pullRequestUrl: "https://github.com/o/r/pull/1",
          failureReason: null,
          lastHeartbeatAt: null,
          startedAt: null,
          completedAt: "2026-06-03T01:00:00.000Z",
          updatedAt: "2026-06-03T01:00:00.000Z",
        },
      ],
    });
    createRunMock.mockResolvedValue({
      id: "run-b",
      projectId: "p1",
      jobId: "job-1",
      codeTaskId: "ct-b",
      runtimeState: "queued",
      cursorAgentId: null,
      branchName: null,
      commitSha: null,
      pullRequestUrl: null,
      failureReason: null,
      lastHeartbeatAt: null,
      startedAt: null,
      completedAt: null,
      updatedAt: "2026-06-03T01:00:00.000Z",
    });
    getBundleByJobMock.mockResolvedValue({
      job: { id: "job-1", status: "running", currentCodeTaskId: "ct-b" },
      runs: [],
      currentRun: { id: "run-b", runtimeState: "queued", codeTaskId: "ct-b" },
    });

    await completeImplementationRuntimeGithubVerifyAndAdvance({
      projectId: "p1",
      jobId: "job-1",
      runId: "run-a",
      commitSha: "sha1",
      pullRequestUrl: "https://github.com/o/r/pull/1",
    });

    expect(markCompletedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        commitSha: "sha1",
        pullRequestUrl: "https://github.com/o/r/pull/1",
      }),
    );
    expect(createRunMock).toHaveBeenCalledWith(
      expect.objectContaining({ codeTaskId: "ct-b" }),
    );
  });

  it("failImplementationRuntimeGithubVerify marks failed and pauses job", async () => {
    getBundleByJobMock.mockResolvedValue({
      job: { id: "job-1", status: "paused" },
      runs: [],
      currentRun: null,
    });

    await failImplementationRuntimeGithubVerify({
      projectId: "p1",
      jobId: "job-1",
      runId: "run-a",
    });

    expect(markFailedMock).toHaveBeenCalledWith(
      expect.objectContaining({ failureReason: "github_verify_failed" }),
    );
    expect(pauseJobMock).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "job-1", failureReason: "github_verify_failed" }),
    );
  });
});
