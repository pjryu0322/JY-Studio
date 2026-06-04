import { describe, expect, it } from "vitest";
import {
  isTaskCursorExecutePromptPreflightFailure,
  orchestrationPatchHasPromptPreflightFailure,
} from "@/lib/prototype/taskCursorExecutePreflightResponse";
import { patchTaskCursorExecutionForPromptPreflightFailure } from "@/lib/prototype/codeTaskPromptPreflightFailure";
import { buildInitialTaskCursorExecution } from "@/lib/prototype/taskCursorExecution";

describe("taskCursorExecutePreflightResponse", () => {
  it("detects phase prompt_preflight_failed", () => {
    expect(
      isTaskCursorExecutePromptPreflightFailure({
        success: false,
        phase: "prompt_preflight_failed",
      }),
    ).toBe(true);
  });

  it("detects orchestration patch failureReason", () => {
    const execution = patchTaskCursorExecutionForPromptPreflightFailure({
      execution: buildInitialTaskCursorExecution({
        projectId: "p",
        taskId: "T1",
        workItemIds: ["w1"],
        targetRepository: "owner/repo",
        baseBranch: "main",
        workBranch: "wip/x",
      }),
      errorMessage: "blocked",
    });
    const patch = { taskCursorExecutionV1: execution };
    expect(orchestrationPatchHasPromptPreflightFailure(patch)).toBe(true);
    expect(
      isTaskCursorExecutePromptPreflightFailure({
        success: false,
        orchestrationPatch: patch,
      }),
    ).toBe(true);
  });
});
