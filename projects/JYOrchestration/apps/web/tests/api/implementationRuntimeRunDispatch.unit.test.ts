import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirstRunMock = vi.fn();
const transitionRunMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    implementationCodeTaskRun: {
      findFirst: (...args: unknown[]) => findFirstRunMock(...args),
    },
  },
}));

vi.mock("@/lib/runtime/implementationRuntime/implementationRuntimeRepository", () => ({
  transitionImplementationCodeTaskRun: (...args: unknown[]) => transitionRunMock(...args),
}));

import { assertRunDispatchAllowed } from "@/lib/runtime/implementationRuntime/implementationRuntimeRunDispatch";

describe("assertRunDispatchAllowed", () => {
  beforeEach(() => {
    findFirstRunMock.mockReset();
    transitionRunMock.mockReset();
    transitionRunMock.mockResolvedValue({});
  });

  it("throws when DB run is missing", async () => {
    findFirstRunMock.mockResolvedValue(null);
    await expect(
      assertRunDispatchAllowed({ jobId: "job-1", codeTaskId: "ct-1" }),
    ).rejects.toThrow(/DB Run not found/);
  });

  it("throws when run is in-flight with active cursor agent", async () => {
    findFirstRunMock.mockResolvedValue({
      id: "run-1",
      runtimeState: "cursor_running",
      cursorAgentId: "agent-1",
    });
    await expect(
      assertRunDispatchAllowed({ jobId: "job-1", codeTaskId: "ct-1" }),
    ).rejects.toThrow(/Duplicate dispatch blocked/);
  });

  it("reconciles stale cursor_running without agent then allows dispatch", async () => {
    findFirstRunMock
      .mockResolvedValueOnce({
        id: "run-1",
        runtimeState: "cursor_running",
        cursorAgentId: null,
      })
      .mockResolvedValueOnce({ id: "run-1", runtimeState: "queued", cursorAgentId: null });
    await expect(
      assertRunDispatchAllowed({ jobId: "job-1", codeTaskId: "ct-1" }),
    ).resolves.toBeUndefined();
    expect(transitionRunMock).toHaveBeenCalled();
  });

  it("allows when run is queued", async () => {
    findFirstRunMock.mockResolvedValue({
      id: "run-1",
      runtimeState: "queued",
      cursorAgentId: null,
    });
    await expect(
      assertRunDispatchAllowed({ jobId: "job-1", codeTaskId: "ct-1" }),
    ).resolves.toBeUndefined();
  });
});
