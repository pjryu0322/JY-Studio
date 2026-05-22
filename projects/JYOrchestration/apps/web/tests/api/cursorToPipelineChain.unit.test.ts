import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const confirmMock = vi.fn();
const enqueueMock = vi.fn();
const appendEventMock = vi.fn();
const refreshMock = vi.fn();
const findUniqueTaskMock = vi.fn();
const findUniqueSetupMock = vi.fn();

vi.mock("@/lib/runtime/cursorExecutionReflection", () => ({
  confirmCursorGitReflection: (...args: unknown[]) => confirmMock(...args),
}));

vi.mock("@/lib/service/executionQueue", () => ({
  enqueueExecution: (...args: unknown[]) => enqueueMock(...args),
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
    confirmMock.mockReset();
    enqueueMock.mockReset();
    appendEventMock.mockReset();
    refreshMock.mockReset();
    findUniqueTaskMock.mockResolvedValue({ taskKind: null });
    findUniqueSetupMock.mockResolvedValue({
      gitRepoUrl: "https://github.com/o/r",
      baseBranch: "main",
      githubAccessToken: null,
    });
    confirmMock.mockResolvedValue({ confirmed: true, reason: "ok" });
    enqueueMock.mockResolvedValue({ queued: true, jobId: "pipe-1" });
    appendEventMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete process.env.RUNTIME_CURSOR_CHAIN_PIPELINE;
  });

  it("chains to pipeline on success by default", async () => {
    const res = await maybeChainCursorJobToPipeline(base);
    expect(res.chained).toBe(true);
    expect(res.pipelineJobId).toBe("pipe-1");
    expect(enqueueMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "pipeline" }),
    );
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
});
