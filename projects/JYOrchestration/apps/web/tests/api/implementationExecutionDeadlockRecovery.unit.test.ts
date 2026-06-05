import { describe, expect, it } from "vitest";
import {
  EXECUTION_FORCE_RELEASE_FAILURE_REASON,
  EXECUTION_STALE_FAILURE_REASON,
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

const runtimeUiSnapshot = {
  version: "implementation_runtime_ui_snapshot_v1" as const,
  projectId: "p1",
  runtimeState: "cursor_running" as const,
  activeCodeTaskId: "CT-1",
  activeDispatch: {
    codeTaskId: "CT-1",
    parentTaskId: "DEV-A",
    workItemId: "wi-1",
    runId: "run-1",
  },
  githubState: "none" as const,
  updatedAt: NOW,
};

describe("recoverImplementationRuntimeState", () => {
  it("marks stale task cursor and run after 30 minutes", () => {
    const result = recoverImplementationRuntimeState({
      projectId: "p1",
      rawRequirementsState: {
        taskCursorExecutionV1: sampleCursor(),
        codeTaskExecutionRunsV1: [sampleRun({ status: "cursor_running" })],
        implementationRuntimeUiSnapshotV1: runtimeUiSnapshot,
      },
      nowIso: STALE_NOW,
    });
    expect(result.issues.some((i) => i.includes("cursor") || i.includes("stale"))).toBe(true);
    const runs = result.patch?.codeTaskExecutionRunsV1 as CodeTaskExecutionRunV1[];
    expect(runs[0]?.status).toBe("status_check_stopped");
    expect(runs[0]?.failureReason).toBe(EXECUTION_STALE_FAILURE_REASON);
  });

  it("force release stops in-flight runs and pauses quick run", () => {
    const result = recoverImplementationRuntimeState({
      projectId: "p1",
      rawRequirementsState: {
        taskCursorExecutionV1: sampleCursor({ status: "cursor_requested", cursorRunId: undefined }),
        codeTaskExecutionRunsV1: [sampleRun({ status: "queued" })],
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
