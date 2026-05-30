import { describe, expect, it } from "vitest";
import {
  formatTaskCursorElapsedMinutes,
  isInFlightTaskCursorExecution,
  resolveTaskCursorPollWorkItems,
} from "@/lib/prototype/taskCursorClientPollLoop";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";

function baseExecution(overrides: Partial<TaskCursorExecutionV1> = {}): TaskCursorExecutionV1 {
  return {
    version: "task_cursor_execution_v1",
    projectId: "p1",
    taskId: "DEV-MOCK-001",
    workItemIds: ["w1"],
    status: "cursor_running",
    cursorProvider: "cursor",
    targetRepository: "owner/repo",
    baseBranch: "main",
    workBranch: "wip/cursor/dev-mock-001",
    cursorRunId: "bc-aa13fda9-21e2-4d4b-af82-6006c4fbc40e",
    createdAt: new Date(Date.now() - 20 * 60_000).toISOString(),
    updatedAt: new Date(Date.now() - 20 * 60_000).toISOString(),
    ...overrides,
  };
}

describe("taskCursorClientPollLoop helpers", () => {
  it("isInFlightTaskCursorExecution requires runId and in-flight status", () => {
    expect(isInFlightTaskCursorExecution(baseExecution())).toBe(true);
    expect(isInFlightTaskCursorExecution(baseExecution({ cursorRunId: undefined }))).toBe(false);
    expect(isInFlightTaskCursorExecution(baseExecution({ status: "cursor_completed" }))).toBe(false);
  });

  it("resolveTaskCursorPollWorkItems prefers workItemIds then taskId", () => {
    const items: CursorWorkItem[] = [
      { id: "w1", taskId: "DEV-MOCK-001", role: "developer", title: "A", status: "ready" },
      { id: "w2", taskId: "DEV-MOCK-002", role: "developer", title: "B", status: "ready" },
    ];
    expect(resolveTaskCursorPollWorkItems(baseExecution(), items).map((w) => w.id)).toEqual(["w1"]);
    expect(
      resolveTaskCursorPollWorkItems(baseExecution({ workItemIds: [] }), items).map((w) => w.id),
    ).toEqual(["w1"]);
  });

  it("formatTaskCursorElapsedMinutes returns floored minutes", () => {
    const iso = new Date(Date.now() - 20 * 60_000 - 5_000).toISOString();
    expect(formatTaskCursorElapsedMinutes(iso)).toBe(20);
    expect(formatTaskCursorElapsedMinutes(null)).toBeNull();
  });
});
