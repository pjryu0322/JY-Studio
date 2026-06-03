import { beforeEach, describe, expect, it, vi } from "vitest";

const getJobMock = vi.fn();
const getBundleByJobMock = vi.fn();
const markDispatchingMock = vi.fn();
const markCursorRunningMock = vi.fn();
const markFailedMock = vi.fn();
const pauseJobMock = vi.fn();

vi.mock("@/lib/runtime/implementationRuntime/implementationRuntimeRepository", () => ({
  getImplementationRuntimeJobWithRuns: (...args: unknown[]) => getJobMock(...args),
  getImplementationRuntimeBundleByJobId: (...args: unknown[]) => getBundleByJobMock(...args),
  pauseImplementationRuntimeJob: (...args: unknown[]) => pauseJobMock(...args),
}));

vi.mock("@/lib/runtime/implementationRuntime/implementationRuntimeCursorService", () => ({
  markImplementationRuntimeDispatching: (...args: unknown[]) => markDispatchingMock(...args),
  markImplementationRuntimeCursorRunning: (...args: unknown[]) => markCursorRunningMock(...args),
  markImplementationRuntimeFailed: (...args: unknown[]) => markFailedMock(...args),
}));

const assertQueueMock = vi.fn();
const markQueueDispatchingMock = vi.fn();
const markQueueCursorRequestedMock = vi.fn();

vi.mock("@/lib/runtime/implementationRuntime/implementationRuntimeCodeTaskQueueService", () => ({
  assertQueueItemDispatchAllowed: (...args: unknown[]) => assertQueueMock(...args),
  markImplementationRuntimeCodeTaskQueueItemDispatching: (...args: unknown[]) =>
    markQueueDispatchingMock(...args),
  markImplementationRuntimeCodeTaskQueueItemCursorRequested: (...args: unknown[]) =>
    markQueueCursorRequestedMock(...args),
}));

import { dispatchNextQueuedImplementationRuntimeRun } from "@/lib/runtime/implementationRuntime/implementationRuntimeExecutionService";

const queuedRun = {
  id: "run-1",
  projectId: "p1",
  jobId: "job-1",
  codeTaskId: "ct-a",
  runtimeState: "queued" as const,
  cursorAgentId: null,
  branchName: null,
  commitSha: null,
  pullRequestUrl: null,
  failureReason: null,
  lastHeartbeatAt: "2026-06-03T00:00:00.000Z",
  startedAt: "2026-06-03T00:00:00.000Z",
  completedAt: null,
  updatedAt: "2026-06-03T00:00:00.000Z",
};

describe("dispatchNextQueuedImplementationRuntimeRun", () => {
  beforeEach(() => {
    getJobMock.mockReset();
    getBundleByJobMock.mockReset();
    markDispatchingMock.mockReset();
    markCursorRunningMock.mockReset();
    markFailedMock.mockReset();
    pauseJobMock.mockReset();
    assertQueueMock.mockReset();
    markQueueDispatchingMock.mockReset();
    markQueueCursorRequestedMock.mockReset();
    assertQueueMock.mockResolvedValue(undefined);
    markQueueDispatchingMock.mockResolvedValue({ id: "qi-1", status: "dispatching" });
    markQueueCursorRequestedMock.mockResolvedValue({ id: "qi-1", status: "cursor_running" });
    markDispatchingMock.mockResolvedValue(undefined);
    markCursorRunningMock.mockResolvedValue(undefined);
    markFailedMock.mockResolvedValue(undefined);
    pauseJobMock.mockResolvedValue(undefined);
    getJobMock.mockResolvedValue({
      id: "job-1",
      projectId: "p1",
      status: "running",
      currentCodeTaskId: "ct-a",
      selectedCodeTaskIds: ["ct-a"],
      failureReason: null,
      startedAt: null,
      completedAt: null,
      updatedAt: "2026-06-03T00:00:00.000Z",
      runs: [queuedRun],
    });
    getBundleByJobMock.mockResolvedValue({
      job: { id: "job-1", status: "running", currentCodeTaskId: "ct-a" },
      runs: [{ ...queuedRun, runtimeState: "cursor_running", cursorAgentId: "agent-9", branchName: "wip/x" }],
      currentRun: { ...queuedRun, runtimeState: "cursor_running", cursorAgentId: "agent-9", branchName: "wip/x" },
    });
  });

  it("transitions queued → dispatching → cursor_running on success", async () => {
    await dispatchNextQueuedImplementationRuntimeRun({
      projectId: "p1",
      jobId: "job-1",
      buildCursorRequest: async () => ({ agentId: "agent-9", branchName: "wip/x" }),
    });

    expect(markDispatchingMock).toHaveBeenCalledWith(
      expect.objectContaining({ runId: "run-1", jobId: "job-1" }),
    );
    expect(markCursorRunningMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cursorAgentId: "agent-9",
        branchName: "wip/x",
      }),
    );
    expect(markFailedMock).not.toHaveBeenCalled();
    expect(pauseJobMock).not.toHaveBeenCalled();
  });

  it("marks failed and pauses job when Cursor launch fails", async () => {
    await expect(
      dispatchNextQueuedImplementationRuntimeRun({
        projectId: "p1",
        jobId: "job-1",
        buildCursorRequest: async () => {
          throw new Error("launch failed");
        },
      }),
    ).rejects.toThrow(/launch failed/);

    expect(markFailedMock).toHaveBeenCalled();
    expect(pauseJobMock).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "job-1", failureReason: "launch failed" }),
    );
  });

  it("does not call Cursor when queue dispatching transition returns null", async () => {
    markQueueDispatchingMock.mockResolvedValue(null);
    const buildCursor = vi.fn();

    await expect(
      dispatchNextQueuedImplementationRuntimeRun({
        projectId: "p1",
        jobId: "job-1",
        buildCursorRequest: buildCursor,
      }),
    ).rejects.toThrow(/dispatching transition failed/);

    expect(buildCursor).not.toHaveBeenCalled();
    expect(markCursorRunningMock).not.toHaveBeenCalled();
  });

  it("does not call Cursor when assertQueueItemDispatchAllowed throws", async () => {
    assertQueueMock.mockRejectedValue(new Error("DB Queue item not found"));
    const buildCursor = vi.fn();

    await expect(
      dispatchNextQueuedImplementationRuntimeRun({
        projectId: "p1",
        jobId: "job-1",
        buildCursorRequest: buildCursor,
      }),
    ).rejects.toThrow(/DB Queue item not found/);

    expect(buildCursor).not.toHaveBeenCalled();
  });

  it("rejects when current run is not queued", async () => {
    getJobMock.mockResolvedValue({
      id: "job-1",
      projectId: "p1",
      status: "running",
      currentCodeTaskId: "ct-a",
      selectedCodeTaskIds: ["ct-a"],
      failureReason: null,
      startedAt: null,
      completedAt: null,
      updatedAt: "2026-06-03T00:00:00.000Z",
      runs: [{ ...queuedRun, runtimeState: "cursor_running" }],
    });

    await expect(
      dispatchNextQueuedImplementationRuntimeRun({
        projectId: "p1",
        jobId: "job-1",
        buildCursorRequest: async () => ({ agentId: "agent-9" }),
      }),
    ).rejects.toThrow(/Only queued runs can be dispatched/);

    expect(markDispatchingMock).not.toHaveBeenCalled();
  });
});
