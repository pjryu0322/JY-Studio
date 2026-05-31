import { describe, expect, it, vi } from "vitest";
import {
  canPollTaskCursorCloudAgent,
  formatTaskCursorElapsedMinutes,
  isActiveTaskCursorExecution,
  isInFlightTaskCursorExecution,
  isStaleAbandonedTaskCursorExecution,
  isTaskCursorCloudAgentPollingCancellable,
  resolveTaskCursorPollWorkItems,
  runTaskCursorClientPollLoop,
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
  it("isInFlightTaskCursorExecution tracks launch/poll in-flight statuses", () => {
    expect(isInFlightTaskCursorExecution(baseExecution())).toBe(true);
    expect(isInFlightTaskCursorExecution(baseExecution({ status: "cursor_requested", cursorRunId: undefined }))).toBe(
      true,
    );
    expect(isInFlightTaskCursorExecution(baseExecution({ status: "cursor_completed" }))).toBe(false);
  });

  it("isStaleAbandonedTaskCursorExecution detects abandoned poll state", () => {
    expect(
      isStaleAbandonedTaskCursorExecution(baseExecution({ cursorRunId: undefined }), {
        developerStatus: "failed",
      }),
    ).toBe(true);
    expect(
      isStaleAbandonedTaskCursorExecution(
        baseExecution({ cursorRunId: "task-cursor-20260530120000" }),
        { developerStatus: "failed" },
      ),
    ).toBe(true);
    expect(
      isStaleAbandonedTaskCursorExecution(baseExecution({ cursorRunId: undefined })),
    ).toBe(true);
    expect(isStaleAbandonedTaskCursorExecution(baseExecution())).toBe(false);
  });

  it("isActiveTaskCursorExecution ignores stale abandoned executions", () => {
    expect(
      isActiveTaskCursorExecution(baseExecution({ cursorRunId: undefined }), {
        developerStatus: "failed",
      }),
    ).toBe(false);
    expect(isActiveTaskCursorExecution(baseExecution())).toBe(true);
  });

  it("canPollTaskCursorCloudAgent requires bc-uuid runId", () => {
    expect(canPollTaskCursorCloudAgent(baseExecution())).toBe(true);
    expect(
      canPollTaskCursorCloudAgent(
        baseExecution({ cursorRunId: "task-cursor-20260530120000" }),
      ),
    ).toBe(false);
    expect(canPollTaskCursorCloudAgent(baseExecution({ cursorRunId: undefined }))).toBe(false);
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

  it("isTaskCursorCloudAgentPollingCancellable includes requested and active poll", () => {
    expect(isTaskCursorCloudAgentPollingCancellable(baseExecution({ status: "cursor_requested" }))).toBe(true);
    expect(isTaskCursorCloudAgentPollingCancellable(baseExecution())).toBe(true);
    expect(isTaskCursorCloudAgentPollingCancellable(baseExecution({ status: "cursor_completed" }))).toBe(false);
  });

  it("formatTaskCursorElapsedMinutes returns floored minutes", () => {
    const iso = new Date(Date.now() - 20 * 60_000 - 5_000).toISOString();
    expect(formatTaskCursorElapsedMinutes(iso)).toBe(20);
    expect(formatTaskCursorElapsedMinutes(null)).toBeNull();
  });

  it("runTaskCursorClientPollLoop detects terminal status on first poll round", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        success: true,
        status: "github_verified",
        execution: { status: "github_verified" },
        orchestrationPatch: {
          taskCursorExecutionV1: baseExecution({ status: "github_verified" }),
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const onTerminal = vi.fn();
    const onPatch = vi.fn();
    const execution = baseExecution();

    const loopPromise = runTaskCursorClientPollLoop({
      projectId: "p1",
      initialExecution: execution,
      workItems: [{ id: "w1", taskId: "DEV-MOCK-001", role: "developer", title: "A", status: "ready" }],
      getLatestExecution: () => execution,
      isCancelled: () => false,
      onPatch,
      onTerminal,
    });

    await vi.advanceTimersByTimeAsync(2_500);
    await loopPromise;

    expect(onTerminal).toHaveBeenCalledTimes(1);
    expect(onPatch).toHaveBeenCalled();

    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
});
