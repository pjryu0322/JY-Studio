import { describe, expect, it } from "vitest";
import { CANONICAL_SAMPLE_DATA_CODE_TASK_ID } from "@/lib/prototype/codeTaskCanonicalId";
import { INTEGRATION_WIRING_CODE_TASK_ID } from "@/lib/prototype/codeTaskIntegrationWiringTask";
import {
  buildImplementationControlPlaneSnapshot,
  isSameControlPlaneBoardSummary,
  pickEffectiveImplementationControlPlaneSnapshot,
  pickIntegrationPipelineClientBoardSummary,
} from "@/lib/prototype/implementationControlPlaneSnapshot";
import {
  resolveTotalExecutableCodeTaskCountFromSelectionSummary,
  summarizeCodeTaskBoardRowsFromTreeNodes,
  type ImplementationCodeTaskSelectionSummaryV1,
} from "@/lib/prototype/implementationCodeTaskBoardState";
import { INTEGRATION_BLOCKED_BY_RUNNABLE_USER_MESSAGE } from "@/lib/prototype/implementationBoardIntegrationGate";
import { boardTreeNode } from "./implementationBoardSummaryTestHelpers";

describe("buildImplementationControlPlaneSnapshot", () => {
  it("builds snapshot from board nodes and routes selected runnable first", () => {
    const sampleId = CANONICAL_SAMPLE_DATA_CODE_TASK_ID;
    const nodes = [
      boardTreeNode("CODE-DONE-0", "완료", "GitHub outcome 저장됨", true),
      boardTreeNode(sampleId, "대기", "실행 가능", false),
    ];
    const snapshot = buildImplementationControlPlaneSnapshot({
      projectId: "p1",
      nodes,
      checkedCodeTaskIds: [sampleId],
    });
    expect(snapshot?.action.primaryAction).toBe("execute_selected_runnable_codetasks");
    expect(snapshot?.action.enabled).toBe(true);
    expect(snapshot?.action.codeTaskIds).toEqual([sampleId]);
    expect(snapshot?.board.selectedRunnableCodeTaskIds).toEqual([sampleId]);
  });

  it("blocks integration when runnable tasks remain", () => {
    const nodes = [
      ...Array.from({ length: 14 }, (_, i) =>
        boardTreeNode(`CODE-DONE-${i}`, "완료", "GitHub outcome 저장됨", true),
      ),
      boardTreeNode(CANONICAL_SAMPLE_DATA_CODE_TASK_ID, "대기", "실행 가능", false),
    ];
    const snapshot = buildImplementationControlPlaneSnapshot({
      projectId: "p1",
      nodes,
      checkedCodeTaskIds: [],
    });
    expect(snapshot?.action.primaryAction).toBe("prepare_integration_preview");
    expect(snapshot?.action.enabled).toBe(false);
    expect(snapshot?.action.disabledReason).toBe(INTEGRATION_BLOCKED_BY_RUNNABLE_USER_MESSAGE);
    expect(snapshot?.boardFooter.primaryEnabled).toBe(false);
  });

  it("enables integration only when all executable tasks are integration-ready", () => {
    const nodes = [boardTreeNode("CODE-DONE-0", "완료", "GitHub outcome 저장됨", true)];
    const snapshot = buildImplementationControlPlaneSnapshot({
      projectId: "p1",
      nodes,
      checkedCodeTaskIds: [],
    });
    expect(snapshot?.integration.enabled).toBe(true);
    expect(snapshot?.action.enabled).toBe(true);
    expect(snapshot?.integration.targetCodeTaskIds).toEqual(["CODE-DONE-0"]);
  });

  it("opens preview when previewReady and actualPreviewUrl exist", () => {
    const nodes = [boardTreeNode("CODE-DONE-0", "완료", "GitHub outcome 저장됨", true)];
    const snapshot = buildImplementationControlPlaneSnapshot({
      projectId: "p1",
      nodes,
      previewReady: true,
      actualPreviewUrl: "https://preview.test/app",
    });
    expect(snapshot?.action.primaryAction).toBe("open_preview");
    expect(snapshot?.preview.ready).toBe(true);
  });

  it("excludes integration wiring task from executable total", () => {
    const nodes = [
      boardTreeNode("CODE-DONE-0", "완료", "GitHub outcome 저장됨", true),
      boardTreeNode(INTEGRATION_WIRING_CODE_TASK_ID, "완료", "GitHub outcome 저장됨", true),
    ];
    const summary = summarizeCodeTaskBoardRowsFromTreeNodes({ nodes, checkedCodeTaskIds: [] });
    const snapshot = buildImplementationControlPlaneSnapshot({ projectId: "p1", nodes });
    expect(summary.totalCount).toBe(1);
    expect(snapshot?.board.totalExecutableCodeTaskCount).toBe(1);
    expect(resolveTotalExecutableCodeTaskCountFromSelectionSummary(summary)).toBe(1);
  });

  it("keeps 15 executable tasks when integration wiring row is present", () => {
    const nodes = [
      ...Array.from({ length: 15 }, (_, i) =>
        boardTreeNode(`CODE-DONE-${i}`, "완료", "GitHub outcome 저장됨", true),
      ),
      boardTreeNode(INTEGRATION_WIRING_CODE_TASK_ID, "완료", "GitHub outcome 저장됨", true),
    ];
    const snapshot = buildImplementationControlPlaneSnapshot({ projectId: "p1", nodes });
    expect(snapshot?.board.totalExecutableCodeTaskCount).toBe(15);
    expect(snapshot?.board.runnableCodeTaskIds).not.toContain(INTEGRATION_WIRING_CODE_TASK_ID);
    expect(snapshot?.meta.source).toBe("implementation_control_plane_snapshot_v1");
  });

  it("derives boardFooter showIntegrationPrepareButton from executable count and preview", () => {
    const nodes = [boardTreeNode("CODE-DONE-0", "완료", "GitHub outcome 저장됨", true)];
    const snapshot = buildImplementationControlPlaneSnapshot({
      projectId: "p1",
      nodes,
      previewReady: false,
    });
    expect(snapshot?.boardFooter.showIntegrationPrepareButton).toBe(true);
    expect(snapshot?.boardFooter.primaryEnabled).toBe(snapshot?.action.enabled);
  });
});

