import { describe, expect, it } from "vitest";
import { buildImplementationTaskListFromSeed } from "@/lib/requirements/implementationTaskList";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";
import {
  appendImplementationExecutionJob,
  createImplementationExecutionJob,
  findActiveImplementationExecutionJob,
  hasActiveJobForProcessTask,
  syncImplementationExecutionJobFromTaskCursor,
} from "@/lib/prototype/implementationExecutionJob";
import { classifyImplementationExecutionJobFromTaskCursor } from "@/lib/prototype/implementationExecutionJobResult";
import { pickNextRunnableProcessTaskId } from "@/lib/prototype/implementationExecutionJobSelection";
import { resolveImplementationExecutionJobAutoChainDecision } from "@/lib/prototype/implementationExecutionJobAutoChain";
import { buildImplementationExecutionBoardFromOrchestration } from "@/lib/prototype/implementationExecutionBoard";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";

const NOW = "2026-06-01T12:00:00.000Z";

function makeSeed(): ImplementationSeedV1 {
  return {
    version: "implementation_seed_v1",
    projectId: "p1",
    createdAt: NOW,
    updatedAt: NOW,
    source: "planning_slots_and_artifacts",
    lifecycleStatus: "confirmed",
    readiness: { ready: true, score: 1, missing: [], warnings: [] },
    processImplementationItems: [
      {
        id: "proc-1",
        processName: "회원가입",
        actors: ["user"],
        screens: ["회원가입"],
        actions: ["submit"],
        dataTouched: ["user"],
        exceptions: [],
      },
    ],
    screenImplementationItems: [
      {
        id: "screen-1",
        screenName: "회의록 업로드",
        accessibleActors: ["user"],
        actions: ["upload"],
        visibleData: ["title"],
        editableData: ["file"],
        states: ["idle"],
      },
    ],
    actorCapabilityMatrix: [],
    commonDetailFeatures: [],
    dataModelSeed: {
      entities: ["MeetingNote"],
      fieldsByEntity: { MeetingNote: ["id"] },
      relationships: [],
      mockDataNotes: [],
    },
    assumptions: [],
    gaps: [],
  };
}

function baseExecution(overrides: Partial<TaskCursorExecutionV1> = {}): TaskCursorExecutionV1 {
  return {
    version: "task_cursor_execution_v1",
    projectId: "p1",
    taskId: "DEV-SCREEN-001",
    workItemIds: ["w1"],
    status: "cursor_running",
    cursorProvider: "cursor",
    targetRepository: "org/repo",
    baseBranch: "main",
    workBranch: "wip/cursor/dev-screen-001",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("implementation task list sample data dependency", () => {
  it("links downstream developer tasks to DEV-MOCK-001 after sample data task", () => {
    const list = buildImplementationTaskListFromSeed({ projectId: "p1", seed: makeSeed(), nowIso: NOW });
    const mock = list.tasks.find((t) => t.taskId === "DEV-MOCK-001");
    expect(mock?.title).toMatch(/샘플데이터|샘플 데이터/);
    const devWithMockDep = list.tasks.filter(
      (t) =>
        t.ownerRole === "developer" &&
        t.taskId !== "DEV-MOCK-001" &&
        t.dependencies.includes("DEV-MOCK-001"),
    );
    expect(devWithMockDep.length).toBeGreaterThan(0);
  });
});

describe("ImplementationExecutionJob", () => {
  it("creates job on quick run and blocks duplicate active job", () => {
    const job = createImplementationExecutionJob({
      projectId: "p1",
      processTaskId: "DEV-SCREEN-001",
      nowIso: NOW,
    });
    expect(job.status).toBe("queued");
    expect(job.attemptNo).toBe(1);
    expect(() =>
      createImplementationExecutionJob({
        projectId: "p1",
        processTaskId: "DEV-SCREEN-001",
        jobs: [job],
        nowIso: NOW,
      }),
    ).toThrow();
    expect(hasActiveJobForProcessTask([job], "DEV-SCREEN-001")).toBe(true);
  });

  it("classifies cursor completed without commit as rework_required", () => {
    const result = classifyImplementationExecutionJobFromTaskCursor(
      baseExecution({ status: "cursor_completed" }),
    );
    expect(result.status).toBe("rework_required");
  });

  it("classifies github verified with commitSha as completed", () => {
    const result = classifyImplementationExecutionJobFromTaskCursor(
      baseExecution({ status: "github_verified", commitSha: "abc123" }),
    );
    expect(result.status).toBe("completed");
    expect(result.branchHeadCommitSha).toBe("abc123");
  });

  it("classifies status_check_stopped separately from failed", () => {
    const result = classifyImplementationExecutionJobFromTaskCursor(
      baseExecution({ status: "status_check_stopped", failureReason: "poll_cancelled" }),
    );
    expect(result.status).toBe("status_check_stopped");
  });

  it("syncs task cursor execution into jobs array", () => {
    const jobs = syncImplementationExecutionJobFromTaskCursor({
      jobs: [],
      execution: baseExecution({ status: "github_verified", commitSha: "sha1" }),
      nowIso: NOW,
    });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.status).toBe("completed");
    expect(findActiveImplementationExecutionJob(jobs)).toBeNull();
  });

  it("mock failure blocks only dependent tasks", () => {
    const list = buildImplementationTaskListFromSeed({ projectId: "p1", seed: makeSeed(), nowIso: NOW });
    const board = buildImplementationExecutionBoardFromOrchestration({
      projectId: "p1",
      taskList: list,
    });
    const failedJob = createImplementationExecutionJob({
      projectId: "p1",
      processTaskId: "DEV-MOCK-001",
      nowIso: NOW,
    });
    const jobs = appendImplementationExecutionJob([], {
      ...failedJob,
      status: "failed",
      currentStep: "stopped",
      updatedAt: NOW,
      completedAt: NOW,
    });
    const next = pickNextRunnableProcessTaskId({ board, jobs });
    expect(next).toBeTruthy();
    expect(next).not.toBe("DEV-MOCK-001");
    const nextRow = board.taskRows.find((r) => r.taskId === next);
    expect(nextRow?.developerStatus).not.toBe("failed");
  });

  it("computes next task after terminal job", () => {
    const list = buildImplementationTaskListFromSeed({ projectId: "p1", seed: makeSeed(), nowIso: NOW });
    const board = buildImplementationExecutionBoardFromOrchestration({
      projectId: "p1",
      taskList: list,
    });
    const completed = createImplementationExecutionJob({
      projectId: "p1",
      processTaskId: "DEV-MOCK-001",
      nowIso: NOW,
    });
    const jobs = appendImplementationExecutionJob([], {
      ...completed,
      status: "completed",
      currentStep: "completed",
      commitSha: "abc",
      updatedAt: NOW,
      completedAt: NOW,
    });
    const decision = resolveImplementationExecutionJobAutoChainDecision({
      board,
      jobs,
      projectId: "p1",
    });
    expect(decision.kind).toBe("start");
    if (decision.kind === "start") {
      expect(decision.taskId).not.toBe("DEV-MOCK-001");
    }
  });
});
