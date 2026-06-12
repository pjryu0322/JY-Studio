import { describe, expect, it } from "vitest";
import { evaluateIntegrationPrepareGateFromBoardSummary } from "@/lib/prototype/implementationBoardIntegrationGate";
import { buildImplementationIntegrationPipelineEligibilityFromSnapshot } from "@/lib/prototype/projectIntegrationPipelineEligibility";
import { boardTreeNode } from "./implementationBoardSummaryTestHelpers";
import {
  resolveCodeTaskBoardState,
  summarizeCodeTaskBoardRowsFromTreeNodes,
} from "@/lib/prototype/implementationCodeTaskBoardState";
import type { ImplementationRuntimeSnapshotV1 } from "@/lib/prototype/implementationRuntimeSnapshot";

function minimalSnapshot(input: {
  readonly selected?: number;
  readonly completed?: number;
}): ImplementationRuntimeSnapshotV1 {
  return {
    projectId: "p1",
    codeTask: {
      total: 15,
      selected: input.selected ?? 1,
      completed: input.completed ?? 0,
      failed: 0,
      inconsistent: 0,
      pendingCodeTaskIds: ["CODE-DATA-SAMPLE-001"],
      inconsistentCodeTaskIds: [],
    },
    integration: {
      finalWiringStatus: "ready",
      integrationBranchStatus: "pending",
      buildStatus: "pending",
      appPreviewTargetStatus: "pending",
      nextRequiredStep: "final_wiring",
      disabledReason: null,
    },
    preview: {
      integratedAppPreviewReady: false,
      codeTaskPreviewReady: false,
      readinessStatus: "codetask_completion_pending",
      message: "",
      previewUrl: null,
    },
    units: [],
  } as ImplementationRuntimeSnapshotV1;
}

describe("integration board gate vs pipeline eligibility", () => {
  it("allows integration when board summary shows 15 integration-ready and 0 runnable", () => {
    const nodes = Array.from({ length: 15 }, (_, i) =>
      boardTreeNode(`CT-${i + 1}`, "완료", "GitHub outcome 저장됨", true),
    );
    const boardSummary = summarizeCodeTaskBoardRowsFromTreeNodes({
      nodes,
      checkedCodeTaskIds: [],
    });
    expect(boardSummary.runnableCount).toBe(0);
    expect(boardSummary.integrationReadyCount).toBe(15);

    const gate = evaluateIntegrationPrepareGateFromBoardSummary(boardSummary);
    expect(gate.ok).toBe(true);
    expect(gate.resolvedAction).toBe("prepare_integration_preview");
    expect(gate.blockedCodeTaskIds).toEqual([]);

    const eligibility = buildImplementationIntegrationPipelineEligibilityFromSnapshot(
      minimalSnapshot({ selected: 1, completed: 0 }),
      { boardGateSummary: boardSummary },
    );
    expect(eligibility.canRun).toBe(true);
    expect(eligibility.userMessage).not.toContain("미완료 또는 검증 대기");
  });

  it("blocks integration when only 14 of 15 are integration-ready", () => {
    const nodes = [
      ...Array.from({ length: 14 }, (_, i) =>
        boardTreeNode(`CT-${i + 1}`, "완료", "GitHub outcome 저장됨", true),
      ),
      {
        codeTaskId: "CT-15",
        boardState: resolveCodeTaskBoardState({
          codeTaskId: "CT-15",
          title: "CT-15",
          statusLabel: "GitHub 확인 중",
          progressLabel: "검증 중",
          githubOutcomeSaved: false,
          runIntegrationReady: false,
        }),
      },
    ];
    const boardSummary = summarizeCodeTaskBoardRowsFromTreeNodes({
      nodes,
      checkedCodeTaskIds: [],
    });
    expect(boardSummary.integrationReadyCount).toBe(14);
    expect(boardSummary.totalCount).toBe(15);

    const gate = evaluateIntegrationPrepareGateFromBoardSummary(boardSummary);
    expect(gate.ok).toBe(false);
    expect(gate.message).toContain("모든 CodeTask");
  });
});
