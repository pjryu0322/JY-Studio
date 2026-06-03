import { beforeEach, describe, expect, it, vi } from "vitest";

const countMock = vi.fn();
const findManyMock = vi.fn();
const findFirstJobMock = vi.fn();
const updateJobMock = vi.fn();
const findFirstRunMock = vi.fn();
const createItemMock = vi.fn();
const createRunMock = vi.fn();
const eventCreateMock = vi.fn();

function queueRow(input: {
  readonly codeTaskId: string;
  readonly queueOrder: number;
  readonly status: string;
  readonly failureReason?: string | null;
}) {
  const now = new Date("2026-06-03T00:00:00.000Z");
  return {
    id: `qi-${input.codeTaskId}`,
    projectId: "p1",
    jobId: "job-1",
    queueOrder: input.queueOrder,
    codeTaskId: input.codeTaskId,
    parentTaskId: "t1",
    workItemId: null,
    status: input.status,
    attemptNo: 1,
    commitSha: null,
    failureReason: input.failureReason ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    implementationRuntimeCodeTaskQueueItem: {
      count: (...args: unknown[]) => countMock(...args),
      findMany: (...args: unknown[]) => findManyMock(...args),
      create: (...args: unknown[]) => createItemMock(...args),
    },
    implementationExecutionJob: {
      findFirst: (...args: unknown[]) => findFirstJobMock(...args),
      update: (...args: unknown[]) => updateJobMock(...args),
    },
    implementationCodeTaskRun: {
      findFirst: (...args: unknown[]) => findFirstRunMock(...args),
      create: (...args: unknown[]) => createRunMock(...args),
    },
    implementationRuntimeEvent: {
      create: (...args: unknown[]) => eventCreateMock(...args),
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        implementationRuntimeCodeTaskQueueItem: {
          findMany: findManyMock,
          create: createItemMock,
        },
        implementationExecutionJob: {
          findFirst: findFirstJobMock,
          update: updateJobMock,
        },
        implementationCodeTaskRun: {
          findFirst: findFirstRunMock,
          create: createRunMock,
        },
        implementationRuntimeEvent: {
          create: eventCreateMock,
        },
      }),
  },
}));

import {
  advanceImplementationRuntimeCodeTaskQueue,
  createImplementationRuntimeCodeTaskQueue,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeCodeTaskQueueService";

describe("implementationRuntime DB queue multi-code-task flow", () => {
  beforeEach(() => {
    countMock.mockReset();
    findManyMock.mockReset();
    findFirstJobMock.mockReset();
    updateJobMock.mockReset();
    findFirstRunMock.mockReset();
    createItemMock.mockReset();
    createRunMock.mockReset();
    eventCreateMock.mockReset();
  });

  it("creates three queue items preserving selected order", async () => {
    countMock.mockResolvedValue(0);
    createItemMock.mockResolvedValue({});
    findManyMock.mockResolvedValue([
      queueRow({ codeTaskId: "ct-1", queueOrder: 0, status: "queued" }),
      queueRow({ codeTaskId: "ct-2", queueOrder: 1, status: "queued" }),
      queueRow({ codeTaskId: "ct-3", queueOrder: 2, status: "queued" }),
    ]);

    const items = await createImplementationRuntimeCodeTaskQueue({
      projectId: "p1",
      jobId: "job-1",
      items: [
        { codeTaskId: "ct-1", parentTaskId: "t1", queueOrder: 0 },
        { codeTaskId: "ct-2", parentTaskId: "t1", queueOrder: 1 },
        { codeTaskId: "ct-3", parentTaskId: "t1", queueOrder: 2 },
      ],
    });

    expect(createItemMock).toHaveBeenCalledTimes(3);
    expect(items.map((i) => i.codeTaskId)).toEqual(["ct-1", "ct-2", "ct-3"]);
  });

  it("advances from completed first item to second queued item", async () => {
    findFirstJobMock.mockResolvedValue({
      id: "job-1",
      projectId: "p1",
      status: "running",
      currentCodeTaskId: "ct-1",
    });
    findManyMock.mockResolvedValue([
      queueRow({ codeTaskId: "ct-1", queueOrder: 0, status: "completed" }),
      queueRow({ codeTaskId: "ct-2", queueOrder: 1, status: "queued" }),
      queueRow({ codeTaskId: "ct-3", queueOrder: 2, status: "queued" }),
    ]);
    findFirstRunMock.mockResolvedValue(null);
    createRunMock.mockResolvedValue({ id: "run-2" });

    const result = await advanceImplementationRuntimeCodeTaskQueue({
      projectId: "p1",
      jobId: "job-1",
      stopOnFailure: true,
    });

    expect(result.advanced).toBe(true);
    expect(result.nextCodeTaskId).toBe("ct-2");
    expect(updateJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currentCodeTaskId: "ct-2" }),
      }),
    );
    expect(createRunMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ codeTaskId: "ct-2", runtimeState: "queued" }),
      }),
    );
  });

  it("pauses job on rework_required when stopOnFailure is true", async () => {
    findFirstJobMock.mockResolvedValue({
      id: "job-1",
      projectId: "p1",
      status: "running",
      currentCodeTaskId: "ct-1",
    });
    findManyMock.mockResolvedValue([
      queueRow({
        codeTaskId: "ct-1",
        queueOrder: 0,
        status: "rework_required",
        failureReason: "github_verify_failed",
      }),
      queueRow({ codeTaskId: "ct-2", queueOrder: 1, status: "queued" }),
    ]);

    const result = await advanceImplementationRuntimeCodeTaskQueue({
      projectId: "p1",
      jobId: "job-1",
      stopOnFailure: true,
    });

    expect(result.advanced).toBe(false);
    expect(updateJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "paused" }),
      }),
    );
  });
});
