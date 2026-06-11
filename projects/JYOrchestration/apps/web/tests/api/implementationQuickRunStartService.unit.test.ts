import { describe, expect, it } from "vitest";
import { CANONICAL_SAMPLE_DATA_CODE_TASK_ID } from "@/lib/prototype/codeTaskCanonicalId";
import { resolveCodeTaskDispatchTarget } from "@/lib/prototype/codeTaskExecutionQueueDispatch";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import {
  ensureRequirementsStateCursorWorkItemsForCodeTaskPlan,
  evaluateImplementationQuickRunPrepAndSelection,
} from "@/lib/prototype/implementationQuickRunStartService";

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
        liveRunnableCodeTaskIds: [sampleId],
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
    expect(result.ok).toBe(false);
    if (!result.ok && result.kind === "no_runnable_selection") {
      expect(result.phase).toBe("toolbar_blocked_no_selection");
      expect(result.message).toBe("실행할 CodeTask를 선택해 주세요.");
    }
  });
});

describe("ensureRequirementsStateCursorWorkItemsForCodeTaskPlan", () => {
  it("creates dispatch target for sample CodeTask when work items were stale", () => {
    const plan: ImplementationCodeTaskPlanV1 = {
      version: 1,
      projectId: "p1",
      parentTaskCount: 1,
      codeTaskCount: 1,
      tasks: [
        {
          codeTaskId: sampleId,
          parentTaskId: "TASK-DATA",
          title: "Sample data",
          description: "desc",
          changeType: "data",
          status: "ready",
          targetHints: ["apps/web"],
          acceptanceCriteria: ["ok"],
          verificationHints: ["pnpm test"],
          forbiddenPaths: ["node_modules"],
        },
      ],
    };
    const ensured = ensureRequirementsStateCursorWorkItemsForCodeTaskPlan({
      projectId: "p1",
      requirementsState: {
        implementationCodeTaskPlanV1: plan,
        cursorWorkItemsV1: [],
      },
    });
    expect(ensured.appendedCodeTaskIds).toEqual([sampleId]);
    const target = resolveCodeTaskDispatchTarget({
      codeTaskId: sampleId,
      codeTaskPlan: plan,
      cursorWorkItems: ensured.requirementsState.cursorWorkItemsV1,
    });
    expect(target?.workItem.codeTaskId).toBe(sampleId);
  });
});
