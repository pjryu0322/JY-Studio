import { describe, expect, it } from "vitest";
import { evaluateTaskCursorJobObservability } from "@/lib/prototype/taskCursorJobObservability";

describe("evaluateTaskCursorJobObservability", () => {
  it("marks stuck when active job nextPollAt is overdue without lock", () => {
    const now = new Date("2026-05-28T12:10:00.000Z");
    const observability = evaluateTaskCursorJobObservability({
      serverPolling: true,
      now,
      serverJob: {
        id: "job-1",
        projectId: "p1",
        taskId: "DEV-A",
        status: "cursor_running",
        pollCount: 3,
        lastPollAt: "2026-05-28T12:00:00.000Z",
        nextPollAt: "2026-05-28T12:05:00.000Z",
      },
    });
    expect(observability.stuck).toBe(true);
    expect(observability.statusLabel).toContain("추적 지연");
  });

  it("marks lockedStale when lock expired", () => {
    const now = new Date("2026-05-28T12:10:00.000Z");
    const observability = evaluateTaskCursorJobObservability({
      serverPolling: true,
      now,
      serverJob: {
        id: "job-1",
        projectId: "p1",
        taskId: "DEV-A",
        status: "cursor_running",
        pollCount: 1,
        lockedBy: "worker-a",
        lockExpiresAt: "2026-05-28T12:08:00.000Z",
      },
    });
    expect(observability.lockedStale).toBe(true);
    expect(observability.statusLabel).toContain("lock stale");
  });
});
