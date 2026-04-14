import { describe, expect, it, vi } from "vitest";
import { getPlanningExecutionRunStatus } from "../../src/lib/jy-orchestration/planning-execution";

describe("planning execution run-status client adapter", () => {
  it("maps ok response", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          ok: true,
          run: {
            runId: "run-1",
            runStatus: "RUNNING",
            totalTasks: 5,
            completedTasks: 2,
            failedTasks: 0,
            currentTaskId: "task-a",
            lastFailureMessage: null,
            totalStepCount: 12,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });
    // @ts-expect-error test override
    globalThis.fetch = fetchMock;

    const r = await getPlanningExecutionRunStatus("run-1");
    expect(r.status).toBe("success");
    if (r.status === "success") {
      expect(r.response.ok).toBe(true);
      expect(r.response.run.runId).toBe("run-1");
    }
  });

  it("returns validation_error when runId missing", async () => {
    const r = await getPlanningExecutionRunStatus(" ");
    expect(r.status).toBe("validation_error");
  });
});

