import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirstMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    implementationRuntimeCodeTaskQueueItem: {
      findFirst: (...args: unknown[]) => findFirstMock(...args),
      updateMany: vi.fn(),
    },
  },
}));

import { assertQueueItemDispatchAllowed } from "@/lib/runtime/implementationRuntime/implementationRuntimeCodeTaskQueueService";

describe("assertQueueItemDispatchAllowed", () => {
  beforeEach(() => {
    findFirstMock.mockReset();
  });

  it("throws when DB queue item is missing", async () => {
    findFirstMock.mockResolvedValue(null);
    await expect(
      assertQueueItemDispatchAllowed({ jobId: "job-1", codeTaskId: "ct-1" }),
    ).rejects.toThrow(/DB Queue item not found/);
  });

  it("throws when queue item is in-flight", async () => {
    findFirstMock.mockResolvedValue({ status: "cursor_running" });
    await expect(
      assertQueueItemDispatchAllowed({ jobId: "job-1", codeTaskId: "ct-1" }),
    ).rejects.toThrow(/Duplicate dispatch blocked/);
  });

  it("allows when queue item is queued", async () => {
    findFirstMock.mockResolvedValue({ status: "queued" });
    await expect(
      assertQueueItemDispatchAllowed({ jobId: "job-1", codeTaskId: "ct-1" }),
    ).resolves.toBeUndefined();
  });
});
