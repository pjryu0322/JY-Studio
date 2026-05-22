import { beforeEach, describe, expect, it, vi } from "vitest";

const createMock = vi.fn();
const findManyMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    runtimeEvent: {
      create: (...args: unknown[]) => createMock(...args),
      findMany: (...args: unknown[]) => findManyMock(...args),
    },
  },
}));

import {
  createRuntimeEvent,
  listRuntimeEventsForExecRun,
} from "@/lib/runtime/runtimeEventRepository";

describe("runtimeEventRepository", () => {
  beforeEach(() => {
    createMock.mockReset();
    findManyMock.mockReset();
    createMock.mockResolvedValue({ id: "ev-1" });
    findManyMock.mockResolvedValue([
      {
        createdAt: new Date("2026-05-19T10:00:00.000Z"),
        eventType: "CURSOR_STARTED",
        severity: "info",
        workerName: "cursor",
        detailJson: { execRunId: "run-1" },
      },
    ]);
  });

  it("createRuntimeEvent writes RuntimeEvent row", async () => {
    await createRuntimeEvent({
      projectId: "p1",
      taskId: "t1",
      execRunId: "run-1",
      eventType: "CURSOR_STARTED",
      severity: "info",
      workerName: "cursor",
    });
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          execRunId: "run-1",
          eventType: "CURSOR_STARTED",
        }),
      }),
    );
  });

  it("listRuntimeEventsForExecRun scopes by execRunId", async () => {
    const rows = await listRuntimeEventsForExecRun({ execRunId: "run-1", limit: 10 });
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { execRunId: "run-1" } }),
    );
    expect(rows[0]?.eventType).toBe("CURSOR_STARTED");
  });
});
