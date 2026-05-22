import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENV_TEST_TASK_KIND } from "@/lib/execution/envTestTaskKind";
import {
  assertLegacyInlineAllowedForTaskKind,
  isLegacyInlineNormalTaskPathActive,
  runLegacyInlineNormalTaskExecution,
} from "@/lib/executionLoop/legacyInlineNormalTaskExecution";
import {
  isRuntimeCursorChainPipelineEnabled,
  maybeChainCursorJobToPipeline,
  shouldProcessChainedPipelineImmediately,
} from "@/lib/runtime/cursorToPipelineChain";
import {
  isRuntimeSelfHealingAutoCursorEnabled,
  maybeEnqueueSelfHealingFromReviewFailure,
} from "@/lib/runtime/runtimeSelfHealingBridge";
import { shouldUseRuntimeWorkerPathForTask } from "@/lib/runtime/normalTaskWorkerDispatch";
import { resumePipelineAfterApprovalViaWorker } from "@/lib/runtime/pipelineResumeAfterApproval";
import { validateRuntimeStateConsistency } from "@/lib/runtime/runtimeStateConsistency";
import {
  RUNTIME_E2E_ACTOR_ID,
  RUNTIME_E2E_EXEC_RUN_ID,
  RUNTIME_E2E_PROJECT_ID,
  RUNTIME_E2E_TASK_ID,
  mockCursorSuccessOutcome,
} from "./runtimeWorkerTestFactory";

const findExistingPipelineMock = vi.fn();
const workerDispatchMock = vi.fn();
const resumePipelineMock = vi.fn();
const selfHealingMock = vi.fn();
const findManyJobsMock = vi.fn();
const findRunMock = vi.fn();
const findTaskMock = vi.fn();
const teamStatusMock = vi.fn();
const confirmMock = vi.fn();
const enqueueMock = vi.fn();
const processJobMock = vi.fn();
const findUniqueTaskMock = vi.fn();
const findUniqueSetupMock = vi.fn();

vi.mock("@/lib/runtime/pipelineChainIdempotency", () => ({
  findExistingPipelineJobForExecRun: (...args: unknown[]) => findExistingPipelineMock(...args),
}));

vi.mock("@/lib/runtime/normalTaskWorkerDispatch", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/runtime/normalTaskWorkerDispatch")>();
  return {
    ...mod,
    runNormalTaskViaRuntimeWorkers: (...args: unknown[]) => workerDispatchMock(...args),
  };
});

vi.mock("@/lib/runtime/pipelineResumeAfterApproval", () => ({
  resumePipelineAfterApprovalViaWorker: (...args: unknown[]) => resumePipelineMock(...args),
}));

vi.mock("@/lib/runtime/runtimeSelfHealingBridge", () => ({
  isRuntimeSelfHealingAutoCursorEnabled: () => process.env.RUNTIME_SELF_HEALING_AUTO_CURSOR === "1",
  maybeEnqueueSelfHealingFromReviewFailure: (...args: unknown[]) => selfHealingMock(...args),
}));

vi.mock("@/lib/runtime/cursorExecutionReflection", () => ({
  confirmCursorGitReflection: (...args: unknown[]) => confirmMock(...args),
}));

vi.mock("@/lib/service/executionQueue", () => ({
  enqueueExecution: (...args: unknown[]) => enqueueMock(...args),
}));

vi.mock("@/lib/service/executionWorker", () => ({
  processExecutionJobById: (...args: unknown[]) => processJobMock(...args),
}));

vi.mock("@/lib/executionLoop/workflowState", () => ({
  refreshWorkflowStates: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    task: { findUnique: (...args: unknown[]) => findUniqueTaskMock(...args) },
    executionSetup: { findUnique: (...args: unknown[]) => findUniqueSetupMock(...args) },
    taskExecutionRun: { findUnique: (...args: unknown[]) => findRunMock(...args) },
    executionJob: { findMany: (...args: unknown[]) => findManyJobsMock(...args) },
  },
}));

vi.mock("@/lib/ai-team-runtime/persist", () => ({
  readTeamExecutionStatus: (...args: unknown[]) => teamStatusMock(...args),
}));

vi.mock("@/lib/prisma/executionSetupSplitColumnsHeal", () => ({
  withExecutionSetupSchemaHealRetry: (fn: () => unknown) => fn(),
}));

