import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const findManyMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    executionJob: { findMany: (...args: unknown[]) => findManyMock(...args) },
  },
}));

import {
  findExistingPipelineJobForExecRun,
  isRuntimeAllowRechainAfterPipelineFailed,
} from "@/lib/runtime/pipelineChainIdempotency";

describe("pipelineChainIdempotency", () => {
  beforeEach(() => {
    delete process.env.RUNTIME_ALLOW_RECHAIN_AFTER_PIPELINE_FAILED;
    findManyMock.mockReset();
  });

  afterEach(() => {
    delete process.env.RUNTIME_ALLOW_RECHAIN_AFTER_PIPELINE_FAILED;
  });

  it("detects existing PENDING pipeline for same execRun", async () => {
    findManyMock.mockResolvedValue([
      {
        id: "job-1",
        status: "PENDING",
        payload: {
          execRunId: "run-1",
          taskId: "task-1",
          projectId: "proj-1",
          actorUserId: "u1",
        },
      },
    ]);
    const res = await findExistingPipelineJobForExecRun({
      projectId: "proj-1",
      taskId: "task-1",
      execRunId: "run-1",
    });
    expect(res.exists).toBe(true);
    expect(res.jobId).toBe("job-1");
  });

  it("blocks rechain on FAILED unless flag set", async () => {
    findManyMock.mockResolvedValue([
      {
        id: "job-f",
        status: "FAILED",
        payload: {
          execRunId: "run-1",
          taskId: "task-1",
          projectId: "proj-1",
          actorUserId: "u1",
        },
      },
    ]);
    expect(
      await findExistingPipelineJobForExecRun({
        projectId: "proj-1",
        taskId: "task-1",
        execRunId: "run-1",
      }),
    ).toMatchObject({ exists: true, reason: "pipeline_failed_blocks_rechain" });

    process.env.RUNTIME_ALLOW_RECHAIN_AFTER_PIPELINE_FAILED = "1";
    expect(isRuntimeAllowRechainAfterPipelineFailed()).toBe(true);
    expect(
      await findExistingPipelineJobForExecRun({
        projectId: "proj-1",
        taskId: "task-1",
        execRunId: "run-1",
      }),
    ).toMatchObject({ exists: false });
  });
});
