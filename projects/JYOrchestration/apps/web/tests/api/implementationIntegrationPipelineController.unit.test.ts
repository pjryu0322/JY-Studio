import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  pickIntegrationPipelineClientBoardSummary,
  buildImplementationControlPlaneSnapshot,
} from "@/lib/prototype/implementationControlPlaneSnapshot";
import type { ImplementationCodeTaskSelectionSummaryV1 } from "@/lib/prototype/implementationCodeTaskBoardState";

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

describe("implementation integration pipeline controller helpers", () => {
  it("pickIntegrationPipelineClientBoardSummary prefers bridge summary", () => {
    const bridgeSummary = minimalSummary({ totalCount: 2 });
    const parentSnapshot = buildImplementationControlPlaneSnapshot({
      projectId: "p1",
      selectionSummary: minimalSummary({ totalCount: 5 }),
    });
    expect(
      pickIntegrationPipelineClientBoardSummary({ bridgeSummary, parentSnapshot }),
    ).toBe(bridgeSummary);
  });

  it("pickIntegrationPipelineClientBoardSummary falls back to parent snapshot", () => {
    const parentSnapshot = buildImplementationControlPlaneSnapshot({
      projectId: "p1",
      selectionSummary: minimalSummary({ totalCount: 5 }),
    });
    expect(
      pickIntegrationPipelineClientBoardSummary({
        bridgeSummary: null,
        parentSnapshot,
      }),
    ).toBe(parentSnapshot?.board.selectionSummary);
  });

  it("pickIntegrationPipelineClientBoardSummary returns null when both missing", () => {
    expect(
      pickIntegrationPipelineClientBoardSummary({
        bridgeSummary: null,
        parentSnapshot: null,
      }),
    ).toBeNull();
  });
});

describe("usePrototypeImplementationStagePanel integration controller wiring", () => {
  it("imports useImplementationIntegrationPipelineController", () => {
    const src = readFileSync(
      join(__dirname, "../../src/components/preview/usePrototypeImplementationStagePanel.tsx"),
      "utf8",
    );
    expect(src).toContain("useImplementationIntegrationPipelineController");
    expect(src).not.toContain("executeImplementationBoardIntegrationPipeline");
  });
});
