import { describe, expect, it } from "vitest";
import { parseCursorExecutionJobPayload } from "@/lib/runtime/cursorExecutionJobTypes";
import { parsePipelineExecutionJobPayload } from "@/lib/runtime/pipelineExecutionJobTypes";

describe("runtime job payloads", () => {
  it("parseCursorExecutionJobPayload accepts valid payload", () => {
    expect(
      parseCursorExecutionJobPayload({
        execRunId: "run-1",
        taskId: "task-1",
        projectId: "proj-1",
        actorUserId: "user-1",
      }),
    ).toEqual({
      execRunId: "run-1",
      taskId: "task-1",
      projectId: "proj-1",
      actorUserId: "user-1",
      singleTaskId: undefined,
    });
  });

  it("parseCursorExecutionJobPayload rejects incomplete payload", () => {
    expect(parseCursorExecutionJobPayload({ taskId: "t" })).toBeNull();
  });

  it("parsePipelineExecutionJobPayload accepts resume flag", () => {
    expect(
      parsePipelineExecutionJobPayload({
        execRunId: "run-2",
        taskId: "task-2",
        projectId: "proj-2",
        actorUserId: "user-2",
        resumeScmAfterApproval: true,
      }),
    ).toMatchObject({ resumeScmAfterApproval: true });
  });
});
