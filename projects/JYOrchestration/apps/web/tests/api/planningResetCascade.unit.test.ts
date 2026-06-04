import { beforeEach, describe, expect, it, vi } from "vitest";

const deleteRunsMock = vi.fn();
const deleteEventsMock = vi.fn();
const deleteJobsMock = vi.fn();
const deleteTaskCursorMock = vi.fn();
const createEventMock = vi.fn();
const cancelActiveMock = vi.fn();
const getBundleMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        implementationCodeTaskRun: { deleteMany: deleteRunsMock },
        implementationRuntimeEvent: { deleteMany: deleteEventsMock, create: createEventMock },
        implementationExecutionJob: { deleteMany: deleteJobsMock },
        taskCursorExecutionJob: { deleteMany: deleteTaskCursorMock },
      }),
  },
}));

vi.mock("@/lib/prototype/taskCursorExecutionJobRepository", () => ({
  cancelActiveTaskCursorJobsForProject: (...args: unknown[]) => cancelActiveMock(...args),
}));

vi.mock("@/lib/runtime/implementationRuntime/implementationRuntimeRepository", () => ({
  getImplementationRuntimeBundle: (...args: unknown[]) => getBundleMock(...args),
}));

import { resetProjectDownstreamFromPlanning } from "@/lib/requirements/planningResetCascadeService";

describe("resetProjectDownstreamFromPlanning", () => {
  beforeEach(() => {
    deleteRunsMock.mockReset();
    deleteEventsMock.mockReset();
    deleteJobsMock.mockReset();
    deleteTaskCursorMock.mockReset();
    createEventMock.mockReset();
    cancelActiveMock.mockReset();
    getBundleMock.mockReset();
    deleteRunsMock.mockResolvedValue({ count: 2 });
    deleteEventsMock.mockResolvedValue({ count: 5 });
    deleteJobsMock.mockResolvedValue({ count: 1 });
    deleteTaskCursorMock.mockResolvedValue({ count: 4 });
    createEventMock.mockResolvedValue({});
    cancelActiveMock.mockResolvedValue(1);
    getBundleMock.mockResolvedValue({ job: null, runs: [], currentRun: null });
  });

  it("deletes runtime jobs, runs, and task cursor jobs for project", async () => {
    const result = await resetProjectDownstreamFromPlanning({
      projectId: "p1",
      reason: "planning_reset",
    });

    expect(cancelActiveMock).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "p1", failureReason: "cancelled_by_planning_reset" }),
    );
    expect(deleteRunsMock).toHaveBeenCalledWith({ where: { projectId: "p1" } });
    expect(deleteJobsMock).toHaveBeenCalledWith({ where: { projectId: "p1" } });
    expect(deleteTaskCursorMock).toHaveBeenCalledWith({ where: { projectId: "p1" } });
    expect(result.resetRuntimeJobs).toBe(1);
    expect(result.resetCodeTaskRuns).toBe(2);
    expect(result.resetTaskCursorJobs).toBe(4);
    expect(result.githubResourcesDeleted).toBe(false);
    expect(result.resetStateKeys.length).toBeGreaterThan(0);
  });

  it("records planning_reset_cascade event and returns empty bundle", async () => {
    await resetProjectDownstreamFromPlanning({ projectId: "p1", reason: "planning_reset" });

    expect(createEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: "planning_reset_cascade", projectId: "p1" }),
      }),
    );
    expect(getBundleMock).toHaveBeenCalledWith("p1");
  });

  it("throws when runtime bundle is not empty after reset", async () => {
    getBundleMock.mockResolvedValue({
      job: { id: "j1" },
      runs: [{ id: "r1" }],
      currentRun: { id: "r1" },
    });

    await expect(
      resetProjectDownstreamFromPlanning({ projectId: "p1", reason: "planning_reset" }),
    ).rejects.toThrow(/cascade incomplete/);
  });
});
