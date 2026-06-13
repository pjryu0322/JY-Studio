import { describe, expect, it, vi, beforeEach } from "vitest";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";

const getBundleMock = vi.fn();
const ensureQueuedMock = vi.fn();
const markRunningMock = vi.fn();
const syncFromCursorMock = vi.fn();
const schedulePollMock = vi.fn();

vi.mock("@/lib/runtime/implementationRuntime/implementationRuntimeRepository", () => ({
  getImplementationRuntimeBundle: (...args: unknown[]) => getBundleMock(...args),
}));

vi.mock("@/lib/prototype/implementationRuntimeRunMaterialization", () => ({
  ensureQueuedRuntimeRunForCodeTask: (...args: unknown[]) => ensureQueuedMock(...args),
}));

vi.mock("@/lib/runtime/implementationRuntime/implementationRuntimeCursorService", () => ({
  markImplementationRuntimeCursorRunning: (...args: unknown[]) => markRunningMock(...args),
}));

vi.mock("@/lib/runtime/implementationRuntime/implementationRuntimeTaskCursorSync", () => ({
  syncImplementationRuntimeFromTaskCursor: (...args: unknown[]) => syncFromCursorMock(...args),
}));

vi.mock("@/lib/runtime/implementationRuntime/implementationRuntimePollRepository", () => ({
  scheduleImplementationRuntimePoll: (...args: unknown[]) => schedulePollMock(...args),
}));

import { syncCursorLaunchToDbRuntime } from "@/lib/prototype/taskCursorRuntimeSyncAfterLaunch";

describe("syncCursorLaunchToDbRuntime", () => {
  const execution: TaskCursorExecutionV1 = {
    taskId: "DEV-COMMON-002",
    status: "cursor_running",
    cursorRunId: "agent-1",
    workBranch: "wip/common/components",
    baseBranch: "main",
    updatedAt: "2026-06-13T12:00:00.000Z",
  };

  beforeEach(() => {
    getBundleMock.mockReset();
    ensureQueuedMock.mockReset();
    markRunningMock.mockReset();
    syncFromCursorMock.mockReset();
    schedulePollMock.mockReset();
    markRunningMock.mockResolvedValue(undefined);
    syncFromCursorMock.mockResolvedValue(undefined);
    schedulePollMock.mockResolvedValue(undefined);
  });

  it("materializes queued runtime run when missing then schedules poll", async () => {
    getBundleMock
      .mockResolvedValueOnce({
        job: { id: "job-1", status: "running", currentCodeTaskId: "CODE-A" },
        currentRun: null,
        runs: [],
      })
      .mockResolvedValueOnce({
        job: { id: "job-1", status: "running", currentCodeTaskId: "CODE-A" },
        currentRun: { id: "run-1", codeTaskId: "CODE-A", runtimeState: "queued", branchName: "wip/common/components" },
        runs: [{ id: "run-1", codeTaskId: "CODE-A", runtimeState: "queued", branchName: "wip/common/components" }],
      });

    ensureQueuedMock.mockResolvedValue({
      runId: "run-1",
      bundle: {
        job: { id: "job-1", status: "running" },
        currentRun: { id: "run-1", codeTaskId: "CODE-A", runtimeState: "queued" },
        runs: [{ id: "run-1", codeTaskId: "CODE-A", runtimeState: "queued" }],
      },
    });

    const result = await syncCursorLaunchToDbRuntime({
      projectId: "p1",
      codeTaskId: "CODE-A",
      taskId: "DEV-COMMON-002",
      execution,
      agentId: "agent-1",
      workBranch: "wip/common/components",
    });

    expect(ensureQueuedMock).toHaveBeenCalled();
    expect(markRunningMock).toHaveBeenCalled();
    expect(schedulePollMock).toHaveBeenCalledWith(
      expect.objectContaining({ runId: "run-1", firstPollAfterCursorDispatch: true }),
    );
    expect(result.synced).toBe(true);
    expect(result.runId).toBe("run-1");
  });

  it("returns note when active runtime job is missing", async () => {
    getBundleMock.mockResolvedValue({ job: null, runs: [], currentRun: null });
    const result = await syncCursorLaunchToDbRuntime({
      projectId: "p1",
      codeTaskId: "CODE-A",
      taskId: "DEV-COMMON-002",
      execution,
      agentId: "agent-1",
    });
    expect(result.synced).toBe(false);
    expect(result.note).toBe("active_implementation_runtime_job_missing");
  });
});
