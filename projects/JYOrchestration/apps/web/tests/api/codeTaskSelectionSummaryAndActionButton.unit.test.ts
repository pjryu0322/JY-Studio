import { describe, expect, it } from "vitest";
import { CANONICAL_SAMPLE_DATA_CODE_TASK_ID } from "@/lib/prototype/codeTaskCanonicalId";
import { summarizeCodeTaskBoardRowsFromTreeNodes } from "@/lib/prototype/implementationCodeTaskBoardState";
import { resolveImplementationBoardPrimaryAction } from "@/lib/prototype/implementationActionButtonPolicy";
import { boardTreeNode } from "./implementationBoardSummaryTestHelpers";

describe("P3-08C/08D board selection summary and footer actions", () => {
  const completedIds = ["CT-1", "CT-2"];
  const sampleId = CANONICAL_SAMPLE_DATA_CODE_TASK_ID;

  const baseNodes = [
    ...completedIds.map((id) => boardTreeNode(id, "완료", "GitHub outcome 저장됨", true)),
    boardTreeNode(sampleId, "대기", "실행 가능", false),
  ];

  it("reports runnableCount=1 when only sample data is execution-eligible", () => {
    const summary = summarizeCodeTaskBoardRowsFromTreeNodes({
      nodes: baseNodes,
      checkedCodeTaskIds: [],
    });
    expect(summary.runnableCount).toBe(1);
    expect(summary.integrationReadyCount).toBe(2);
  });

  it("excludes checked completed tasks from selectedRunnableCount", () => {
    const summary = summarizeCodeTaskBoardRowsFromTreeNodes({
      nodes: baseNodes,
      checkedCodeTaskIds: [completedIds[0]!, sampleId],
    });
    expect(summary.selectedRunnableCount).toBe(1);
    expect(summary.selectedRunnableCodeTaskIds).toEqual([sampleId]);
  });

  it("does not show board execute when runnable sample is selected", () => {
    const summary = summarizeCodeTaskBoardRowsFromTreeNodes({
      nodes: baseNodes,
      checkedCodeTaskIds: [sampleId],
    });
    const action = resolveImplementationBoardPrimaryAction({
      selectionSummary: summary,
    });
    expect(action.showExecuteSelectedButton).toBe(false);
    expect(action.primaryAction).toBeNull();
    expect(action.showIntegrationPrepareButton).toBe(true);
  });

  it("primary action is integration when no runnable tasks remain", () => {
    const summary = summarizeCodeTaskBoardRowsFromTreeNodes({
      nodes: completedIds.map((id) => boardTreeNode(id, "완료", "GitHub outcome 저장됨", true)),
      checkedCodeTaskIds: [],
    });
    const action = resolveImplementationBoardPrimaryAction({
      selectionSummary: summary,
    });
    expect(action.primaryAction).toBe("prepare_integration_preview");
    expect(action.showIntegrationPrepareButton).toBe(true);
  });
});