function minimalSelectionSummary(
  overrides: Partial<ImplementationCodeTaskSelectionSummaryV1> = {},
): ImplementationCodeTaskSelectionSummaryV1 {
  return {
    totalCount: 1,
    runnableCount: 0,
    integrationReadyCount: 1,
    selectedRunnableCount: 0,
    integrationReadyCodeTaskIds: ["CODE-DONE-0"],
    selectedRunnableCodeTaskIds: [],
    ...overrides,
  };
}

describe("implementation control plane snapshot helpers", () => {
  it("prefers local snapshot over parent snapshot", () => {
    const nodes = [boardTreeNode("CODE-DONE-0", "완료", "GitHub outcome 저장됨", true)];
    const local = buildImplementationControlPlaneSnapshot({ projectId: "p1", nodes });
    const parent = buildImplementationControlPlaneSnapshot({
      projectId: "p1",
      selectionSummary: minimalSelectionSummary({ totalCount: 99 }),
    });
    expect(pickEffectiveImplementationControlPlaneSnapshot({ local, parent })).toBe(local);
    expect(pickEffectiveImplementationControlPlaneSnapshot({ local: null, parent })).toBe(parent);
    expect(
      pickEffectiveImplementationControlPlaneSnapshot({ local: null, parent: null }),
    ).toBeNull();
  });

  it("compares control plane board summaries", () => {
    const summary = minimalSelectionSummary();
    expect(isSameControlPlaneBoardSummary(summary, summary)).toBe(true);
    expect(
      isSameControlPlaneBoardSummary(summary, {
        ...summary,
        runnableCount: summary.runnableCount + 1,
      }),
    ).toBe(false);
  });

  it("pickIntegrationPipelineClientBoardSummary prefers bridge over parent snapshot", () => {
    const bridgeSummary = minimalSelectionSummary({ totalCount: 2 });
    const parentSnapshot = buildImplementationControlPlaneSnapshot({
      projectId: "p1",
      selectionSummary: minimalSelectionSummary({ totalCount: 5 }),
    });
    expect(
      pickIntegrationPipelineClientBoardSummary({ bridgeSummary, parentSnapshot }),
    ).toBe(bridgeSummary);
    expect(
      pickIntegrationPipelineClientBoardSummary({ bridgeSummary: null, parentSnapshot })
        ?.totalCount,
    ).toBe(5);
  });
});
