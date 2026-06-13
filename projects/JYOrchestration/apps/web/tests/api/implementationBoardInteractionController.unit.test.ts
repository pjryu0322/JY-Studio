import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const previewDir = join(__dirname, "../../src/components/preview");

describe("implementation board interaction controller wiring", () => {
  it("declares board interaction controller responsibility", () => {
    const src = readFileSync(
      join(previewDir, "useImplementationBoardInteractionController.ts"),
      "utf8",
    );
    expect(src).toContain("Controls implementation execution-board user interactions");
    expect(src).toContain("restart a board task");
    expect(src).toContain("persist checked CodeTask ids");
  });

  it("moves board interaction handlers out of parent panel hook", () => {
    const parent = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(parent).toContain("useImplementationBoardInteractionController");
    expect(parent).not.toContain("const handleRestartBoardTask = useCallback");
    expect(parent).not.toContain("const handleBoardSelectedTaskIdsChange = useCallback");
    expect(parent).not.toContain("const handleBoardSelectedCodeTaskIdsChange = useCallback");
    expect(parent).not.toContain("const handleImplementationBoardAction = useCallback");
  });
});
