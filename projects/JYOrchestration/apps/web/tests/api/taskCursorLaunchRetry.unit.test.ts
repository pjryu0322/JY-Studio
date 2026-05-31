import { describe, expect, it } from "vitest";
import {
  formatTransientTaskCursorLaunchErrorMessage,
  isTransientTaskCursorLaunchError,
} from "@/lib/prototype/taskCursorLaunchRetry";
import { resolveTaskCursorAutoChainDecision } from "@/lib/prototype/implementationTaskCursorAutoChain";
import { buildImplementationExecutionBoardFromRequirementsState } from "@/lib/prototype/implementationExecutionBoard";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

describe("taskCursorLaunchRetry", () => {
  it("detects transient fetch/HMR errors", () => {
    expect(isTransientTaskCursorLaunchError("Failed to fetch")).toBe(true);
    expect(isTransientTaskCursorLaunchError("서버 연결이 끊어졌습니다. dev 서버 재컴파일/HMR 직후면 잠시 후 다시 시도해 주세요.")).toBe(true);
    expect(isTransientTaskCursorLaunchError("Cursor API endpoint unsupported")).toBe(false);
  });

  it("formats transient launch errors with friendly message", () => {
    expect(formatTransientTaskCursorLaunchErrorMessage(new TypeError("Failed to fetch"))).toContain(
      "서버 연결이 끊어졌습니다",
    );
  });
});

describe("auto chain transient failure retry", () => {
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

  it("retries same task after transient cursor_failed", () => {
    const board = buildImplementationExecutionBoardFromRequirementsState({
      projectId: "p1",
      orchestration: { implementationTaskListV1: taskList },
    })!;
    const decision = resolveTaskCursorAutoChainDecision({
      board,
      taskCursorExecution: {
        version: "task_cursor_execution_v1",
        projectId: "p1",
        taskId: "DEV-MOCK-001",
        workItemIds: ["wi-1"],
        status: "cursor_failed",
        cursorProvider: "cursor",
        targetRepository: "owner/repo",
        baseBranch: "main",
        workBranch: "wip/cursor/dev-mock-001",
        errorMessage: "서버 연결이 끊어졌습니다. dev 서버 재컴파일/HMR 직후면 잠시 후 다시 시도해 주세요.",
        createdAt: "2026-05-30T12:00:00.000Z",
        updatedAt: "2026-05-30T12:00:00.000Z",
      },
    });
    expect(decision).toEqual({ kind: "start", taskId: "DEV-MOCK-001" });
  });
});
