import { describe, expect, it } from "vitest";
import { shouldSyncTaskCursorServerJobPollState } from "@/lib/prototype/taskCursorServerJobSync";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

describe("shouldSyncTaskCursorServerJobPollState", () => {
  it("returns false when execution and quick run are cleared", () => {
    expect(shouldSyncTaskCursorServerJobPollState({} as RequirementsStateJson)).toBe(false);
    expect(
      shouldSyncTaskCursorServerJobPollState({
        taskCursorExecutionV1: null,
        implementationQuickRunV1: null,
      } as RequirementsStateJson),
    ).toBe(false);
  });

  it("returns true when task cursor execution is in flight", () => {
    expect(
      shouldSyncTaskCursorServerJobPollState({
        taskCursorExecutionV1: {
          version: "task_cursor_execution_v1",
          projectId: "p1",
          taskId: "DEV-1",
          workItemIds: [],
          status: "cursor_running",
          cursorProvider: "cursor",
          targetRepository: "o/r",
          baseBranch: "main",
          workBranch: "wip/x",
          createdAt: "2026-06-01T12:00:00.000Z",
          updatedAt: "2026-06-01T12:00:00.000Z",
        },
      } as RequirementsStateJson),
    ).toBe(true);
  });

  it("returns true when an implementation execution job is active", () => {
    expect(
      shouldSyncTaskCursorServerJobPollState({
        implementationExecutionJobsV1: [
          {
            version: "implementation_execution_job_v1",
            jobId: "j1",
            projectId: "p1",
            processTaskId: "DEV-1",
            codeTaskIds: [],
            workItemIds: [],
            attemptNo: 1,
            status: "running",
            currentStep: "cursor_running",
            createdAt: "2026-06-01T12:00:00.000Z",
            updatedAt: "2026-06-01T12:00:00.000Z",
          },
        ],
      } as RequirementsStateJson),
    ).toBe(true);
  });

  it("returns true when quick run is running", () => {
    expect(
      shouldSyncTaskCursorServerJobPollState({
        implementationQuickRunV1: {
          version: "implementation_quick_run_v1",
          projectId: "p1",
          status: "running",
          updatedAt: "2026-06-01T12:00:00.000Z",
        },
      } as RequirementsStateJson),
    ).toBe(true);
  });
});
