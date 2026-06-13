import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const previewDir = join(__dirname, "../../src/components/preview");

describe("implementation entry recovery controller wiring", () => {
  it("declares entry recovery controller responsibility", () => {
    const src = readFileSync(join(previewDir, "useImplementationEntryRecoveryController.ts"), "utf8");
    expect(src).toContain("Controls implementation entry recovery for Cursor work items");
    expect(src).toContain("regenerate missing Cursor work items after implementation seed/task-list are ready");
    expect(src).toContain("persist regenerated Cursor work items");
  });

  it("uses entry recovery controller from parent panel hook", () => {
    const parent = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(parent).toContain("useImplementationEntryRecoveryController");
  });

  it("moves entry recovery effect out of parent panel hook", () => {
    const parent = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(parent).not.toContain("buildImplementationEntryCursorWorkItemsRecovery({");
    expect(parent).not.toContain("buildImplementationEntryCursorWorkItemsRegeneratedTimelineEntry({");
    expect(parent).not.toContain("hasImplementationTaskListReady(taskList)");
  });
});
