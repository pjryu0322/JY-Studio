import { describe, expect, it } from "vitest";
import { CANONICAL_SAMPLE_DATA_CODE_TASK_ID } from "@/lib/prototype/codeTaskCanonicalId";
import {
  buildImplementationControlPlaneSnapshot,
  isSameControlPlaneBoardSummary,
  pickEffectiveImplementationControlPlaneSnapshot,
  pickIntegrationPipelineClientBoardSummary,
} from "@/lib/prototype/implementationControlPlaneSnapshot";
import type { ImplementationCodeTaskSelectionSummaryV1 } from "@/lib/prototype/implementationCodeTaskBoardState";
import { boardTreeNode } from "./implementationBoardSummaryTestHelpers";

function minimalSummary(
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

describe("implementation control plane snapshot hydration helpers", () => {
  it("pickEffectiveImplementationControlPlaneSnapshot prefers local over parent", () => {
    const nodes = [boardTreeNode("CODE-DONE-0", "완료", "GitHub outcome 저장됨", true)];
    const local = buildImplementationControlPlaneSnapshot({ projectId: "p1", nodes });
    const parent = buildImplementationControlPlaneSnapshot({
      projectId: "p1",
      selectionSummary: minimalSummary({ totalCount: 99 }),
    });
    expect(pickEffectiveImplementationControlPlaneSnapshot({ local, parent })).toBe(local);
    expect(
      pickEffectiveImplementationControlPlaneSnapshot({ local: null, parent }),
    ).toBe(parent);
    expect(pickEffectiveImplementationControlPlaneSnapshot({ local: null, parent: null })).toBe(null);
  });

  it("isSameControlPlaneBoardSummary compares gate-relevant fields", () => {
    const a = minimalSummary();
    expect(isSameControlPlaneBoardSummary(a, a)).toBe(true);
    expect(isSameControlPlaneBoardSummary(a, { ...a, runnableCount: a.runnableCount + 1 })).toBe(
      false,
    );
    expect(isSameControlPlaneBoardSummary(null, null)).toBe(true);
    expect(isSameControlPlaneBoardSummary(a, null)).toBe(false);
  });

  it("pickIntegrationPipelineClientBoardSummary prefers bridge over parent snapshot", () => {
    const bridgeSummary = minimalSummary({ totalCount: 2 });
    const parentSnapshot = buildImplementationControlPlaneSnapshot({
      projectId: "p1",
      selectionSummary: minimalSummary({ totalCount: 5 }),
    });
    expect(
      pickIntegrationPipelineClientBoardSummary({
        bridgeSummary,
        parentSnapshot,
      }),
    ).toBe(bridgeSummary);
    expect(
      pickIntegrationPipelineClientBoardSummary({
        bridgeSummary: null,
        parentSnapshot,
      })?.totalCount,
    ).toBe(5);
    expect(
      pickIntegrationPipelineClientBoardSummary({
        bridgeSummary: null,
        parentSnapshot: null,
      }),
    ).toBe(null);
  });

  it("local snapshot from nodes aligns selectionSummary with board rows", () => {
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
    expect(snapshot?.board.selectionSummary.selectedRunnableCodeTaskIds).toEqual([sampleId]);
    expect(snapshot?.board.runnableCodeTaskIds).toContain(sampleId);
  });
});
