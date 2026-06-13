import { describe, expect, it } from "vitest";
import {
  buildImplementationQuickRunStartedPatch,
  deriveImplementationQuickRunStatus,
  formatQuickRunContinuationReason,
  shouldAllowTaskCursorAutoChain,
} from "@/lib/prototype/implementationQuickRun";
import { buildImplementationExecutionBoardFromRequirementsState } from "@/lib/prototype/implementationExecutionBoard";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

describe("implementationQuickRun", () => {
  const taskList: ImplementationTaskListV1 = {
    version: "implementation_task_list_v1",
    projectId: "p1",
    createdAt: "2026-05-30T12:00:00.000Z",
    updatedAt: "2026-05-30T12:00:00.000Z",
    source: "implementation_seed",
    tasks: [
      {
        taskId: "DEV-MOCK-001",
        title: "Mock",
        description: "d",
        taskType: "feature",
        ownerRole: "developer",
        priority: "high",
        dependencies: [],
        acceptanceCriteria: [],
        status: "ready",
      },
    ],
    roleSummary: { developer: 1, designer: 0, reviewer: 0, security: 0, scm: 0 },
  };

  it("starts quick run in running status", () => {
    const patch = buildImplementationQuickRunStartedPatch({
      projectId: "p1",
      currentTaskId: "DEV-MOCK-001",
      nowIso: "2026-05-30T12:00:00.000Z",
    });
    expect(patch.status).toBe("running");
    expect(patch.currentTaskId).toBe("DEV-MOCK-001");
  });

  it("blocks auto chain when idle without in-flight execution", () => {
    expect(
      shouldAllowTaskCursorAutoChain({
        quickRun: null,
        taskCursorExecution: null,
      }),
    ).toBe(false);
  });

  it("allows auto chain when quick run is running", () => {
    expect(
      shouldAllowTaskCursorAutoChain({
        quickRun: buildImplementationQuickRunStartedPatch({
          projectId: "p1",
          currentTaskId: "DEV-MOCK-001",
        }),
        taskCursorExecution: null,
      }),
    ).toBe(true);
  });

  it("derives preview_ready when previewReady", () => {
    const board = buildImplementationExecutionBoardFromRequirementsState({
      projectId: "p1",
      orchestration: { implementationTaskListV1: taskList },
    })!;
    expect(
      deriveImplementationQuickRunStatus({
        board,
        previewReady: true,
      }),
    ).toBe("preview_ready");
  });

  it("maps execution_unit_in_flight to user-facing Korean copy", () => {
    expect(formatQuickRunContinuationReason("execution_unit_in_flight")).toContain("Runtime");
    expect(formatQuickRunContinuationReason("execution_unit_in_flight")).not.toBe(
      "execution_unit_in_flight",
    );
  });
});
