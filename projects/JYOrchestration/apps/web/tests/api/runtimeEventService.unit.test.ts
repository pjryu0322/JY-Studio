import { beforeEach, describe, expect, it, vi } from "vitest";

const createRuntimeEventMock = vi.fn();
const persistCompatMock = vi.fn();

vi.mock("@/lib/runtime/runtimeEventRepository", () => ({
  createRuntimeEvent: (...args: unknown[]) => createRuntimeEventMock(...args),
}));

vi.mock("@/lib/runtime/runtimeEventPersistence", () => ({
  isRuntimeEventCompatExecutionLogEnabled: () => process.env.RUNTIME_EVENT_COMPAT_EXECUTION_LOG !== "0",
  persistRuntimeEventToExecutionLog: (...args: unknown[]) => persistCompatMock(...args),
}));

vi.mock("@/lib/observability/taskProgressLog", () => ({
  appendTaskProgressLog: vi.fn(),
}));

vi.mock("@/lib/runtime/runtimeTimelineStore", () => ({
  recordRuntimeTimelineEntry: vi.fn(),
}));

import { appendRuntimeEvent } from "@/lib/runtime/runtimeEventService";

describe("runtimeEventService", () => {
  beforeEach(() => {
    delete process.env.RUNTIME_EVENT_COMPAT_EXECUTION_LOG;
    createRuntimeEventMock.mockReset();
    persistCompatMock.mockReset();
    createRuntimeEventMock.mockResolvedValue(undefined);
    persistCompatMock.mockResolvedValue(undefined);
  });

  it("appendRuntimeEvent always creates RuntimeEvent row", async () => {
    await appendRuntimeEvent({
      eventType: "CURSOR_STARTED",
      projectId: "p1",
      taskId: "t1",
      execRunId: "run-1",
    });
    expect(createRuntimeEventMock).toHaveBeenCalled();
  });

  it("uses compat execution log when no executionJobId and compat on", async () => {
    await appendRuntimeEvent({
      eventType: "PIPELINE_STARTED",
      projectId: "p1",
      taskId: "t1",
      execRunId: "run-1",
    });
    expect(persistCompatMock).toHaveBeenCalled();
  });

  it("skips compat log when RUNTIME_EVENT_COMPAT_EXECUTION_LOG=0", async () => {
    process.env.RUNTIME_EVENT_COMPAT_EXECUTION_LOG = "0";
    await appendRuntimeEvent({
      eventType: "PIPELINE_STARTED",
      projectId: "p1",
      taskId: "t1",
      execRunId: "run-1",
    });
    expect(persistCompatMock).not.toHaveBeenCalled();
  });
});