describe("runtimeWorkerE2E scenarios", () => {
  const cursorOutcome = mockCursorSuccessOutcome();

  beforeEach(() => {
    delete process.env.EXECUTION_LOOP_FORCE_INLINE_CURSOR;
    delete process.env.RUNTIME_CURSOR_CHAIN_PIPELINE;
    delete process.env.RUNTIME_PROCESS_CHAINED_PIPELINE_IMMEDIATELY;
    delete process.env.RUNTIME_SELF_HEALING_AUTO_CURSOR;
    findExistingPipelineMock.mockResolvedValue({ exists: false });
    workerDispatchMock.mockResolvedValue({
      ok: true,
      message: "pipeline ok",
      steps: [
        { phase: "cursor_job", ok: true, code: "CURSOR_COMPLETED" },
        { phase: "reflection", ok: true, code: "REFLECTION_CONFIRMED" },
        { phase: "pipeline_job", ok: true, code: "PIPELINE_COMPLETED" },
      ],
      cursorJobId: "c1",
      pipelineJobId: "p1",
    });
    resumePipelineMock.mockResolvedValue({
      ok: true,
      code: "MERGED",
      message: "merged",
      pipelineJobId: "p-resume",
    });
    selfHealingMock.mockResolvedValue({
      triggered: true,
      createdTaskIds: ["heal-1"],
      healingExecRunIds: ["heal-run-1"],
      autoCursorEnqueued: false,
    });
    findRunMock.mockResolvedValue({
      id: RUNTIME_E2E_EXEC_RUN_ID,
      taskId: RUNTIME_E2E_TASK_ID,
      projectId: RUNTIME_E2E_PROJECT_ID,
      status: "running",
      evaluationDecision: null,
      prStatus: null,
    });
    findTaskMock.mockResolvedValue({
      id: RUNTIME_E2E_TASK_ID,
      status: "IN_PROGRESS",
      executionWorkflowStatus: "running",
    });
    findManyJobsMock.mockResolvedValue([]);
    teamStatusMock.mockResolvedValue(null);
    confirmMock.mockResolvedValue({ confirmed: true, reason: "ok" });
    enqueueMock.mockResolvedValue({ queued: true, jobId: "pipe-chain-1" });
    processJobMock.mockResolvedValue(undefined);
    findUniqueTaskMock.mockResolvedValue({ taskKind: null });
    findUniqueSetupMock.mockResolvedValue({
      gitRepoUrl: "https://github.com/o/r",
      baseBranch: "main",
      githubAccessToken: null,
    });
  });

  afterEach(() => {
    delete process.env.EXECUTION_LOOP_FORCE_INLINE_CURSOR;
    delete process.env.RUNTIME_CURSOR_CHAIN_PIPELINE;
    delete process.env.RUNTIME_PROCESS_CHAINED_PIPELINE_IMMEDIATELY;
    delete process.env.RUNTIME_SELF_HEALING_AUTO_CURSOR;
  });

  it("3.1 normal task uses worker path by default", () => {
    expect(shouldUseRuntimeWorkerPathForTask(null)).toBe(true);
    expect(isLegacyInlineNormalTaskPathActive()).toBe(false);
  });

  it("3.2 background chain respects syncDispatch and idempotency", async () => {
    const skip = await maybeChainCursorJobToPipeline({
      projectId: RUNTIME_E2E_PROJECT_ID,
      taskId: RUNTIME_E2E_TASK_ID,
      execRunId: RUNTIME_E2E_EXEC_RUN_ID,
      actorUserId: RUNTIME_E2E_ACTOR_ID,
      cursorOutcome,
      skipPipelineChain: true,
    });
    expect(skip.chained).toBe(false);
    expect(enqueueMock).not.toHaveBeenCalled();

    findExistingPipelineMock.mockResolvedValueOnce({
      exists: true,
      jobId: "existing",
      status: "PENDING",
    });
    const dup = await maybeChainCursorJobToPipeline({
      projectId: RUNTIME_E2E_PROJECT_ID,
      taskId: RUNTIME_E2E_TASK_ID,
      execRunId: RUNTIME_E2E_EXEC_RUN_ID,
      actorUserId: RUNTIME_E2E_ACTOR_ID,
      cursorOutcome,
    });
    expect(dup.chained).toBe(false);

    process.env.RUNTIME_PROCESS_CHAINED_PIPELINE_IMMEDIATELY = "0";
    const enqOnly = await maybeChainCursorJobToPipeline({
      projectId: RUNTIME_E2E_PROJECT_ID,
      taskId: RUNTIME_E2E_TASK_ID,
      execRunId: RUNTIME_E2E_EXEC_RUN_ID,
      actorUserId: RUNTIME_E2E_ACTOR_ID,
      cursorOutcome,
    });
    expect(enqOnly.chained).toBe(true);
    expect(enqOnly.pipelineProcessed).toBe(false);
    expect(processJobMock).not.toHaveBeenCalled();
  });

  it("3.3 review reject triggers self-healing without auto cursor by default", async () => {
    const res = await maybeEnqueueSelfHealingFromReviewFailure({
      projectId: RUNTIME_E2E_PROJECT_ID,
      taskId: RUNTIME_E2E_TASK_ID,
      execRunId: RUNTIME_E2E_EXEC_RUN_ID,
      actorUserId: RUNTIME_E2E_ACTOR_ID,
      reviewReason: "reject",
    });
    expect(res.triggered).toBe(true);
    expect(res.createdTaskIds).toContain("heal-1");
    expect(res.autoCursorEnqueued).toBe(false);
    expect(isRuntimeSelfHealingAutoCursorEnabled()).toBe(false);
  });

  it("3.5 approval resume uses worker pipeline with resumeScmAfterApproval", async () => {
    const res = await resumePipelineAfterApprovalViaWorker({
      projectId: RUNTIME_E2E_PROJECT_ID,
      taskId: RUNTIME_E2E_TASK_ID,
      execRunId: RUNTIME_E2E_EXEC_RUN_ID,
      actorUserId: RUNTIME_E2E_ACTOR_ID,
    });
    expect(res.ok).toBe(true);
    expect(resumePipelineMock).toHaveBeenCalled();
  });

  it("3.6 ENV_TEST never uses worker or legacy inline module", () => {
    expect(shouldUseRuntimeWorkerPathForTask(ENV_TEST_TASK_KIND)).toBe(false);
    expect(assertLegacyInlineAllowedForTaskKind(ENV_TEST_TASK_KIND).allowed).toBe(false);
  });

  it("legacy inline dispatches sync worker modules when FORCE_INLINE", async () => {
    process.env.EXECUTION_LOOP_FORCE_INLINE_CURSOR = "1";
    expect(shouldUseRuntimeWorkerPathForTask(null)).toBe(false);
    const out = await runLegacyInlineNormalTaskExecution({
      projectId: RUNTIME_E2E_PROJECT_ID,
      taskId: RUNTIME_E2E_TASK_ID,
      execRunId: RUNTIME_E2E_EXEC_RUN_ID,
      actorUserId: RUNTIME_E2E_ACTOR_ID,
      singleTaskId: RUNTIME_E2E_TASK_ID,
    });
    expect(out.kind).toBe("return");
    if (out.kind === "return") expect(out.result.ok).toBe(true);
    expect(workerDispatchMock).toHaveBeenCalled();
  });

  it("state consistency helper runs without exec run", async () => {
    findRunMock.mockResolvedValueOnce(null);
    const check = await validateRuntimeStateConsistency({
      projectId: RUNTIME_E2E_PROJECT_ID,
      taskId: RUNTIME_E2E_TASK_ID,
      execRunId: "missing",
    });
    expect(check.ok).toBe(false);
    expect(check.issues.some((i) => i.code === "EXEC_RUN_MISSING")).toBe(true);
  });

  it("state consistency passes for aligned worker fixtures", async () => {
    findUniqueTaskMock.mockResolvedValue({
      id: RUNTIME_E2E_TASK_ID,
      status: "IN_PROGRESS",
      executionWorkflowStatus: "running",
    });
    const check = await validateRuntimeStateConsistency({
      projectId: RUNTIME_E2E_PROJECT_ID,
      taskId: RUNTIME_E2E_TASK_ID,
      execRunId: RUNTIME_E2E_EXEC_RUN_ID,
    });
    expect(check.ok).toBe(true);
  });

  it("chain disabled when RUNTIME_CURSOR_CHAIN_PIPELINE=0", () => {
    process.env.RUNTIME_CURSOR_CHAIN_PIPELINE = "0";
    expect(isRuntimeCursorChainPipelineEnabled()).toBe(false);
    expect(shouldProcessChainedPipelineImmediately()).toBe(true);
  });
});
