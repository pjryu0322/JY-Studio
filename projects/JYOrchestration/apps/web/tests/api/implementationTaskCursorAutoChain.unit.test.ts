import { describe, expect, it } from "vitest";
import { buildImplementationExecutionBoardFromRequirementsState } from "@/lib/prototype/implementationExecutionBoard";
import { pickFirstExecutableDeveloperTaskId } from "@/lib/prototype/implementationExecutionBoard";
import {
  buildTaskCursorAutoChainTriggerKey,
  planImmediateTaskCursorAutoChainAfterFailure,
  resolveTaskCursorAutoChainDecision,
} from "@/lib/prototype/implementationTaskCursorAutoChain";
import { canContinueTaskCursorAutoChainAfterFailure } from "@/lib/prototype/taskCursorFailurePolicy";
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

  it("continues to next task when board execution state is stale but current task passed gate", () => {
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
  });

  it("continues after github_verify_failed when independent task exists", () => {
    const list: ImplementationTaskListV1 = {
      version: "implementation_task_list_v1",
      projectId: "p1",
      createdAt: NOW,
      updatedAt: NOW,
      source: "implementation_seed",
      tasks: [
        {
          taskId: "DEV-SCREEN-002",
          title: "Screen 2",
          description: "d",
          taskType: "screen",
          ownerRole: "developer",
          priority: "high",
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
          priority: "medium",
          dependencies: [],
          acceptanceCriteria: [],
          status: "ready",
        },
      ],
      roleSummary: { developer: 2, designer: 0, reviewer: 0, security: 0, scm: 0 },
    };
    const board = buildImplementationExecutionBoardFromRequirementsState({
      projectId: "p1",
      orchestration: { implementationTaskListV1: list },
    })!;
    const decision = resolveTaskCursorAutoChainDecision({
      board,
      taskCursorExecution: {
        version: "task_cursor_execution_v1",
        projectId: "p1",
        taskId: "DEV-SCREEN-002",
        workItemIds: ["wi-1"],
        status: "github_verify_failed",
        cursorProvider: "cursor",
        targetRepository: "owner/repo",
        baseBranch: "main",
        workBranch: "wip/cursor/dev-screen-002",
        failureReason: "github_verify_failed",
        errorMessage: "branch missing",
        createdAt: NOW,
        updatedAt: NOW,
      },
      autoGate: null,
    });
    expect(decision).toEqual({
      kind: "continue_after_failure",
      failedTaskId: "DEV-SCREEN-002",
      toTaskId: "DEV-SCREEN-003",
      blockedTaskIds: [],
    });
  });

  it("does not auto-chain after status_check_stopped poll cancel", () => {
    const list: ImplementationTaskListV1 = {
      version: "implementation_task_list_v1",
      projectId: "p1",
      createdAt: NOW,
      updatedAt: NOW,
      source: "implementation_seed",
      tasks: [
        {
          taskId: "DEV-SCREEN-002",
          title: "Screen 2",
          description: "d",
          taskType: "screen",
          ownerRole: "developer",
          priority: "high",
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
          priority: "medium",
          dependencies: [],
          acceptanceCriteria: [],
          status: "ready",
        },
      ],
      roleSummary: { developer: 2, designer: 0, reviewer: 0, security: 0, scm: 0 },
    };
    const board = buildImplementationExecutionBoardFromRequirementsState({
      projectId: "p1",
      orchestration: { implementationTaskListV1: list },
    })!;
    const execution = {
      version: "task_cursor_execution_v1" as const,
      projectId: "p1",
      taskId: "DEV-SCREEN-002",
      workItemIds: ["wi-1"],
      status: "status_check_stopped" as const,
      cursorProvider: "cursor" as const,
      targetRepository: "owner/repo",
      baseBranch: "main",
      workBranch: "wip/cursor/dev-screen-002",
      cursorRunId: "bc-run-poll-stop",
      errorMessage: "사용자가 Cloud Agent 상태 확인을 중단했습니다.",
      createdAt: NOW,
      updatedAt: NOW,
    };
    const decision = resolveTaskCursorAutoChainDecision({
      board,
      taskCursorExecution: execution,
      autoGate: null,
    });
    expect(decision).toEqual({ kind: "none" });
    expect(planImmediateTaskCursorAutoChainAfterFailure({ board, execution })).toBeNull();
  });

  it("continues after work_item_preflight_failed when independent task exists", () => {
    const list: ImplementationTaskListV1 = {
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
          dependencies: ["DEV-SCREEN-001"],
          acceptanceCriteria: [],
          status: "ready",
        },
      ],
      roleSummary: { developer: 3, designer: 0, reviewer: 0, security: 0, scm: 0 },
    };
    const board = buildImplementationExecutionBoardFromRequirementsState({
      projectId: "p1",
      orchestration: { implementationTaskListV1: list },
    })!;
    const execution = {
      version: "task_cursor_execution_v1" as const,
      projectId: "p1",
      taskId: "DEV-SCREEN-001",
      workItemIds: ["wi-1"],
      status: "cursor_failed" as const,
      cursorProvider: "cursor" as const,
      targetRepository: "owner/repo",
      baseBranch: "main",
      workBranch: "wip/cursor/dev-screen-001",
      failureReason: "work_item_preflight_failed" as const,
      errorMessage: "WorkItem preflight failed",
      createdAt: NOW,
      updatedAt: NOW,
    };
    const decision = resolveTaskCursorAutoChainDecision({
      board,
      taskCursorExecution: execution,
      autoGate: null,
    });
    expect(decision).toEqual({
      kind: "continue_after_failure",
      failedTaskId: "DEV-SCREEN-001",
      toTaskId: "DEV-SCREEN-002",
      blockedTaskIds: [],
    });
    expect(
      canContinueTaskCursorAutoChainAfterFailure(execution),
    ).toBe(true);
  });

  it("retries failed foundation task instead of skipping to dependent DEV-COMMON", () => {
    const list: ImplementationTaskListV1 = {
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
        {
          taskId: "DEV-COMMON-001",
          title: "Common",
          description: "d",
          taskType: "feature",
          ownerRole: "developer",
          priority: "medium",
          dependencies: ["DEV-MOCK-001"],
          acceptanceCriteria: [],
          status: "ready",
        },
      ],
      roleSummary: { developer: 2, designer: 0, reviewer: 0, security: 0, scm: 0 },
    };
    const board = buildImplementationExecutionBoardFromRequirementsState({
      projectId: "p1",
      orchestration: { implementationTaskListV1: list },
    })!;
    const execution = {
      version: "task_cursor_execution_v1" as const,
      projectId: "p1",
      taskId: "DEV-MOCK-001",
      workItemIds: ["wi-1"],
      status: "cursor_failed" as const,
      cursorProvider: "cursor" as const,
      targetRepository: "owner/repo",
      baseBranch: "main",
      workBranch: "wip/cursor/dev-mock-001",
      failureReason: "github_verify_failed" as const,
      errorMessage: "GitHub branch missing",
      createdAt: NOW,
      updatedAt: NOW,
    };
    const decision = resolveTaskCursorAutoChainDecision({
      board,
      taskCursorExecution: execution,
      autoGate: null,
    });
    expect(decision).toEqual({
      kind: "continue_after_failure",
      failedTaskId: "DEV-MOCK-001",
      toTaskId: "DEV-COMMON-001",
      blockedTaskIds: [],
    });
  });

  it("stops auto chain on github_auth_failed", () => {
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
        status: "github_verify_failed",
        cursorProvider: "cursor",
        targetRepository: "owner/repo",
        baseBranch: "main",
        workBranch: "wip/cursor/dev-high",
        failureReason: "github_auth_failed",
        createdAt: NOW,
        updatedAt: NOW,
      },
      autoGate: null,
    });
    expect(decision).toEqual({ kind: "none" });
  });
});
