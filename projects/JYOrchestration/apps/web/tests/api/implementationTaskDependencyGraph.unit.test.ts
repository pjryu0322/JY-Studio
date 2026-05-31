import { describe, expect, it } from "vitest";
import { buildImplementationExecutionBoardFromRequirementsState } from "@/lib/prototype/implementationExecutionBoard";
import {
  classifyImplementationTaskCriticality,
  collectDependentTaskIds,
  countTasksBlockedByDependency,
  shouldStopAutoChainForFoundationFailure,
} from "@/lib/prototype/implementationTaskDependencyGraph";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

const NOW = "2026-05-30T12:00:00.000Z";

function screenTaskList(): ImplementationTaskListV1 {
  return {
    version: "implementation_task_list_v1",
    projectId: "p1",
    createdAt: NOW,
    updatedAt: NOW,
    source: "implementation_seed",
    tasks: [
      {
        taskId: "DEV-SCREEN-001",
        title: "Screen 1",
        description: "d",
        taskType: "screen",
        ownerRole: "developer",
        priority: "high",
        dependencies: [],
        acceptanceCriteria: [],
        status: "ready",
      },
      {
        taskId: "DEV-SCREEN-002",
        title: "Screen 2",
        description: "d",
        taskType: "screen",
        ownerRole: "developer",
        priority: "medium",
        dependencies: [],
        acceptanceCriteria: [],
        status: "ready",
      },
      {
        taskId: "DEV-SCREEN-003",
        title: "Screen 3",
        description: "d",
        taskType: "screen",
        ownerRole: "developer",
        priority: "low",
        dependencies: ["DEV-SCREEN-002"],
        acceptanceCriteria: [],
        status: "ready",
      },
    ],
    roleSummary: { developer: 3, designer: 0, reviewer: 0, security: 0, scm: 0 },
  };
}

describe("implementationTaskDependencyGraph", () => {
  it("collects transitive dependents of failed task", () => {
    const board = buildImplementationExecutionBoardFromRequirementsState({
      projectId: "p1",
      orchestration: { implementationTaskListV1: screenTaskList() },
    })!;
    const blocked = collectDependentTaskIds({
      taskRows: board.taskRows,
      failedTaskIds: ["DEV-SCREEN-002"],
    });
    expect(blocked).toEqual(["DEV-SCREEN-003"]);
  });

  it("classifies foundation tasks", () => {
    expect(classifyImplementationTaskCriticality({ taskId: "DEV-MOCK-001" })).toBe("foundation");
    expect(classifyImplementationTaskCriticality({ taskId: "DEV-SCREEN-002", taskType: "screen" })).toBe(
      "screen",
    );
  });

  it("counts blocked by dependency tasks on board", () => {
    const board = buildImplementationExecutionBoardFromRequirementsState({
      projectId: "p1",
      orchestration: {
        implementationTaskListV1: screenTaskList(),
        implementationTaskExecutionStateV1: {
          version: "implementation_task_execution_state_v1",
          projectId: "p1",
          createdAt: NOW,
          updatedAt: NOW,
          source: "implementation_task_list",
          items: [
            {
              taskId: "DEV-SCREEN-002",
              ownerRole: "developer",
              status: "failed",
              errorMessage: "verify failed",
            },
          ],
          summary: {
            total: 1,
            ready: 0,
            queued: 0,
            inProgress: 0,
            done: 0,
            failed: 1,
            skipped: 0,
          },
        },
      },
    })!;
    expect(board.summary.blockedByDependencyTasks).toBe(1);
    expect(countTasksBlockedByDependency({ taskRows: board.taskRows })).toBe(1);
  });

  it("stops auto chain when foundation failure blocks all remaining tasks", () => {
    const board = buildImplementationExecutionBoardFromRequirementsState({
      projectId: "p1",
      orchestration: {
        implementationTaskListV1: {
          ...screenTaskList(),
          tasks: [
            {
              taskId: "DEV-MOCK-001",
              title: "Mock",
              description: "d",
              taskType: "mock",
              ownerRole: "developer",
              priority: "high",
              dependencies: [],
              acceptanceCriteria: [],
              status: "ready",
            },
            {
              taskId: "DEV-SCREEN-002",
              title: "Screen 2",
              description: "d",
              taskType: "screen",
              ownerRole: "developer",
              priority: "medium",
              dependencies: ["DEV-MOCK-001"],
              acceptanceCriteria: [],
              status: "ready",
            },
          ],
        },
      },
    })!;
    expect(
      shouldStopAutoChainForFoundationFailure({
        failedTaskId: "DEV-MOCK-001",
        taskRows: board.taskRows,
        nextTaskId: null,
      }),
    ).toBe(true);
  });
});
