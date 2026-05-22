import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const triggerMock = vi.fn();
const enqueueMock = vi.fn();
const appendEventMock = vi.fn();

vi.mock("@/lib/service/selfHealingService", () => ({
  triggerSelfHealingLite: (...args: unknown[]) => triggerMock(...args),
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
    execRunId: "run-1",
    actorUserId: "user-1",
    reviewReason: "rejected",
  };

  beforeEach(() => {
    triggerMock.mockReset();
    enqueueMock.mockReset();
    appendEventMock.mockReset();
    appendEventMock.mockResolvedValue(undefined);
    enqueueMock.mockResolvedValue({ queued: true, jobId: "job-1" });
  });

  afterEach(() => {
    delete process.env.RUNTIME_SELF_HEALING_AUTO_CURSOR;
  });

  it("creates healing candidates and emits AUTO_HEALING_TRIGGERED", async () => {
    triggerMock.mockResolvedValue({
      created: true,
      strategies: ["retry"],
      createdTasks: [{ strategy: "retry", taskId: "heal-1" }],
    });

    const res = await maybeEnqueueSelfHealingFromReviewFailure(input);
    expect(res.triggered).toBe(true);
    expect(res.createdTaskIds).toEqual(["heal-1"]);
    expect(res.autoCursorEnqueued).toBe(false);
    expect(appendEventMock).toHaveBeenCalled();
    const eventType = appendEventMock.mock.calls[0][0].eventType;
    expect(eventType).toBe("AUTO_HEALING_TRIGGERED");
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("enqueues cursor when RUNTIME_SELF_HEALING_AUTO_CURSOR=1", async () => {
    process.env.RUNTIME_SELF_HEALING_AUTO_CURSOR = "1";
    expect(isRuntimeSelfHealingAutoCursorEnabled()).toBe(true);

    triggerMock.mockResolvedValue({
      created: true,
      strategies: ["retry"],
      createdTasks: [{ strategy: "retry", taskId: "heal-2" }],
    });

    const res = await maybeEnqueueSelfHealingFromReviewFailure(input);
    expect(res.autoCursorEnqueued).toBe(true);
    expect(enqueueMock).toHaveBeenCalled();
  });

  it("emits SELF_HEALING_SKIPPED when nothing created", async () => {
    triggerMock.mockResolvedValue({
      created: false,
      strategies: [],
      createdTasks: [],
      reason: "ALREADY_CREATED",
    });

    const res = await maybeEnqueueSelfHealingFromReviewFailure(input);
    expect(res.triggered).toBe(false);
    expect(appendEventMock.mock.calls[0][0].eventType).toBe("SELF_HEALING_SKIPPED");
  });
});
