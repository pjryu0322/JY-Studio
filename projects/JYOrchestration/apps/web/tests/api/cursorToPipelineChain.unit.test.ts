import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const confirmMock = vi.fn();
const enqueueMock = vi.fn();
const appendEventMock = vi.fn();
const refreshMock = vi.fn();
const findUniqueTaskMock = vi.fn();
const findUniqueSetupMock = vi.fn();
const findExistingPipelineMock = vi.fn();
const processJobMock = vi.fn();

vi.mock("@/lib/runtime/cursorExecutionReflection", () => ({
  confirmCursorGitReflection: (...args: unknown[]) => confirmMock(...args),
}));

vi.mock("@/lib/runtime/pipelineChainIdempotency", () => ({
  findExistingPipelineJobForExecRun: (...args: unknown[]) => findExistingPipelineMock(...args),
}));

vi.mock("@/lib/service/executionQueue", () => ({
  enqueueExecution: (...args: unknown[]) => enqueueMock(...args),
}));

vi.mock("@/lib/service/executionWorker", () => ({
  processExecutionJobById: (...args: unknown[]) => processJobMock(...args),
}));

vi.mock("@/lib/runtime/runtimeEventService", () => ({
  appendRuntimeEvent: (...args: unknown[]) => appendEventMock(...args),
}));

vi.mock("@/lib/executionLoop/workflowState", () => ({
  refreshWorkflowStates: (...args: unknown[]) => refreshMock(...args),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    task: { findUnique: (...args: unknown[]) => findUniqueTaskMock(...args) },
    executionSetup: { findUnique: (...args: unknown[]) => findUniqueSetupMock(...args) },
  },
}));

vi.mock("@/lib/prisma/executionSetupSplitColumnsHeal", () => ({
  withExecutionSetupSchemaHealRetry: (fn: () => unknown) => fn(),
}));

import {
  isRuntimeCursorChainPipelineEnabled,
  maybeChainCursorJobToPipeline,
  shouldProcessChainedPipelineImmediately,
} from "@/lib/runtime/cursorToPipelineChain";

const successOutcome = {
  ok: true,
  result: {
    runId: "c1",
    summary: "ok",
    changedFiles: ["a.ts"],
    branchName: "orch/t1",
    commitHash: "sha",
  },
  logs: [],
};

describe("cursorToPipelineChain", () => {
  const base = {
    projectId: "proj-1",
    taskId: "task-1",
    execRunId: "run-1",
    actorUserId: "user-1",
    cursorOutcome: successOutcome,
    cursorJobId: "cursor-job-1",
  };

  beforeEach(() => {
    delete process.env.RUNTIME_CURSOR_CHAIN_PIPELINE;
    delete process.env.RUNTIME_PROCESS_CHAINED_PIPELINE_IMMEDIATELY;
    confirmMock.mockReset();
    enqueueMock.mockReset();
    appendEventMock.mockReset();
    refreshMock.mockReset();
    findUniqueTaskMock.mockReset();
    findUniqueSetupMock.mockReset();
    findExistingPipelineMock.mockReset();
    processJobMock.mockReset();
    findUniqueTaskMock.mockResolvedValue({ taskKind: null });
    findUniqueSetupMock.mockResolvedValue({
      gitRepoUrl: "https://github.com/o/r",
      baseBranch: "main",
      githubAccessToken: null,
    });
    confirmMock.mockResolvedValue({ confirmed: true, reason: "ok" });
    enqueueMock.mockResolvedValue({ queued: true, jobId: "pipe-1" });
    appendEventMock.mockResolvedValue(undefined);
    findExistingPipelineMock.mockResolvedValue({ exists: false });
    processJobMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete process.env.RUNTIME_CURSOR_CHAIN_PIPELINE;
    delete process.env.RUNTIME_PROCESS_CHAINED_PIPELINE_IMMEDIATELY;
  });

  it("chains to pipeline on success by default", async () => {
    const res = await maybeChainCursorJobToPipeline(base);
    expect(res.chained).toBe(true);
    expect(res.pipelineJobId).toBe("pipe-1");
    expect(res.pipelineProcessed).toBe(true);
    expect(enqueueMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "pipeline" }),
    );
    expect(processJobMock).toHaveBeenCalledWith("pipe-1");
  });

  it("skips when syncDispatch", async () => {
    const res = await maybeChainCursorJobToPipeline({ ...base, skipPipelineChain: true });
    expect(res.chained).toBe(false);
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("skips when RUNTIME_CURSOR_CHAIN_PIPELINE=0", async () => {
    process.env.RUNTIME_CURSOR_CHAIN_PIPELINE = "0";
    expect(isRuntimeCursorChainPipelineEnabled()).toBe(false);
    const res = await maybeChainCursorJobToPipeline(base);
    expect(res.chained).toBe(false);
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("skips pipeline when reflection fails", async () => {
    confirmMock.mockResolvedValueOnce({ confirmed: false, reason: "gate" });
    const res = await maybeChainCursorJobToPipeline(base);
    expect(res.chained).toBe(false);
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("skips enqueue when pipeline already exists for execRun", async () => {
    findExistingPipelineMock.mockResolvedValueOnce({
      exists: true,
      jobId: "existing-pipe",
      status: "PENDING",
      reason: "pipeline_already_exists",
    });
    const res = await maybeChainCursorJobToPipeline(base);
    expect(res.chained).toBe(false);
    expect(res.pipelineJobId).toBe("existing-pipe");
    expect(enqueueMock).not.toHaveBeenCalled();
    expect(appendEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "CURSOR_PIPELINE_CHAIN_SKIPPED" }),
    );
  });

  it("does not process pipeline when RUNTIME_PROCESS_CHAINED_PIPELINE_IMMEDIATELY=0", async () => {
    process.env.RUNTIME_PROCESS_CHAINED_PIPELINE_IMMEDIATELY = "0";
    expect(shouldProcessChainedPipelineImmediately()).toBe(false);
    const res = await maybeChainCursorJobToPipeline(base);
    expect(res.chained).toBe(true);
    expect(res.pipelineProcessed).toBe(false);
    expect(processJobMock).not.toHaveBeenCalled();
  });

  it("records process failure when immediate pipeline process throws", async () => {
    processJobMock.mockRejectedValueOnce(new Error("worker down"));
    const res = await maybeChainCursorJobToPipeline(base);
    expect(res.chained).toBe(false);
    expect(res.reason).toContain("pipeline_process_failed");
    expect(appendEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "CURSOR_PIPELINE_CHAIN_PROCESS_FAILED" }),
    );
  });

  it("includes selfHealingFromExecRunId in chain event detail", async () => {
    await maybeChainCursorJobToPipeline({
      ...base,
      source: "self-healing",
      selfHealingFromExecRunId: "source-run-1",
    });
    expect(appendEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "CURSOR_PIPELINE_CHAINED",
        detail: expect.objectContaining({
          source: "self-healing",
          selfHealingFromExecRunId: "source-run-1",
        }),
      }),
    );
  });
});
