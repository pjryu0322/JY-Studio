import { describe, expect, it } from "vitest";
import { buildTaskCursorJobOrchestrationSyncFingerprint } from "@/lib/prototype/taskCursorJobStateSync";

describe("buildTaskCursorJobOrchestrationSyncFingerprint", () => {
  it("is stable for identical orchestration slices", () => {
    const patch = {
      taskCursorExecutionV1: {
        cursorRunId: "run-1",
        status: "cursor_running" as const,
        updatedAt: "2026-06-01T00:00:00.000Z",
        taskId: "T1",
      },
      implementationTaskExecutionStateV1: {
        updatedAt: "2026-06-01T00:00:01.000Z",
        summary: "running",
      },
      promptTimeline: [{ id: "e1", createdAt: "2026-06-01T00:00:02.000Z", kind: "note" }],
    };
    const a = buildTaskCursorJobOrchestrationSyncFingerprint(patch);
    const b = buildTaskCursorJobOrchestrationSyncFingerprint(patch);
    expect(a).toBe(b);
  });

  it("changes when task cursor execution status changes", () => {
    const base = {
      taskCursorExecutionV1: {
        cursorRunId: "run-1",
        status: "cursor_running" as const,
        updatedAt: "2026-06-01T00:00:00.000Z",
        taskId: "T1",
      },
    };
    const running = buildTaskCursorJobOrchestrationSyncFingerprint(base);
    const done = buildTaskCursorJobOrchestrationSyncFingerprint({
      ...base,
      taskCursorExecutionV1: { ...base.taskCursorExecutionV1!, status: "completed" },
    });
    expect(running).not.toBe(done);
  });
});
