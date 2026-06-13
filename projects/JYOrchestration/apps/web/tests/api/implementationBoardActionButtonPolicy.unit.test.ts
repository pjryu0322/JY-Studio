import { describe, expect, it } from "vitest";
import { summarizeCodeTaskBoardRowsFromTreeNodes } from "@/lib/prototype/implementationCodeTaskBoardState";
import { resolveImplementationBoardPrimaryAction } from "@/lib/prototype/implementationActionButtonPolicy";
import { INTEGRATION_BLOCKED_BY_RUNNABLE_USER_MESSAGE } from "@/lib/prototype/implementationBoardIntegrationGate";
import { boardTreeNode } from "./implementationBoardSummaryTestHelpers";

describe("resolveImplementationBoardPrimaryAction routing mirror", () => {
  it("uses routed.enabled for primaryEnabled", () => {
    const nodes = [
      ...Array.from({ length: 14 }, (_, i) =>
        boardTreeNode(`CODE-DONE-${i}`, "완료", "GitHub outcome 저장됨", true),
      ),
      boardTreeNode("CODE-DATA-SAMPLE-001", "대기", "실행 가능", false),
    ];
    const summary = summarizeCodeTaskBoardRowsFromTreeNodes({ nodes, checkedCodeTaskIds: [] });
    const action = resolveImplementationBoardPrimaryAction({ selectionSummary: summary });
    expect(action.primaryAction).toBe("prepare_integration_preview");
    expect(action.primaryEnabled).toBe(false);
    expect(action.primaryDisabledTitle).toBe(INTEGRATION_BLOCKED_BY_RUNNABLE_USER_MESSAGE);
  });

  it("enables primary when integration gate passes", () => {
    const summary = summarizeCodeTaskBoardRowsFromTreeNodes({
      nodes: [boardTreeNode("CODE-DONE-0", "완료", "GitHub outcome 저장됨", true)],
      checkedCodeTaskIds: [],
    });
    const action = resolveImplementationBoardPrimaryAction({ selectionSummary: summary });
    expect(action.primaryEnabled).toBe(true);
    expect(action.primaryDisabledTitle).toBeNull();
  });

  it("honors integrationPrepareEnabled=false debug override", () => {
    const summary = summarizeCodeTaskBoardRowsFromTreeNodes({
      nodes: [boardTreeNode("CODE-DONE-0", "완료", "GitHub outcome 저장됨", true)],
      checkedCodeTaskIds: [],
    });
    const action = resolveImplementationBoardPrimaryAction({
      selectionSummary: summary,
      integrationPrepareEnabled: false,
    });
    expect(action.primaryEnabled).toBe(false);
  });
});
