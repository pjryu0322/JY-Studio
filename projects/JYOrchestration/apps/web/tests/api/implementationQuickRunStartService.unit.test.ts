import { describe, expect, it } from "vitest";
import { CANONICAL_SAMPLE_DATA_CODE_TASK_ID } from "@/lib/prototype/codeTaskCanonicalId";
import { evaluateImplementationQuickRunPrepAndSelection } from "@/lib/prototype/implementationQuickRunStartService";

const sampleId = CANONICAL_SAMPLE_DATA_CODE_TASK_ID;

describe("evaluateImplementationQuickRunPrepAndSelection", () => {
  it("returns runnable ids when live panel summary has selected runnable", () => {
    const result = evaluateImplementationQuickRunPrepAndSelection({
      projectId: "p1",
      requirementsState: {},
      selectedCodeTaskIdsOverride: [sampleId],
      bridge: {
        liveCheckedCodeTaskIds: [sampleId],
        boardPersistSelection: [],
        livePanelSummary: {
          totalCount: 15,
          runnableCount: 1,
          selectedRunnableCount: 1,
          selectedRunnableCodeTaskIds: [sampleId],
          integrationReadyCount: 14,
          integrationReadyCodeTaskIds: [],
        },
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.selectedRunnableCodeTaskIds).toEqual([sampleId]);
    }
  });

  it("blocks with toolbar message when nothing runnable is selected", () => {
    const result = evaluateImplementationQuickRunPrepAndSelection({
      projectId: "p1",
      requirementsState: {},
      bridge: {
        liveCheckedCodeTaskIds: [],
        boardPersistSelection: [],
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
    expect(result.ok).toBe(false);
    if (!result.ok && result.kind === "no_runnable_selection") {
      expect(result.phase).toBe("toolbar_blocked_no_selection");
      expect(result.message).toBe("실행할 CodeTask를 선택해 주세요.");
    }
  });
});
