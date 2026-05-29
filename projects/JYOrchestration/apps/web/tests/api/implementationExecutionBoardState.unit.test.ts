import { describe, expect, it } from "vitest";
import {
  appendReworkRequest,
  countActiveReworkRequestsForTask,
  getActiveReworkContextForTask,
  getActiveReworkRequestsForTask,
  getUserConfirmationForTask,
  parseImplementationExecutionBoardStateV1,
  resolveAllPendingUserConfirmations,
  resolveUserConfirmationForTask,
} from "@/lib/prototype/implementationExecutionBoardState";
import {
  buildImplementationExecutionBoard,
  canContinueTaskDespiteUserConfirmation,
} from "@/lib/prototype/implementationExecutionBoard";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

const NOW = "2026-05-28T12:00:00.000Z";

describe("implementationExecutionBoardState", () => {
  const boardState = parseImplementationExecutionBoardStateV1({
    version: "implementation_execution_board_state_v1",
    projectId: "p1",
    createdAt: NOW,
    updatedAt: NOW,
    userConfirmations: [
      { taskId: "dev-1", status: "required_non_blocking", reason: "확인" },
      { taskId: "dev-2", status: "blocking", reason: "차단" },
    ],
    reworkRequests: [
      {
        requestId: "rw-1",
        taskId: "dev-1",
        targetRole: "developer",
        reason: "재작업",
        status: "requested",
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        requestId: "rw-2",
        taskId: "dev-1",
        targetRole: "developer",
        reason: "완료됨",
        status: "done",
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        requestId: "rw-3",
        taskId: "dev-1",
        targetRole: "developer",
        reason: "취소",
        status: "cancelled",
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
  });

  it("parseImplementationExecutionBoardStateV1 normalizes valid state", () => {
    expect(boardState?.version).toBe("implementation_execution_board_state_v1");
    expect(boardState?.userConfirmations).toHaveLength(2);
    expect(boardState?.reworkRequests).toHaveLength(3);
  });

  it("getUserConfirmationForTask returns confirmation for task", () => {
    const confirmation = getUserConfirmationForTask(boardState, "dev-1");
    expect(confirmation?.status).toBe("required_non_blocking");
    expect(confirmation?.reason).toBe("확인");
  });

  it("countActiveReworkRequestsForTask excludes cancelled and done", () => {
    expect(countActiveReworkRequestsForTask(boardState, "dev-1")).toBe(1);
    expect(countActiveReworkRequestsForTask(boardState, "dev-2")).toBe(0);
  });

  it("canContinueTaskDespiteUserConfirmation follows blocking policy", () => {
    expect(canContinueTaskDespiteUserConfirmation("required_non_blocking")).toBe(true);
    expect(canContinueTaskDespiteUserConfirmation("blocking")).toBe(false);
    const blocking = getUserConfirmationForTask(boardState, "dev-2");
    expect(blocking?.status).toBe("blocking");
    if (blocking) {
      expect(canContinueTaskDespiteUserConfirmation(blocking.status)).toBe(false);
    }
  });

  it("resolveUserConfirmationForTask marks resolvedAt", () => {
    const resolved = resolveUserConfirmationForTask({
      state: boardState,
      projectId: "p1",
      taskId: "dev-2",
      nowIso: NOW,
    });
    const confirmation = getUserConfirmationForTask(resolved, "dev-2");
    expect(confirmation?.resolvedAt).toBe(NOW);
    expect(confirmation?.resolvedByUser).toBe(true);
  });

  it("resolveAllPendingUserConfirmations resolves every pending confirmation", () => {
    const resolved = resolveAllPendingUserConfirmations({
      state: boardState,
      projectId: "p1",
      nowIso: NOW,
    });
    expect(resolved.userConfirmations.every((c) => c.resolvedAt)).toBe(true);
  });

  it("appendReworkRequest adds requested row", () => {
    const next = appendReworkRequest({
      state: boardState,
      projectId: "p1",
      taskId: "dev-2",
      targetRole: "developer",
      reason: "버튼 보완",
      nowIso: NOW,
      requestId: "rw-new",
    });
    expect(getActiveReworkRequestsForTask(next, "dev-2")).toHaveLength(1);
    expect(getActiveReworkContextForTask(next, "dev-2")[0]).toContain("버튼 보완");
  });

  it("resolved confirmation no longer blocks board row", () => {
    const taskList: ImplementationTaskListV1 = {
      version: "implementation_task_list_v1",
      projectId: "p1",
      createdAt: NOW,
      updatedAt: NOW,
      source: "implementation_seed",
      tasks: [
        {
          taskId: "dev-1",
          title: "t1",
          description: "d",
          taskType: "screen",
          ownerRole: "developer",
          priority: "high",
          dependencies: [],
          acceptanceCriteria: [],
          status: "ready",
        },
        {
          taskId: "dev-2",
          title: "t2",
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
    const resolved = resolveUserConfirmationForTask({
      state: boardState,
      projectId: "p1",
      taskId: "dev-2",
      nowIso: NOW,
    });
    const board = buildImplementationExecutionBoard({
      projectId: "p1",
      taskList,
      boardState: resolved,
      nowIso: NOW,
    });
    const row = board.taskRows.find((r) => r.taskId === "dev-2");
    expect(row?.userConfirmation).toBe("none");
    expect(row?.canContinueWithoutUserConfirmation).toBe(true);
    expect(board.summary.blockingUserConfirmation).toBe(0);
    expect(board.summary.userConfirmationRequired).toBe(1);
  });
});
