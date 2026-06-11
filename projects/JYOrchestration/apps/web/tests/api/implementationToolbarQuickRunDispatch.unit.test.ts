import { describe, expect, it } from "vitest";
import { CANONICAL_SAMPLE_DATA_CODE_TASK_ID } from "@/lib/prototype/codeTaskCanonicalId";
import { evaluateImplementationToolbarQuickRun } from "@/lib/prototype/implementationToolbarQuickRunDispatch";

const sampleId = CANONICAL_SAMPLE_DATA_CODE_TASK_ID;

describe("evaluateImplementationToolbarQuickRun", () => {
  it("executes when live panel summary has selected runnable ids", () => {
    const evalResult = evaluateImplementationToolbarQuickRun({
      projectId: "p1",
      requirementsState: {},
      boardTaskRowCount: 15,
      bridge: {
        liveCheckedCodeTaskIds: [sampleId],
        boardPersistSelection: [],
        liveRunnableCodeTaskIds: [sampleId],
        livePanelSummary: {
          totalCount: 15,
          runnableCount: 1,
          selectedRunnableCount: 1,
          selectedRunnableCodeTaskIds: [sampleId],
          integrationReadyCount: 14,
          integrationReadyCodeTaskIds: ["CODE-DONE-0"],
        },
      },
    });
    expect(evalResult.outcome).toBe("execute_selected_runnable_codetasks");
    if (evalResult.outcome === "execute_selected_runnable_codetasks") {
      expect(evalResult.codeTaskIds).toEqual([sampleId]);
      expect(evalResult.selectedRunnableCount).toBe(1);
      expect(evalResult.traceDetail).toContain("checkedCodeTaskIds=");
    }
  });

  it("blocks when runnable remain but none selected in summary", () => {
    const evalResult = evaluateImplementationToolbarQuickRun({
      projectId: "p1",
      requirementsState: {},
      boardTaskRowCount: 15,
      bridge: {
        liveCheckedCodeTaskIds: [],
        boardPersistSelection: [],
        liveRunnableCodeTaskIds: [sampleId],
        livePanelSummary: {
          totalCount: 15,
          runnableCount: 1,
          selectedRunnableCount: 0,
          selectedRunnableCodeTaskIds: [],
          integrationReadyCount: 14,
          integrationReadyCodeTaskIds: [],
        },
      },
    });
    expect(evalResult.outcome).toBe("blocked");
  });
});
