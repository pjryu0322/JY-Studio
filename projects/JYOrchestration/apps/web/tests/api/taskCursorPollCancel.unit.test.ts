import { describe, expect, it } from "vitest";
import {
  buildTaskCursorPollCancelledOrchestrationPatch,
  buildTaskCursorPollResumeOrchestrationPatch,
} from "@/lib/prototype/prototypeExecutionTaskCursorActions";
import { TASK_CURSOR_POLL_CANCELLED_MESSAGE } from "@/lib/prototype/taskCursorExecution";
import { buildInitialTaskCursorExecution } from "@/lib/prototype/taskCursorExecution";
import { isTaskCursorStatusCheckResumable } from "@/lib/prototype/taskCursorClientPollLoop";

describe("buildTaskCursorPollCancelledOrchestrationPatch", () => {
  it("marks execution status_check_stopped without cursor_failed or api_failed timeline", () => {
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
    expect(patch.taskCursorExecutionV1.status).toBe("status_check_stopped");
    expect(patch.taskCursorExecutionV1.failureReason).toBeUndefined();
    expect(patch.taskCursorExecutionV1.errorMessage).toBe(TASK_CURSOR_POLL_CANCELLED_MESSAGE);
    expect(patch.promptTimeline?.some((entry) => entry.action === "task_cursor_poll_cancelled")).toBe(
      true,
    );
    expect(patch.promptTimeline?.some((entry) => entry.action === "task_cursor_api_failed")).toBe(
      false,
    );
    expect(patch.implementationTaskExecutionStateV1).toBeUndefined();
  });
});

describe("buildTaskCursorPollResumeOrchestrationPatch", () => {
  it("restores cursor_running for client poll resume", () => {
    const execution = {
      ...buildInitialTaskCursorExecution({
        projectId: "p1",
        taskId: "DEV-SCREEN-002",
        workItemIds: ["w1"],
        targetRepository: "owner/repo",
        baseBranch: "main",
      }),
      status: "status_check_stopped" as const,
      cursorRunId: "bc-aa13fda9-21e2-4d4b-af82-6006c4fbc40e",
      errorMessage: TASK_CURSOR_POLL_CANCELLED_MESSAGE,
    };
    const patch = buildTaskCursorPollResumeOrchestrationPatch({ execution });
    expect(patch.taskCursorExecutionV1.status).toBe("cursor_running");
    expect(patch.taskCursorExecutionV1.errorMessage).toBeUndefined();
    expect(patch.promptTimeline?.some((entry) => entry.action === "task_cursor_poll_resumed")).toBe(
      true,
    );
    expect(isTaskCursorStatusCheckResumable(patch.taskCursorExecutionV1)).toBe(false);
    expect(isTaskCursorStatusCheckResumable(execution)).toBe(true);
  });
});
