import { describe, expect, it } from "vitest";
import { evaluateActiveImplementationExecutionGate } from "@/lib/prototype/implementationStageRunningGate";
import { buildImplementationStageBoardGateContext } from "@/lib/prototype/implementationStageActionPipeline";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

const NOW = "2026-06-01T21:43:01.504Z";

function taskList(): ImplementationTaskListV1 {
  return {
    version: "implementation_task_list_v1",
    projectId: "p1",
    createdAt: NOW,
    updatedAt: NOW,
    source: "implementation_seed",
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
    ],
    roleSummary: { developer: 1, designer: 0, reviewer: 0, security: 0, scm: 0 },
  };
}

describe("evaluateActiveImplementationExecutionGate", () => {
  it("does not block Quick Run when legacy in-flight cursor state exists (DB job SoT)", () => {
    const boardContext = buildImplementationStageBoardGateContext({
      projectId: "p1",
      taskList: taskList(),
      taskCursorExecutionV1: {
        version: "task_cursor_execution_v1",
        projectId: "p1",
        taskId: "DEV-MOCK-001",
        workItemIds: ["wi-1"],
        status: "cursor_running",
        cursorProvider: "cursor",
        targetRepository: "owner/repo",
        baseBranch: "main",
        workBranch: "wip/cursor/dev-mock-001",
        cursorRunId: "bc-run-1",
        createdAt: NOW,
        updatedAt: NOW,
      },
      activeTaskCursorJob: {
        id: "job-1",
        projectId: "p1",
        taskId: "DEV-MOCK-001",
        status: "cursor_running",
        pollCount: 0,
        lastPollAt: NOW,
        nextPollAt: null,
      },
    });
    expect(
      evaluateActiveImplementationExecutionGate("START_IMPLEMENTATION_QUICK_RUN", boardContext),
    ).toBeNull();
  });

  it("still blocks single task cursor request when active server job exists", () => {
    const boardContext = buildImplementationStageBoardGateContext({
      projectId: "p1",
      taskList: taskList(),
      activeTaskCursorJob: {
        id: "job-1",
        projectId: "p1",
        taskId: "DEV-MOCK-001",
        status: "cursor_running",
        pollCount: 0,
        lastPollAt: NOW,
        nextPollAt: null,
      },
    });
    const gate = evaluateActiveImplementationExecutionGate(
      "REQUEST_TASK_CURSOR_EXECUTION",
      boardContext,
    );
    expect(gate?.ok).toBe(false);
    expect(gate?.message).toContain("현재 AI 개발자");
  });

  it("returns null when no active execution", () => {
    const boardContext = buildImplementationStageBoardGateContext({
      projectId: "p1",
      taskList: taskList(),
    });
    expect(
      evaluateActiveImplementationExecutionGate("START_IMPLEMENTATION_QUICK_RUN", boardContext),
    ).toBeNull();
  });
});
