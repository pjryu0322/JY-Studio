import { describe, expect, it } from "vitest";
import {
  normalizeCheckedCodeTaskIds,
  readBoardCheckedCodeTaskIds,
  updateBoardCheckedCodeTaskIds,
} from "@/lib/prototype/implementationBoardCheckedIds";

describe("implementationBoardCheckedIds", () => {
  it("reads persisted selectedCodeTaskIds as checked ids", () => {
    expect(
      readBoardCheckedCodeTaskIds({
        version: "implementation_execution_board_state_v1",
        projectId: "p1",
        updatedAt: "t",
        selectedCodeTaskIds: ["A", "B"],
      }),
    ).toEqual(["A", "B"]);
  });

  it("writes checked ids to selectedCodeTaskIds on board state", () => {
    const next = updateBoardCheckedCodeTaskIds({
      state: null,
      projectId: "p1",
      checkedCodeTaskIds: ["X"],
      nowIso: "2026-06-03T00:00:00.000Z",
    });
    expect(next.selectedCodeTaskIds).toEqual(["X"]);
  });

  it("normalizeCheckedCodeTaskIds keeps explicit empty selection", () => {
    const plan = {
      version: "implementation_code_task_plan_v1" as const,
      projectId: "p1",
      updatedAt: "t",
      tasks: [{ codeTaskId: "A", parentTaskId: "T", title: "a", sortOrder: 0 }],
    };
    expect(
      normalizeCheckedCodeTaskIds({
        checkedCodeTaskIds: [],
        codeTaskPlan: plan,
      }),
    ).toEqual([]);
  });
});
