import { describe, expect, it } from "vitest";
import { buildImplementationExecutionBoardFromRequirementsState } from "@/lib/prototype/implementationExecutionBoard";
import { pickFirstExecutableDeveloperTaskId } from "@/lib/prototype/implementationExecutionBoard";
import {
  buildTaskCursorAutoChainTriggerKey,
  resolveTaskCursorAutoChainDecision,
} from "@/lib/prototype/implementationTaskCursorAutoChain";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

const NOW = "2026-05-30T12:00:00.000Z";

function taskListThree(): ImplementationTaskListV1 {
  return {
    version: "implementation_task_list_v1",
    projectId: "p1",
    createdAt: NOW,
    updatedAt: NOW,
    source: "implementation_seed",
    tasks: [
      {
        taskId: "DEV-LOW",
        title: "low",
        description: "d",
        taskType: "feature",
        ownerRole: "developer",
        priority: "low",
        dependencies: [],
        acceptanceCriteria: [],
        status: "ready",
      },
      {
        taskId: "DEV-HIGH",
        title: "high",
        description: "d",
        taskType: "feature",
        ownerRole: "developer",
        priority: "high",
        dependencies: [],
        acceptanceCriteria: [],
        status: "ready",
      },
      {
        taskId: "DEV-MED",
        title: "med",
        description: "d",
        taskType: "feature",
        ownerRole: "developer",
        priority: "medium",
        dependencies: ["DEV-HIGH"],
        acceptanceCriteria: [],
        status: "ready",
      },
    ],
    roleSummary: { developer: 3, designer: 0, reviewer: 0, security: 0, scm: 0 },
  };
}

describe("implementationTaskCursorAutoChain", () => {
  it("picks highest priority executable developer task first", () => {
    const board = buildImplementationExecutionBoardFromRequirementsState({
      projectId: "p1",
      orchestration: { implementationTaskListV1: taskListThree() },
    })!;
    expect(pickFirstExecutableDeveloperTaskId(board)).toBe("DEV-HIGH");
  });

  it("starts first task automatically when no cursor execution exists", () => {
    const board = buildImplementationExecutionBoardFromRequirementsState({
      projectId: "p1",
      orchestration: { implementationTaskListV1: taskListThree() },
    })!;
    const decision = resolveTaskCursorAutoChainDecision({
      board,
      taskCursorExecution: null,
      autoGate: null,
    });
    expect(decision).toEqual({ kind: "start", taskId: "DEV-HIGH" });
  });

  it("continues to next task after scm_pending and auto gate passed", () => {
    const board = buildImplementationExecutionBoardFromRequirementsState({
      projectId: "p1",
      orchestration: {
        implementationTaskListV1: taskListThree(),
        implementationTaskExecutionStateV1: {
          version: "implementation_task_execution_state_v1",
          projectId: "p1",
          createdAt: NOW,
          updatedAt: NOW,
          items: [
            {
              taskId: "DEV-HIGH",
              ownerRole: "developer",
              status: "done",
              updatedAt: NOW,
            },
          ],
          summary: {
            total: 1,
            done: 1,
            inProgress: 0,
            failed: 0,
            skipped: 0,
            queued: 0,
          },
        },
      },
    })!;
    const decision = resolveTaskCursorAutoChainDecision({
      board,
      taskCursorExecution: {
        version: "task_cursor_execution_v1",
        projectId: "p1",
        taskId: "DEV-HIGH",
        workItemIds: ["wi-1"],
        status: "scm_pending",
        cursorProvider: "cursor",
        targetRepository: "owner/repo",
        baseBranch: "main",
        workBranch: "wip/cursor/dev-high",
        commitSha: "abc123def4567890abcdef1234567890abcdef12",
        createdAt: NOW,
        updatedAt: NOW,
      },
      autoGate: {
        version: "implementation_auto_quality_gate_v1",
        projectId: "p1",
        taskId: "DEV-HIGH",
        sourceCommitSha: "abc123def4567890abcdef1234567890abcdef12",
        changedFiles: ["src/a.ts"],
        status: "passed",
        startedAt: NOW,
        updatedAt: NOW,
      },
    });
    expect(decision).toEqual({
      kind: "continue",
      fromTaskId: "DEV-HIGH",
      toTaskId: "DEV-MED",
    });
    expect(
      buildTaskCursorAutoChainTriggerKey(
        decision as Exclude<typeof decision, Readonly<{ readonly kind: "none" }>>,
      ),
    ).toBe("continue:DEV-HIGH->DEV-MED");
  });

  it("does not continue when auto gate failed", () => {
    const board = buildImplementationExecutionBoardFromRequirementsState({
      projectId: "p1",
      orchestration: { implementationTaskListV1: taskListThree() },
    })!;
    const decision = resolveTaskCursorAutoChainDecision({
      board,
      taskCursorExecution: {
        version: "task_cursor_execution_v1",
        projectId: "p1",
        taskId: "DEV-HIGH",
        workItemIds: ["wi-1"],
        status: "review_pending",
        cursorProvider: "cursor",
        targetRepository: "owner/repo",
        baseBranch: "main",
        workBranch: "wip/cursor/dev-high",
        commitSha: "abc123def4567890abcdef1234567890abcdef12",
        createdAt: NOW,
        updatedAt: NOW,
      },
      autoGate: {
        version: "implementation_auto_quality_gate_v1",
        projectId: "p1",
        taskId: "DEV-HIGH",
        sourceCommitSha: "abc123def4567890abcdef1234567890abcdef12",
        changedFiles: ["src/a.ts"],
        status: "failed",
        startedAt: NOW,
        updatedAt: NOW,
      },
    });
    expect(decision).toEqual({ kind: "none" });
  });
});
