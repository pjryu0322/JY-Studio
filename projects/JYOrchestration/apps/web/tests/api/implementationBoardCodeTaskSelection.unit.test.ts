import { describe, expect, it } from "vitest";
import { CANONICAL_SAMPLE_DATA_CODE_TASK_ID } from "@/lib/prototype/codeTaskCanonicalId";
import {
  coalesceImplementationBoardLiveSelectedCodeTaskIdsOverride,
  resolveImplementationBoardQuickRunSelection,
} from "@/lib/prototype/implementationBoardCodeTaskSelection";
import { evaluateQuickRunExecutionSelectionGate } from "@/lib/prototype/implementationExecutionButtonPolicy";

describe("evaluateQuickRunExecutionSelectionGate with board runnable ids", () => {
  it("accepts selection when board runnable set includes selected sample task", () => {
    const gate = evaluateQuickRunExecutionSelectionGate({
      selectedCodeTaskIds: ["CODE-DATA-SAMPLE-001"],
      runnableCodeTaskIdsFromBoard: ["CODE-DATA-SAMPLE-001"],
    });
    expect(gate.ok).toBe(true);
    expect(gate.runnableIds).toEqual(["CODE-DATA-SAMPLE-001"]);
  });

  it("rejects when board runnable set does not include selection", () => {
    const gate = evaluateQuickRunExecutionSelectionGate({
      selectedCodeTaskIds: ["CODE-DONE-001"],
      runnableCodeTaskIdsFromBoard: ["CODE-DATA-SAMPLE-001"],
    });
    expect(gate.ok).toBe(false);
  });
});

describe("coalesceImplementationBoardLiveSelectedCodeTaskIdsOverride", () => {
  it("prefers live panel checkbox ids over persist handler ref", () => {
    expect(
      coalesceImplementationBoardLiveSelectedCodeTaskIdsOverride({
        liveCheckedCodeTaskIds: [CANONICAL_SAMPLE_DATA_CODE_TASK_ID],
        boardPersistHandlerRef: [],
      }),
    ).toEqual([CANONICAL_SAMPLE_DATA_CODE_TASK_ID]);
  });

  it("falls back to persist handler ref when live is null", () => {
    expect(
      coalesceImplementationBoardLiveSelectedCodeTaskIdsOverride({
        liveCheckedCodeTaskIds: null,
        boardPersistHandlerRef: [CANONICAL_SAMPLE_DATA_CODE_TASK_ID],
      }),
    ).toEqual([CANONICAL_SAMPLE_DATA_CODE_TASK_ID]);
  });
});

describe("resolveImplementationBoardQuickRunSelection", () => {
  it("uses livePanelSummary selectedRunnableCodeTaskIds when provided", () => {
    const resolved = resolveImplementationBoardQuickRunSelection({
      projectId: "",
      requirementsState: {},
      livePanelSummary: {
        totalCount: 1,
        runnableCount: 1,
        selectedCount: 1,
        selectedRunnableCount: 1,
        selectedRunnableCodeTaskIds: [CANONICAL_SAMPLE_DATA_CODE_TASK_ID],
        integrationReadyCount: 0,
        integrationReadyCodeTaskIds: [],
        incompleteCount: 1,
      },
    });
    expect(resolved.selectedRunnableCodeTaskIds).toEqual([CANONICAL_SAMPLE_DATA_CODE_TASK_ID]);
    expect(resolved.summary?.selectedRunnableCount).toBe(1);
  });
});
