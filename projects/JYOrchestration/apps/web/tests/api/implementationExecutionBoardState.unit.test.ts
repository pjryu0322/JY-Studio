import { describe, expect, it } from "vitest";
import {
  countActiveReworkRequestsForTask,
  getUserConfirmationForTask,
  parseImplementationExecutionBoardStateV1,
} from "@/lib/prototype/implementationExecutionBoardState";
import { canContinueTaskDespiteUserConfirmation } from "@/lib/prototype/implementationExecutionBoard";

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
});
