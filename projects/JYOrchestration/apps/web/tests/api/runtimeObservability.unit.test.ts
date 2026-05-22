import { beforeEach, describe, expect, it, vi } from "vitest";

const findRunMock = vi.fn();
const findManyMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    taskExecutionRun: {
      findUnique: (...args: unknown[]) => findRunMock(...args),
    },
    executionEventLog: {
      findMany: (...args: unknown[]) => findManyMock(...args),
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
}));

vi.mock("@/lib/ai-team-runtime/persist", () => ({
  readTeamExecutionStatus: vi.fn().mockResolvedValue(null),
}));

import { appendRuntimeEvent } from "@/lib/runtime/runtimeEventService";
import {
  clearRuntimeTimelineStore,
  getRuntimeTimelineFromStore,
} from "@/lib/runtime/runtimeTimelineStore";
import { listRuntimeTimelineForExecRun } from "@/lib/runtime/runtimeObservability";

describe("runtimeObservability timeline", () => {
  beforeEach(() => {
    clearRuntimeTimelineStore();
    findRunMock.mockReset();
    findManyMock.mockReset();
    findRunMock.mockResolvedValue({
      taskId: "task-1",
      projectId: "proj-1",
      createdAt: new Date(),
    });
    findManyMock.mockResolvedValue([]);
  });

  it("records timeline via appendRuntimeEvent without executionJobId", async () => {
    await appendRuntimeEvent({
      eventType: "CURSOR_STARTED",
      projectId: "proj-1",
      taskId: "task-1",
      execRunId: "run-1",
      workerName: "cursor",
    });

    const memory = getRuntimeTimelineFromStore("run-1");
    expect(memory.length).toBe(1);
    expect(memory[0]?.eventType).toBe("CURSOR_STARTED");

    const merged = await listRuntimeTimelineForExecRun("run-1");
    expect(merged.some((r) => r.eventType === "CURSOR_STARTED")).toBe(true);
  });
});
