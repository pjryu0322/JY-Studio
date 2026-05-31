import { describe, expect, it } from "vitest";
import { buildTaskCursorPollCancelledOrchestrationPatch } from "@/lib/prototype/prototypeExecutionTaskCursorActions";
import { TASK_CURSOR_POLL_CANCELLED_MESSAGE } from "@/lib/prototype/taskCursorClientPollLoop";
import { buildInitialTaskCursorExecution } from "@/lib/prototype/taskCursorExecution";

describe("buildTaskCursorPollCancelledOrchestrationPatch", () => {
  it("marks execution failed and records cancellation message", () => {
    const execution = {
      ...buildInitialTaskCursorExecution({
        projectId: "p1",
        taskId: "DEV-SCREEN-002",
        workItemIds: ["w1"],
        targetRepository: "owner/repo",
        baseBranch: "main",
      }),
      status: "cursor_running" as const,
      cursorRunId: "bc-aa13fda9-21e2-4d4b-af82-6006c4fbc40e",
    };
    const patch = buildTaskCursorPollCancelledOrchestrationPatch({ execution });
    expect(patch.taskCursorExecutionV1.status).toBe("cursor_failed");
    expect(patch.taskCursorExecutionV1.errorMessage).toBe(TASK_CURSOR_POLL_CANCELLED_MESSAGE);
    expect(patch.promptTimeline?.some((entry) => String(entry.action).includes("failed"))).toBe(true);
  });
});
