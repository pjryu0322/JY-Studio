import { describe, expect, it } from "vitest";
import {
  evaluateTaskCursorWorkerStallWarning,
  TASK_CURSOR_SERVER_WORKER_STALL_WARN_MS,
} from "@/lib/prototype/taskCursorWorkerStallWatch";

const NOW = Date.parse("2026-06-01T23:00:00.000Z");

describe("evaluateTaskCursorWorkerStallWarning", () => {
  it("returns null when not server polling", () => {
    expect(
      evaluateTaskCursorWorkerStallWarning({
        serverPolling: false,
        execution: {
          version: "task_cursor_execution_v1",
          projectId: "p1",
          taskId: "DEV-MOCK-001",
          workItemIds: [],
          status: "cursor_running",
          cursorProvider: "cursor",
          targetRepository: "o/r",
          baseBranch: "main",
          workBranch: "wip/x",
          createdAt: "2026-06-01T21:00:00.000Z",
          updatedAt: "2026-06-01T21:00:00.000Z",
        },
        nowMs: NOW + TASK_CURSOR_SERVER_WORKER_STALL_WARN_MS + 1,
      }),
    ).toBeNull();
  });

  it("warns when server job is in flight with pollCount 0 past threshold", () => {
    const warning = evaluateTaskCursorWorkerStallWarning({
      serverPolling: true,
      execution: {
        version: "task_cursor_execution_v1",
        projectId: "p1",
        taskId: "DEV-MOCK-001",
        workItemIds: [],
        status: "cursor_running",
        cursorProvider: "cursor",
        targetRepository: "o/r",
        baseBranch: "main",
        workBranch: "wip/x",
        createdAt: "2026-06-01T21:00:00.000Z",
        updatedAt: "2026-06-01T21:00:00.000Z",
      },
      activeJob: {
        id: "job-1",
        projectId: "p1",
        taskId: "DEV-MOCK-001",
        status: "cursor_running",
        pollCount: 0,
        lastPollAt: null,
        nextPollAt: null,
      },
      nowMs: NOW,
    });
    expect(warning?.kind).toBe("server_worker_stalled");
    expect(warning?.taskId).toBe("DEV-MOCK-001");
    expect(warning?.pollCount).toBe(0);
  });

  it("returns null for orphan active job without local execution or quick run", () => {
    expect(
      evaluateTaskCursorWorkerStallWarning({
        serverPolling: true,
        activeJob: {
          id: "job-1",
          projectId: "p1",
          taskId: "DEV-MOCK-001",
          status: "cursor_running",
          pollCount: 0,
          lastPollAt: null,
          nextPollAt: null,
        },
        nowMs: NOW,
      }),
    ).toBeNull();
  });

  it("returns null when pollCount advanced", () => {
    expect(
      evaluateTaskCursorWorkerStallWarning({
        serverPolling: true,
        activeJob: {
          id: "job-1",
          projectId: "p1",
          taskId: "DEV-MOCK-001",
          status: "cursor_running",
          pollCount: 3,
          lastPollAt: "2026-06-01T22:58:00.000Z",
          nextPollAt: null,
        },
        execution: {
          version: "task_cursor_execution_v1",
          projectId: "p1",
          taskId: "DEV-MOCK-001",
          workItemIds: [],
          status: "cursor_running",
          cursorProvider: "cursor",
          targetRepository: "o/r",
          baseBranch: "main",
          workBranch: "wip/x",
          createdAt: "2026-06-01T21:00:00.000Z",
          updatedAt: "2026-06-01T21:00:00.000Z",
        },
        nowMs: NOW,
      }),
    ).toBeNull();
  });
});
