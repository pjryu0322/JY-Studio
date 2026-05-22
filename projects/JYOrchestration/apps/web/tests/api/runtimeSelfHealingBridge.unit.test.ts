import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const triggerMock = vi.fn();
const createRunMock = vi.fn();
const enqueueMock = vi.fn();
const appendEventMock = vi.fn();

vi.mock("@/lib/service/selfHealingService", () => ({
  triggerSelfHealingLite: (...args: unknown[]) => triggerMock(...args),
}));

vi.mock("@/lib/runtime/runtimeSelfHealingExecution", () => ({
  createSelfHealingExecutionRun: (...args: unknown[]) => createRunMock(...args),
}));

vi.mock("@/lib/service/executionQueue", () => ({
  enqueueExecution: (...args: unknown[]) => enqueueMock(...args),
}));

vi.mock("@/lib/runtime/runtimeEventService", () => ({
  appendRuntimeEvent: (...args: unknown[]) => appendEventMock(...args),
}));

import {
  isRuntimeSelfHealingAutoCursorEnabled,
  maybeEnqueueSelfHealingFromReviewFailure,
} from "@/lib/runtime/runtimeSelfHealingBridge";

describe("runtimeSelfHealingBridge", () => {
  const input = {
    projectId: "proj-1",
    taskId: "task-1",
    execRunId: "run-source",
    actorUserId: "user-1",
    reviewReason: "rejected",
  };

  beforeEach(() => {
    triggerMock.mockReset();
    createRunMock.mockReset();
    enqueueMock.mockReset();
    appendEventMock.mockReset();
    appendEventMock.mockResolvedValue(undefined);
    enqueueMock.mockResolvedValue({ queued: true, jobId: "cursor-job-1" });
    createRunMock.mockResolvedValue({ execRunId: "run-healing", promptSnapshot: "p" });
  });

  afterEach(() => {
    delete process.env.RUNTIME_SELF_HEALING_AUTO_CURSOR;
  });

  it("creates healing candidates without cursor enqueue by default", async () => {
    triggerMock.mockResolvedValue({
      created: true,
      strategies: ["retry"],
      createdTasks: [{ strategy: "retry", taskId: "heal-1" }],
    });

    const res = await maybeEnqueueSelfHealingFromReviewFailure(input);
    expect(res.triggered).toBe(true);
    expect(res.autoCursorEnqueued).toBe(false);
    expect(createRunMock).not.toHaveBeenCalled();
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("enqueues cursor with matching execRunId and chain markers when flag on", async () => {
    process.env.RUNTIME_SELF_HEALING_AUTO_CURSOR = "1";

    triggerMock.mockResolvedValue({
      created: true,
      strategies: ["retry"],
      createdTasks: [{ strategy: "retry", taskId: "heal-2" }],
    });

    const res = await maybeEnqueueSelfHealingFromReviewFailure(input);
    expect(res.autoCursorEnqueued).toBe(true);
    expect(res.healingExecRunIds).toEqual(["run-healing"]);

    expect(enqueueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "cursor",
        payload: expect.objectContaining({
          execRunId: "run-healing",
          taskId: "heal-2",
          selfHealingFromExecRunId: "run-source",
          syncDispatch: false,
          chainSource: "self-healing",
        }),
      }),
    );
  });
});
