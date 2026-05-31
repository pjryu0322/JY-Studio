import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";

const findFirst = vi.fn();
const create = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    taskCursorExecutionJob: {
      findFirst: (...args: unknown[]) => findFirst(...args),
      create: (...args: unknown[]) => create(...args),
    },
  },
}));

import { createQueuedTaskCursorExecutionJob } from "@/lib/prototype/taskCursorExecutionJobRepository";

const NOW = new Date("2026-05-28T12:00:00.000Z");

function execution(): TaskCursorExecutionV1 {
  return {
    version: "task_cursor_execution_v1",
    projectId: "p1",
    taskId: "DEV-A",
    workItemIds: ["wi-1"],
    status: "cursor_requested",
    cursorProvider: "cursor",
    targetRepository: "owner/repo",
    baseBranch: "main",
    workBranch: "wip/cursor/dev-a",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  };
}

describe("createQueuedTaskCursorExecutionJob idempotency", () => {
  beforeEach(() => {
    findFirst.mockReset();
    create.mockReset();
  });

  it("returns existing active job instead of creating duplicate", async () => {
    const existing = { id: "job-existing", taskId: "DEV-A", status: "queued" };
    findFirst.mockResolvedValue(existing);

    const result = await createQueuedTaskCursorExecutionJob({
      projectId: "p1",
      execution: execution(),
      workItems: [{ id: "wi-1", taskId: "DEV-A" } as never],
      now: NOW,
    });

    expect(result).toBe(existing);
    expect(create).not.toHaveBeenCalled();
  });

  it("creates queued job when no active job exists", async () => {
    findFirst.mockResolvedValue(null);
    const created = { id: "job-new", taskId: "DEV-A", status: "queued" };
    create.mockResolvedValue(created);

    const result = await createQueuedTaskCursorExecutionJob({
      projectId: "p1",
      execution: execution(),
      workItems: [{ id: "wi-1", taskId: "DEV-A" } as never],
      now: NOW,
    });

    expect(result).toBe(created);
    expect(create).toHaveBeenCalledTimes(1);
  });
});
