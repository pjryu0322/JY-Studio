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
  isLegacyInlineCursorPathForced,
  runNormalTaskViaRuntimeWorkers,
  shouldUseRuntimeWorkerPathForTask,
} from "@/lib/runtime/normalTaskWorkerDispatch";
import {
  ENV_TEST_STAGE2_TASK_KIND,
  ENV_TEST_TASK_KIND,
} from "@/lib/execution/envTestTaskKind";

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

    delete process.env.EXECUTION_LOOP_FORCE_INLINE_CURSOR;
    delete process.env.EXECUTION_LOOP_CURSOR_VIA_JOB;

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
    delete process.env.EXECUTION_LOOP_FORCE_INLINE_CURSOR;
    delete process.env.EXECUTION_LOOP_CURSOR_VIA_JOB;
  });

  it("default policy: normal task uses worker path", () => {
    expect(shouldUseRuntimeWorkerPathForTask(null)).toBe(true);
    expect(isLegacyInlineCursorPathForced()).toBe(false);
  });

  it("EXECUTION_LOOP_FORCE_INLINE_CURSOR disables worker path", () => {
    process.env.EXECUTION_LOOP_FORCE_INLINE_CURSOR = "1";
    expect(shouldUseRuntimeWorkerPathForTask(null)).toBe(false);
    expect(isLegacyInlineCursorPathForced()).toBe(true);
  });

  it("ENV_TEST and ENV_TEST_STAGE2 never use worker path", () => {
    expect(shouldUseRuntimeWorkerPathForTask(ENV_TEST_TASK_KIND)).toBe(false);
    expect(shouldUseRuntimeWorkerPathForTask(ENV_TEST_STAGE2_TASK_KIND)).toBe(false);
  });

  it("records worker dispatch steps through pipeline", async () => {
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

    const res = await runNormalTaskViaRuntimeWorkers(baseInput);
    const phases = res.steps.map((s) => s.phase);
    expect(phases).toContain("worker_dispatch");
    expect(phases).toContain("cursor_job");
    expect(phases).toContain("reflection");
    expect(phases).toContain("pipeline_job");
    expect(phases).toContain("pipeline_result");
    expect(res.ok).toBe(true);
  });

  it("cursor failure skips pipeline", async () => {
    runCursorMock.mockResolvedValueOnce({ ok: false, message: "cursor failed" });
    const res = await runNormalTaskViaRuntimeWorkers(baseInput);
    expect(res.ok).toBe(false);
    expect(runPipelineMock).not.toHaveBeenCalled();
    expect(res.steps.some((s) => s.phase === "pipeline_job")).toBe(false);
  });

  it("reflection not confirmed skips pipeline", async () => {
    confirmReflectionMock.mockResolvedValueOnce({ confirmed: false, reason: "gate" });
    runCursorMock.mockResolvedValueOnce({
      ok: true,
      jobId: "cursor-job-2",
      cursorOutcome: {
        ok: true,
        result: { runId: "c2", summary: "s", changedFiles: [], branchName: "orch/t2" },
        logs: [],
      },
    });

    const res = await runNormalTaskViaRuntimeWorkers(baseInput);
    expect(res.ok).toBe(true);
    expect(runPipelineMock).not.toHaveBeenCalled();
    expect(res.steps.find((s) => s.phase === "reflection")?.ok).toBe(false);
  });

  it("rejects ENV_TEST task kinds", async () => {
    findUniqueTaskMock.mockResolvedValueOnce({ taskKind: ENV_TEST_TASK_KIND });
    const res = await runNormalTaskViaRuntimeWorkers(baseInput);
    expect(res.ok).toBe(false);
    expect(runCursorMock).not.toHaveBeenCalled();
  });
});
