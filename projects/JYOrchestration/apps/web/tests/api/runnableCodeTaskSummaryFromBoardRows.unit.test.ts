import { describe, expect, it } from "vitest";
import {
  resolveCodeTaskBoardState,
  summarizeCodeTaskBoardRowsFromTreeNodes,
} from "@/lib/prototype/implementationCodeTaskBoardState";
import { resolveImplementationBoardPrimaryAction } from "@/lib/prototype/implementationActionButtonPolicy";
import {
  isCodeTaskTreeFullySelected,
  resolveCodeTaskTreeSelectAll,
} from "@/lib/prototype/implementationTaskTreeCodeTaskSelection";

function node(codeTaskId: string, statusLabel: string, progressLabel: string, github = false) {
  const boardState = resolveCodeTaskBoardState({
    codeTaskId,
    title: codeTaskId,
    statusLabel,
    progressLabel,
    githubOutcomeSaved: github,
    commitSha: github ? "sha" : null,
    branchName: github ? "wip/branch" : null,
  });
  return { codeTaskId, boardState };
}

describe("summarizeCodeTaskBoardRowsFromTreeNodes", () => {
  it("counts one runnable sample data task and fourteen integration-ready tasks", () => {
    const completed = Array.from({ length: 14 }, (_, i) =>
      node(`CODE-DONE-${i}`, "완료", "GitHub outcome 저장됨", true),
    );
    const runnable = node("CODE-DATA-SAMPLE-001", "대기", "실행 가능", false);
    const summary = summarizeCodeTaskBoardRowsFromTreeNodes({
      nodes: [...completed, runnable],
      selectedCodeTaskIds: [],
    });
    expect(summary.totalCount).toBe(15);
    expect(summary.runnableCount).toBe(1);
    expect(summary.integrationReadyCount).toBe(14);
    expect(summary.selectedRunnableCount).toBe(0);
  });

  it("counts selected runnable from board rows", () => {
    const nodes = [
      node("CODE-DATA-SAMPLE-001", "대기", "실행 가능", false),
      node("CODE-DONE-0", "완료", "GitHub outcome 저장됨", true),
    ];
    const summary = summarizeCodeTaskBoardRowsFromTreeNodes({
      nodes,
      selectedCodeTaskIds: ["CODE-DATA-SAMPLE-001"],
    });
    expect(summary.selectedRunnableCount).toBe(1);
    expect(summary.selectedRunnableCodeTaskIds).toEqual(["CODE-DATA-SAMPLE-001"]);
  });

  it("select-all picks only runnable board rows", () => {
    const nodes = [
      node("CODE-DATA-SAMPLE-001", "대기", "실행 가능", false),
      ...Array.from({ length: 3 }, (_, i) =>
        node(`CODE-DONE-${i}`, "완료", "GitHub outcome 저장됨", true),
      ),
    ];
    const waitingIds = nodes
      .filter((n) => n.boardState.statusLabel === "대기")
      .map((n) => n.codeTaskId);
    const codeTaskPlan = {
      version: "implementation_code_task_plan_v1" as const,
      projectId: "p1",
      updatedAt: new Date(0).toISOString(),
      tasks: nodes.map((n, i) => ({
        codeTaskId: n.codeTaskId,
        parentTaskId: "TASK-1",
        title: n.codeTaskId,
        sortOrder: i,
      })),
    };
    const selected = resolveCodeTaskTreeSelectAll({
      selectAll: true,
      codeTaskPlan,
      userSelectableCodeTaskIds: waitingIds,
    });
    expect(selected).toEqual(["CODE-DATA-SAMPLE-001"]);
    expect(
      isCodeTaskTreeFullySelected({
        selectedCodeTaskIds: selected,
        codeTaskPlan,
        userSelectableCodeTaskIds: waitingIds,
      }),
    ).toBe(true);
  });
});

describe("resolveImplementationBoardPrimaryAction from board summary", () => {
  const summary14Plus1 = summarizeCodeTaskBoardRowsFromTreeNodes({
    nodes: [
      ...Array.from({ length: 14 }, (_, i) =>
        node(`CODE-DONE-${i}`, "완료", "GitHub outcome 저장됨", true),
      ),
      node("CODE-DATA-SAMPLE-001", "대기", "실행 가능", false),
    ],
    selectedCodeTaskIds: [],
  });

  it("does not show board execute when runnable tasks remain (toolbar Quick Run only)", () => {
    const action = resolveImplementationBoardPrimaryAction({
      userActionSummary: summary14Plus1,
      integrationPrepareEnabled: true,
    });
    expect(action.showExecuteSelectedButton).toBe(false);
    expect(action.primaryAction).toBeNull();
    expect(action.showIntegrationPrepareButton).toBe(true);
  });

  it("does not show board execute when runnable task is selected", () => {
    const summary = summarizeCodeTaskBoardRowsFromTreeNodes({
      nodes: [
        node("CODE-DATA-SAMPLE-001", "대기", "실행 가능", false),
        node("CODE-DONE-0", "완료", "GitHub outcome 저장됨", true),
      ],
      selectedCodeTaskIds: ["CODE-DATA-SAMPLE-001"],
    });
    const action = resolveImplementationBoardPrimaryAction({
      userActionSummary: summary,
      integrationPrepareEnabled: true,
    });
    expect(action.showExecuteSelectedButton).toBe(false);
    expect(action.primaryAction).toBeNull();
  });

  it("shows integration primary when no runnable remain", () => {
    const summary = summarizeCodeTaskBoardRowsFromTreeNodes({
      nodes: [node("CODE-DONE-0", "완료", "GitHub outcome 저장됨", true)],
      selectedCodeTaskIds: [],
    });
    const action = resolveImplementationBoardPrimaryAction({
      userActionSummary: summary,
      integrationPrepareEnabled: true,
    });
    expect(action.primaryLabel).toBe("통합 및 Preview 준비");
    expect(action.primaryEnabled).toBe(true);
  });
});
