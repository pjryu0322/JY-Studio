import { describe, expect, it } from "vitest";
import {
  EXECUTION_FORCE_RELEASE_FAILURE_REASON,
  IMPLEMENTATION_EXECUTION_STALE_MINUTES,
} from "@/lib/prototype/implementationExecutionDeadlockRecovery";
import { recoverImplementationRuntimeState } from "@/lib/prototype/implementationRuntimeRecovery";
import { isStaleAbandonedTaskCursorExecution } from "@/lib/prototype/taskCursorClientPollLoop";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";

const NOW = "2026-06-02T12:00:00.000Z";
const STALE_NOW = "2026-06-02T12:35:00.000Z";

function sampleRun(overrides: Partial<CodeTaskExecutionRunV1> = {}): CodeTaskExecutionRunV1 {
  return {
    version: "code_task_execution_run_v1",
    runId: "run-1",
    projectId: "p1",
    processTaskId: "DEV-A",
    workItemId: "wi-1",
    codeTaskId: "CT-1",
    status: "cursor_running",
    attemptNo: 1,
    createdAt: "2026-06-02T11:00:00.000Z",
    updatedAt: "2026-06-02T11:00:00.000Z",
    ...overrides,
  };
}

function sampleCursor(overrides: Partial<TaskCursorExecutionV1> = {}): TaskCursorExecutionV1 {
  return {
    version: "task_cursor_execution_v1",
    projectId: "p1",
    taskId: "DEV-A",
    workItemIds: ["wi-1"],
    status: "cursor_running",
    cursorProvider: "cursor",
    targetRepository: "org/repo",
    baseBranch: "main",
    workBranch: "feature/ct-1",
    cursorRunId: "bc-00000000-0000-4000-8000-000000000001",
    createdAt: "2026-06-02T11:00:00.000Z",
    updatedAt: "2026-06-02T11:00:00.000Z",
    ...overrides,
  };
}

describe("recoverImplementationRuntimeState", () => {
  it("marks stale task cursor and run after 30 minutes", () => {
    const result = recoverImplementationRuntimeState({
      projectId: "p1",
      rawRequirementsState: {
        taskCursorExecutionV1: sampleCursor(),
        codeTaskExecutionRunsV1: [sampleRun({ status: "cursor_running" })],
        codeTaskExecutionQueueV1: {
          version: "code_task_execution_queue_v1",
          projectId: "p1",
          selectedCodeTaskIds: ["CT-1"],
          currentIndex: 0,
          status: "running",
          createdAt: NOW,
          updatedAt: NOW,
        },
      },
      nowIso: STALE_NOW,
    });
    expect(result.issues.some((i) => i.includes("cursor") || i.includes("stale"))).toBe(true);
    const runs = result.patch?.codeTaskExecutionRunsV1 as CodeTaskExecutionRunV1[];
    expect(runs[0]?.status).toBe("status_check_stopped");
    expect(runs[0]?.failureReason).toBe("status_check_stopped");
  });

  it("force release stops in-flight runs and pauses queue", () => {
    const result = recoverImplementationRuntimeState({
      projectId: "p1",
      rawRequirementsState: {
        taskCursorExecutionV1: sampleCursor({ status: "cursor_requested", cursorRunId: undefined }),
        codeTaskExecutionRunsV1: [sampleRun({ status: "queued" })],
        codeTaskExecutionQueueV1: {
          version: "code_task_execution_queue_v1",
          projectId: "p1",
          selectedCodeTaskIds: ["CT-1"],
          currentIndex: 0,
          status: "running",
          createdAt: NOW,
          updatedAt: NOW,
        },
        implementationQuickRunV1: {
          version: "implementation_quick_run_v1",
          projectId: "p1",
          status: "running",
          updatedAt: NOW,
        },
      },
      nowIso: NOW,
      forceRelease: true,
    });
    expect(result.issues).toContain("force_release");
    const runs = result.patch?.codeTaskExecutionRunsV1 as CodeTaskExecutionRunV1[];
    expect(runs[0]?.failureReason).toBe(EXECUTION_FORCE_RELEASE_FAILURE_REASON);
    expect(result.patch?.codeTaskExecutionQueueV1).toMatchObject({ status: "paused" });
    expect(result.patch?.implementationQuickRunV1).toMatchObject({ status: "paused" });
  });
});

describe("isStaleAbandonedTaskCursorExecution", () => {
  it("treats long-running cursor as stale when staleMinutes is set", () => {
    const recentIso = new Date(Date.now() - 5 * 60_000).toISOString();
    const oldIso = new Date(Date.now() - 31 * 60_000).toISOString();
    expect(
      isStaleAbandonedTaskCursorExecution(sampleCursor({ updatedAt: recentIso, createdAt: recentIso }), {
        staleMinutes: IMPLEMENTATION_EXECUTION_STALE_MINUTES,
      }),
    ).toBe(false);
    expect(
      isStaleAbandonedTaskCursorExecution(sampleCursor({ updatedAt: oldIso, createdAt: oldIso }), {
        staleMinutes: IMPLEMENTATION_EXECUTION_STALE_MINUTES,
      }),
    ).toBe(true);
  });
});
