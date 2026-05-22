import { beforeEach, describe, expect, it, vi } from "vitest";

const findRunMock = vi.fn();
const findTaskMock = vi.fn();
const findManyJobsMock = vi.fn();
const teamStatusMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    taskExecutionRun: { findUnique: (...args: unknown[]) => findRunMock(...args) },
    task: { findUnique: (...args: unknown[]) => findTaskMock(...args) },
    executionJob: { findMany: (...args: unknown[]) => findManyJobsMock(...args) },
  },
}));

vi.mock("@/lib/ai-team-runtime/persist", () => ({
  readTeamExecutionStatus: (...args: unknown[]) => teamStatusMock(...args),
}));

import { validateRuntimeStateConsistency } from "@/lib/runtime/runtimeStateConsistency";

describe("validateRuntimeStateConsistency", () => {
  beforeEach(() => {
    findRunMock.mockReset();
    findTaskMock.mockReset();
    findManyJobsMock.mockReset();
    teamStatusMock.mockReset();
    teamStatusMock.mockResolvedValue(null);
  });

  it("errors when cursor job payload taskId mismatches same execRun", async () => {
    findRunMock.mockResolvedValue({
      id: "run-1",
      taskId: "task-1",
      projectId: "proj-1",
      status: "running",
      evaluationDecision: null,
      prStatus: null,
    });
    findTaskMock.mockResolvedValue({
      id: "task-1",
      status: "IN_PROGRESS",
      executionWorkflowStatus: "running",
    });
    findManyJobsMock.mockResolvedValue([
      {
        id: "job-c",
        type: "cursor",
        status: "DONE",
        payload: {
          execRunId: "run-1",
          taskId: "task-wrong",
          projectId: "proj-1",
          actorUserId: "u1",
        },
      },
    ]);

    const res = await validateRuntimeStateConsistency({
      projectId: "proj-1",
      taskId: "task-1",
      execRunId: "run-1",
    });
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.code === "CURSOR_JOB_PAYLOAD_MISMATCH")).toBe(true);
  });

  it("errors when pipeline job payload execRunId mismatches same task", async () => {
    findRunMock.mockResolvedValue({
      id: "run-1",
      taskId: "task-1",
      projectId: "proj-1",
      status: "running",
      evaluationDecision: null,
      prStatus: null,
    });
    findTaskMock.mockResolvedValue({
      id: "task-1",
      status: "IN_PROGRESS",
      executionWorkflowStatus: "running",
    });
    findManyJobsMock.mockResolvedValue([
      {
        id: "job-p",
        type: "pipeline",
        status: "DONE",
        payload: {
          execRunId: "run-other",
          taskId: "task-1",
          projectId: "proj-1",
          actorUserId: "u1",
        },
      },
    ]);

    const res = await validateRuntimeStateConsistency({
      projectId: "proj-1",
      taskId: "task-1",
      execRunId: "run-1",
    });
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.code === "PIPELINE_JOB_PAYLOAD_MISMATCH")).toBe(true);
  });

  it("errors when execRun taskId does not match input taskId", async () => {
    findRunMock.mockResolvedValue({
      id: "run-1",
      taskId: "task-wrong",
      projectId: "proj-1",
      status: "running",
      evaluationDecision: null,
      prStatus: null,
    });
    findTaskMock.mockResolvedValue({
      id: "task-1",
      status: "IN_PROGRESS",
      executionWorkflowStatus: "running",
    });
    findManyJobsMock.mockResolvedValue([]);

    const res = await validateRuntimeStateConsistency({
      projectId: "proj-1",
      taskId: "task-1",
      execRunId: "run-1",
    });
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.code === "EXEC_RUN_TASK_MISMATCH")).toBe(true);
  });

  it("errors when review rejected but pipeline completed", async () => {
    findRunMock.mockResolvedValue({
      id: "run-1",
      taskId: "task-1",
      projectId: "proj-1",
      status: "failed",
      evaluationDecision: "retry",
      prStatus: null,
    });
    findTaskMock.mockResolvedValue({
      id: "task-1",
      status: "IN_PROGRESS",
      executionWorkflowStatus: "review_rejected",
    });
    findManyJobsMock.mockResolvedValue([
      {
        id: "job-p",
        type: "pipeline",
        status: "DONE",
        payload: {
          execRunId: "run-1",
          taskId: "task-1",
          projectId: "proj-1",
          actorUserId: "u1",
        },
      },
    ]);

    const res = await validateRuntimeStateConsistency({
      projectId: "proj-1",
      taskId: "task-1",
      execRunId: "run-1",
    });
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.code === "REJECTED_WITH_COMPLETED_PIPELINE")).toBe(true);
  });
});
