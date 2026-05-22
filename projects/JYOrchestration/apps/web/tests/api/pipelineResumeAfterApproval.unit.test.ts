import { beforeEach, describe, expect, it, vi } from "vitest";

const runPipelineMock = vi.fn();
const appendEventMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("@/lib/runtime/pipelineExecutionJobSync", () => ({
  runPipelineJobSynchronously: (...args: unknown[]) => runPipelineMock(...args),
}));

vi.mock("@/lib/runtime/runtimeEventService", () => ({
  appendRuntimeEvent: (...args: unknown[]) => appendEventMock(...args),
}));

vi.mock("@/lib/executionLoop/workflowState", () => ({
  refreshWorkflowStates: (...args: unknown[]) => refreshMock(...args),
}));

import { resumePipelineAfterApprovalViaWorker } from "@/lib/runtime/pipelineResumeAfterApproval";

describe("pipelineResumeAfterApproval", () => {
  beforeEach(() => {
    runPipelineMock.mockReset();
    appendEventMock.mockReset();
    refreshMock.mockReset();
    appendEventMock.mockResolvedValue(undefined);
    runPipelineMock.mockResolvedValue({
      ok: true,
      message: "merged",
      jobId: "pipe-1",
      code: "MERGED",
    });
  });

  it("runs pipeline with resumeScmAfterApproval true", async () => {
    const res = await resumePipelineAfterApprovalViaWorker({
      projectId: "proj-1",
      taskId: "task-1",
      execRunId: "run-1",
      actorUserId: "user-1",
    });

    expect(res.ok).toBe(true);
    expect(runPipelineMock).toHaveBeenCalledWith(
      expect.objectContaining({
        resumeScmAfterApproval: true,
        execRunId: "run-1",
      }),
    );
  });
});
