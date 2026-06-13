import { describe, expect, it } from "vitest";
import {
  buildTaskCursorJobOrchestrationSlice,
  buildTaskCursorJobOrchestrationSyncFingerprint,
} from "@/lib/prototype/taskCursorJobStateSync";
import { shouldSyncTaskCursorServerJobPollState } from "@/lib/prototype/taskCursorServerJobPollState";import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

describe("buildTaskCursorJobOrchestrationSlice", () => {
  it("includes code task runs and execution units for client poll sync", () => {
    const slice = buildTaskCursorJobOrchestrationSlice({
      codeTaskExecutionRunsV1: [{ runId: "r1", commitSha: "abc" }],
      implementationExecutionUnitsV1: { version: "implementation_execution_units_v1", units: [] },
    } as RequirementsStateJson);
    expect(slice.codeTaskExecutionRunsV1).toBeTruthy();
    expect(slice.implementationExecutionUnitsV1).toBeTruthy();
    const fp = buildTaskCursorJobOrchestrationSyncFingerprint({
      taskCursorExecutionV1: { status: "cursor_running", commitSha: "abc", updatedAt: "t" },
      codeTaskExecutionRunsV1: [{ runId: "r1", commitSha: "abc", updatedAt: "t" }],
    });
    expect(fp).toContain("abc");
  });
});

describe("shouldSyncTaskCursorServerJobPollState", () => {
  it("returns true when an execution unit is running", () => {
    const state: RequirementsStateJson = {
      implementationExecutionUnitsV1: {
        version: "implementation_execution_units_v1",
        projectId: "p1",
        updatedAt: "2026-06-13T00:00:00.000Z",
        units: [
          {
            unitId: "u1",
            codeTaskId: "CODE-A",
            processTaskId: "DEV-1",
            title: "A",
            order: 0,
            branchGroup: "feature",
            baseBranch: "main",
            workBranch: "wip/feature/a",
            dependencies: [],
            status: "running",
          },
        ],
      },
    };
    expect(shouldSyncTaskCursorServerJobPollState(state)).toBe(true);
  });
});
