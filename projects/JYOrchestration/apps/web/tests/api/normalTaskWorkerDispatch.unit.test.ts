import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runCursorMock = vi.fn();
const runPipelineMock = vi.fn();
const confirmReflectionMock = vi.fn();
const findUniqueTaskMock = vi.fn();
const findUniqueSetupMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("@/lib/runtime/cursorExecutionJobSync", () => ({
  runCursorJobSynchronously: (...args: unknown[]) => runCursorMock(...args),
}));

vi.mock("@/lib/runtime/pipelineExecutionJobSync", () => ({
  runPipelineJobSynchronously: (...args: unknown[]) => runPipelineMock(...args),
}));

vi.mock("@/lib/runtime/cursorExecutionReflection", () => ({
  confirmCursorGitReflection: (...args: unknown[]) => confirmReflectionMock(...args),
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

vi.mock("@/lib/executionLoop/workflowState", () => ({
  refreshWorkflowStates: (...args: unknown[]) => refreshMock(...args),
}));

import {
  isNormalTaskWorkerDispatchEnabled,
  runNormalTaskViaRuntimeWorkers,
  shouldUseRuntimeWorkerPathForTask,
} from "@/lib/runtime/normalTaskWorkerDispatch";
import { ENV_TEST_TASK_KIND } from "@/lib/execution/envTestTaskKind";

describe("normalTaskWorkerDispatch", () => {
  const baseInput = {
    projectId: "proj-1",
    taskId: "task-1",
    actorUserId: "user-1",
    execRunId: "run-1",
    singleTaskId: "task-1",
  };

  beforeEach(() => {
    runCursorMock.mockReset();
    runPipelineMock.mockReset();
    confirmReflectionMock.mockReset();
    findUniqueTaskMock.mockReset();
    findUniqueSetupMock.mockReset();
    refreshMock.mockReset();

    findUniqueTaskMock.mockResolvedValue({ taskKind: null });
    findUniqueSetupMock.mockResolvedValue({
      gitRepoUrl: "https://github.com/o/r",
      baseBranch: "main",
      githubAccessToken: null,
    });
    confirmReflectionMock.mockResolvedValue({ confirmed: true, reason: "ok" });
    runPipelineMock.mockResolvedValue({
      ok: true,
      message: "merged",
      jobId: "pipe-job-1",
      code: "MERGED",
    });
  });

  afterEach(() => {
    delete process.env.EXECUTION_LOOP_CURSOR_VIA_JOB;
  });

  it("shouldUseRuntimeWorkerPathForTask is false for ENV_TEST", () => {
    process.env.EXECUTION_LOOP_CURSOR_VIA_JOB = "1";
    expect(shouldUseRuntimeWorkerPathForTask(ENV_TEST_TASK_KIND)).toBe(false);
    expect(shouldUseRuntimeWorkerPathForTask(null)).toBe(true);
  });

  it("isNormalTaskWorkerDispatchEnabled respects feature flag", () => {
    expect(isNormalTaskWorkerDispatchEnabled()).toBe(false);
    process.env.EXECUTION_LOOP_CURSOR_VIA_JOB = "1";
    expect(isNormalTaskWorkerDispatchEnabled()).toBe(true);
  });

  it("cursor success enqueues pipeline; cursor failure skips pipeline", async () => {
    runCursorMock.mockResolvedValueOnce({
      ok: true,
      jobId: "cursor-job-1",
      message: "ok",
      cursorOutcome: {
        ok: true,
        result: {
          runId: "c1",
          summary: "s",
          changedFiles: ["a.ts"],
          branchName: "orch/t1",
          commitHash: "sha",
        },
        logs: [],
      },
    });

    const okRes = await runNormalTaskViaRuntimeWorkers(baseInput);
    expect(okRes.ok).toBe(true);
    expect(okRes.cursorJobId).toBe("cursor-job-1");
    expect(okRes.pipelineJobId).toBe("pipe-job-1");
    expect(runPipelineMock).toHaveBeenCalledOnce();

    runCursorMock.mockResolvedValueOnce({ ok: false, message: "cursor failed" });
    runPipelineMock.mockClear();
    const failRes = await runNormalTaskViaRuntimeWorkers(baseInput);
    expect(failRes.ok).toBe(false);
    expect(runPipelineMock).not.toHaveBeenCalled();
  });

  it("reflection not confirmed skips pipeline", async () => {
    confirmReflectionMock.mockResolvedValueOnce({ confirmed: false, reason: "gate" });
    runCursorMock.mockResolvedValueOnce({
      ok: true,
      jobId: "cursor-job-2",
      cursorOutcome: {
        ok: true,
        result: {
          runId: "c2",
          summary: "s",
          changedFiles: [],
          branchName: "orch/t2",
        },
        logs: [],
      },
    });

    const res = await runNormalTaskViaRuntimeWorkers(baseInput);
    expect(res.ok).toBe(true);
    expect(res.pipelineJobId).toBeUndefined();
    expect(runPipelineMock).not.toHaveBeenCalled();
  });

  it("rejects ENV_TEST task kinds", async () => {
    findUniqueTaskMock.mockResolvedValueOnce({ taskKind: ENV_TEST_TASK_KIND });
    const res = await runNormalTaskViaRuntimeWorkers(baseInput);
    expect(res.ok).toBe(false);
    expect(runCursorMock).not.toHaveBeenCalled();
  });
});
