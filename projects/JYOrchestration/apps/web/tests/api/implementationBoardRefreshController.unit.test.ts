import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const previewDir = join(__dirname, "../../src/components/preview");

describe("implementation board refresh controller wiring", () => {
  it("declares board refresh controller responsibility", () => {
    const src = readFileSync(
      join(previewDir, "useImplementationBoardRefreshController.ts"),
      "utf8",
    );
    expect(src).toContain("Controls implementation execution-board refresh synchronization");
    expect(src).toContain("refresh board sync key after execution setup changes");
    expect(src).toContain("run initial board refresh when execution setup is loaded");
  });

  it("uses board refresh controller from parent panel hook", () => {
    const parent = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(parent).toContain("useImplementationBoardRefreshController");
  });

  it("moves board refresh handlers out of parent panel hook", () => {
    const parent = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(parent).not.toContain("const refreshImplementationBoardWithExecutionSetup = useCallback");
    expect(parent).not.toContain(
      "refreshImplementationBoardRef.current = refreshImplementationBoardWithExecutionSetup",
    );
    expect(parent).not.toContain("const handleExecutionSetupChanged = useCallback");
    expect(parent).not.toContain("buildImplementationBoardRefreshSyncKey({");
  });
});
