import { describe, expect, it } from "vitest";
import { CANONICAL_SAMPLE_DATA_CODE_TASK_ID } from "@/lib/prototype/codeTaskCanonicalId";
import {
  listRunnableCodeTaskIdsFromBoardNodes,
  listUserCheckboxSelectableCodeTaskIdsFromBoardNodes,
  summarizeCodeTaskBoardRowsFromTreeNodes,
} from "@/lib/prototype/implementationCodeTaskBoardState";
import { resolveImplementationBoardPrimaryAction } from "@/lib/prototype/implementationActionButtonPolicy";
import { resolveCodeTaskTreeSelectAll } from "@/lib/prototype/implementationTaskTreeCodeTaskSelection";
import { boardTreeNode } from "./implementationBoardSummaryTestHelpers";

const NOW = "2026-06-03T12:00:00.000Z";

describe("runnable CodeTask user selection (board rows, P3-08D)", () => {
  const completed = ["CT-1", "CT-2"];
  const sample = CANONICAL_SAMPLE_DATA_CODE_TASK_ID;
  const nodes = [
    ...completed.map((id) => boardTreeNode(id, "완료", "GitHub outcome 저장됨", true)),
    boardTreeNode(sample, "대기", "실행 가능", false),
  ];

  it("sample data 대기/실행 가능 is user runnable on the board", () => {
    const sampleNode = nodes.find((n) => n.codeTaskId === sample)!;
    expect(sampleNode.boardState.isRunnableForUser).toBe(true);
    expect(sampleNode.boardState.checkboxDisabled).toBe(false);
  });

  it("completed outcome saved is not user runnable but integration-ready", () => {
    const doneNode = nodes.find((n) => n.codeTaskId === completed[0])!;
    expect(doneNode.boardState.isRunnableForUser).toBe(false);
    expect(doneNode.boardState.isIntegrationReady).toBe(true);
    expect(doneNode.boardState.checkboxDisabled).toBe(true);
  });

  it("summary reports runnable 1 and integration ready 2", () => {
    const summary = summarizeCodeTaskBoardRowsFromTreeNodes({
      nodes,
      checkedCodeTaskIds: [],
    });
    expect(summary.runnableCount).toBe(1);
    expect(summary.integrationReadyCount).toBe(2);
  });

  it("select all picks only 대기 (user-selectable) sample task", () => {
    const waitingIds = listUserCheckboxSelectableCodeTaskIdsFromBoardNodes(nodes);
    const plan = {
      version: "implementation_code_task_plan_v1" as const,
      projectId: "p1",
      createdAt: NOW,
      updatedAt: NOW,
      tasks: nodes.map((n, i) => ({
        codeTaskId: n.codeTaskId,
        parentTaskId: "DEV-A",
        title: n.codeTaskId,
        sortOrder: i,
      })),
    };
    const selected = resolveCodeTaskTreeSelectAll({
      selectAll: true,
      codeTaskPlan: plan,
      userSelectableCodeTaskIds: waitingIds,
    });
    expect(selected).toEqual([sample]);
  });

  it("does not show board execute when sample selected", () => {
    const summary = summarizeCodeTaskBoardRowsFromTreeNodes({
      nodes,
      checkedCodeTaskIds: [sample],
    });
    const action = resolveImplementationBoardPrimaryAction({
      selectionSummary: summary,
    });
    expect(action.showExecuteSelectedButton).toBe(false);
    expect(action.showIntegrationPrepareButton).toBe(true);
  });

  it("primary action is integration when no runnable left", () => {
    const doneNodes = nodes.filter((n) => n.codeTaskId !== sample);
    const summary = summarizeCodeTaskBoardRowsFromTreeNodes({
      nodes: doneNodes,
      checkedCodeTaskIds: [],
    });
    const action = resolveImplementationBoardPrimaryAction({
      selectionSummary: summary,
      integrationPrepareEnabled: true,
    });
    expect(action.primaryAction).toBe("prepare_integration_preview");
  });

  it("listRunnableCodeTaskIdsFromBoardNodes matches displayed runnable rows", () => {
    const ids = listRunnableCodeTaskIdsFromBoardNodes(nodes);
    expect(ids).toEqual([sample]);
  });
});
