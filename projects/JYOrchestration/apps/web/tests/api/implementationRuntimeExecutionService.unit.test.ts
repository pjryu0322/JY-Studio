import { beforeEach, describe, expect, it, vi } from "vitest";

const createWithFirstRunMock = vi.fn();
const getJobWithRunsMock = vi.fn();
const createRunMock = vi.fn();
const completeJobMock = vi.fn();
const getBundleByJobMock = vi.fn();
const transitionRunMock = vi.fn();

vi.mock("@/lib/runtime/implementationRuntime/implementationRuntimeRepository", () => ({
  createImplementationRuntimeJobWithFirstRun: (...args: unknown[]) => createWithFirstRunMock(...args),
  getImplementationRuntimeJobWithRuns: (...args: unknown[]) => getJobWithRunsMock(...args),
  createImplementationCodeTaskRun: (...args: unknown[]) => createRunMock(...args),
  completeImplementationRuntimeJob: (...args: unknown[]) => completeJobMock(...args),
  getImplementationRuntimeBundleByJobId: (...args: unknown[]) => getBundleByJobMock(...args),
  transitionImplementationCodeTaskRun: (...args: unknown[]) => transitionRunMock(...args),
}));

import {
  advanceImplementationRuntimeJob,
  failCurrentImplementationRuntimeRun,
  startImplementationRuntimeJobFromCodeTasks,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeExecutionService";

const jobBase = {
  id: "job-1",
  projectId: "p1",
  failureReason: null,
  startedAt: "2026-06-03T00:00:00.000Z",
  completedAt: null,
  updatedAt: "2026-06-03T00:00:00.000Z",
};

const run = (
  codeTaskId: string,
  runtimeState: string,
  id = `run-${codeTaskId}`,
): {
  id: string;
  projectId: string;
  jobId: string;
  codeTaskId: string;
  runtimeState: string;
  cursorAgentId: null;
  branchName: null;
  commitSha: null;
  pullRequestUrl: null;
  failureReason: null;
  lastHeartbeatAt: string;
  startedAt: string;
  completedAt: string | null;
  updatedAt: string;
} => ({
  id,
  projectId: "p1",
  jobId: "job-1",
  codeTaskId,
  runtimeState,
  cursorAgentId: null,
  branchName: null,
  commitSha: null,
  pullRequestUrl: null,
  failureReason: null,
  lastHeartbeatAt: "2026-06-03T00:00:00.000Z",
  startedAt: "2026-06-03T00:00:00.000Z",
  completedAt: runtimeState === "completed" || runtimeState === "failed" ? "2026-06-03T01:00:00.000Z" : null,
  updatedAt: "2026-06-03T01:00:00.000Z",
});

describe("implementationRuntimeExecutionService", () => {
  beforeEach(() => {
    createWithFirstRunMock.mockReset();
    getJobWithRunsMock.mockReset();
    createRunMock.mockReset();
    completeJobMock.mockReset();
    getBundleByJobMock.mockReset();
    transitionRunMock.mockReset();
    getBundleByJobMock.mockImplementation(async () => ({
      job: { ...jobBase, status: "running", currentCodeTaskId: "ct-a", selectedCodeTaskIds: ["ct-a", "ct-b"] },
      runs: [run("ct-a", "completed")],
      currentRun: run("ct-a", "completed"),
    }));
  });

  it("startImplementationRuntimeJobFromCodeTasks creates job and first run", async () => {
    createWithFirstRunMock.mockResolvedValue({
      job: { ...jobBase, status: "running", currentCodeTaskId: "ct-a", selectedCodeTaskIds: ["ct-a", "ct-b"] },
      runs: [run("ct-a", "queued")],
      currentRun: run("ct-a", "queued"),
    });

    const bundle = await startImplementationRuntimeJobFromCodeTasks({
      projectId: "p1",
      selectedCodeTaskIds: ["ct-a", "ct-b"],
    });

    expect(createWithFirstRunMock).toHaveBeenCalledWith({
      projectId: "p1",
      selectedCodeTaskIds: ["ct-a", "ct-b"],
    });
    expect(bundle.currentRun?.runtimeState).toBe("queued");
  });

  it("does not create duplicate job when active job exists (repository guard)", async () => {
    const existing = {
      job: { ...jobBase, status: "running", currentCodeTaskId: "ct-a", selectedCodeTaskIds: ["ct-a"] },
      runs: [run("ct-a", "cursor_running")],
      currentRun: run("ct-a", "cursor_running"),
    };
    createWithFirstRunMock.mockResolvedValue(existing);

    const bundle = await startImplementationRuntimeJobFromCodeTasks({
      projectId: "p1",
      selectedCodeTaskIds: ["ct-x"],
    });

    expect(bundle.job?.id).toBe("job-1");
    expect(bundle.currentRun?.runtimeState).toBe("cursor_running");
  });

  it("rejects empty selectedCodeTaskIds on start", async () => {
    await expect(
      startImplementationRuntimeJobFromCodeTasks({ projectId: "p1", selectedCodeTaskIds: [] }),
    ).rejects.toThrow(/selectedCodeTaskIds is required/);
  });

  it("advance creates queued run for next CodeTask after current completes", async () => {
    getJobWithRunsMock.mockResolvedValue({
      ...jobBase,
      status: "running",
      currentCodeTaskId: "ct-a",
      selectedCodeTaskIds: ["ct-a", "ct-b"],
      runs: [run("ct-a", "completed")],
    });
    createRunMock.mockResolvedValue(run("ct-b", "queued"));
    getBundleByJobMock.mockResolvedValue({
      job: { ...jobBase, status: "running", currentCodeTaskId: "ct-b", selectedCodeTaskIds: ["ct-a", "ct-b"] },
      runs: [run("ct-a", "completed"), run("ct-b", "queued")],
      currentRun: run("ct-b", "queued"),
    });

    const bundle = await advanceImplementationRuntimeJob({ projectId: "p1", jobId: "job-1" });

    expect(createRunMock).toHaveBeenCalledWith({
      projectId: "p1",
      jobId: "job-1",
      codeTaskId: "ct-b",
    });
    expect(completeJobMock).not.toHaveBeenCalled();
    expect(bundle.currentRun?.codeTaskId).toBe("ct-b");
  });

  it("advance completes job when last CodeTask is terminal", async () => {
    getJobWithRunsMock.mockResolvedValue({
      ...jobBase,
      status: "running",
      currentCodeTaskId: "ct-b",
      selectedCodeTaskIds: ["ct-a", "ct-b"],
      runs: [run("ct-a", "completed"), run("ct-b", "completed")],
    });
    getBundleByJobMock.mockResolvedValue({
      job: { ...jobBase, status: "completed", currentCodeTaskId: "ct-b", selectedCodeTaskIds: ["ct-a", "ct-b"] },
      runs: [run("ct-a", "completed"), run("ct-b", "completed")],
      currentRun: run("ct-b", "completed"),
    });

    await advanceImplementationRuntimeJob({ projectId: "p1", jobId: "job-1" });

    expect(createRunMock).not.toHaveBeenCalled();
    expect(completeJobMock).toHaveBeenCalledWith({ jobId: "job-1", status: "completed" });
  });

  it("advance completes job with completed_with_issues when mixed terminal states", async () => {
    getJobWithRunsMock.mockResolvedValue({
      ...jobBase,
      status: "running",
      currentCodeTaskId: "ct-b",
      selectedCodeTaskIds: ["ct-a", "ct-b"],
      runs: [run("ct-a", "completed"), run("ct-b", "failed")],
    });

    await advanceImplementationRuntimeJob({ projectId: "p1", jobId: "job-1" });

    expect(completeJobMock).toHaveBeenCalledWith({
      jobId: "job-1",
      status: "completed_with_issues",
    });
  });

  it("failCurrentImplementationRuntimeRun marks run failed", async () => {
    transitionRunMock.mockResolvedValue(run("ct-a", "failed"));
    await failCurrentImplementationRuntimeRun({
      projectId: "p1",
      jobId: "job-1",
      runId: "run-ct-a",
      failureReason: "boom",
    });
    expect(transitionRunMock).toHaveBeenCalledWith(
      expect.objectContaining({ runId: "run-ct-a", toState: "failed" }),
    );
    expect(getBundleByJobMock).toHaveBeenCalled();
  });
});
