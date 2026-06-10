import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { evaluateImplementationPreviewEntryState } from "@/lib/prototype/implementationPreviewEntryPolicy";
import type { ImplementationRuntimeSnapshotV1 } from "@/lib/prototype/implementationRuntimeSnapshot";

describe("DiagnosticVsActualPreviewSeparation", () => {
  it("diagnostic entry still available via entry policy", () => {
    const snapshot = {
      projectId: "p1",
      codeTask: {
        total: 1,
        selected: 1,
        completed: 1,
        running: 0,
        verifying: 0,
        failed: 0,
        skipped: 0,
        pending: 0,
        inconsistent: 0,
        currentUnitId: null,
        currentCodeTaskId: null,
        selectedUnitIds: [],
        pendingCodeTaskIds: [],
        inconsistentCodeTaskIds: [],
      },
      units: [],
      integration: {} as ImplementationRuntimeSnapshotV1["integration"],
      preview: {
        integratedAppPreviewReady: false,
        codeTaskPreviewReady: true,
        previewUrl: null,
        previewReady: false,
      },
      pipeline: { status: null, previewReady: false },
      warnings: [],
    } as ImplementationRuntimeSnapshotV1;
    const entry = evaluateImplementationPreviewEntryState({
      projectId: "p1",
      snapshot,
      codeTaskPreviewReady: true,
      integratedAppPreviewReady: false,
    });
    expect(entry.mode).toBe("codetask_result_preview");
    expect(entry.url).toContain("scope=latest");
  });

  it("15-17. integration board user strings avoid gh-pages and integration branch", () => {
    const board = readFileSync(
      join(__dirname, "../../src/components/preview/ImplementationExecutionBoardPanel.tsx"),
      "utf8",
    );
    const remediation = readFileSync(
      join(__dirname, "../../src/lib/prototype/integrationPreviewRemediationGuide.ts"),
      "utf8",
    );
    expect(board.toLowerCase()).not.toContain("gh-pages");
    expect(remediation.toLowerCase()).not.toContain("gh-pages");
    expect(board).not.toMatch(/integration\/cmph/);
  });
});
