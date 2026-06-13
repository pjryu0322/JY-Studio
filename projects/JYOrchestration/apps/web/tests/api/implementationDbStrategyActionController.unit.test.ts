import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const previewDir = join(__dirname, "../../src/components/preview");

describe("implementation DB strategy action controller wiring", () => {
  it("declares DB strategy action controller responsibility", () => {
    const src = readFileSync(join(previewDir, "useImplementationDbStrategyActionController.ts"), "utf8");
    expect(src).toContain("Controls implementation-stage DB strategy actions");
  });

  it("uses DB strategy action controller from parent panel hook", () => {
    const parent = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(parent).toContain("useImplementationDbStrategyActionController");
  });

  it("moves DB strategy handlers out of parent panel hook", () => {
    const parent = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(parent).not.toContain("const applyDbStrategyResult = useCallback");
    expect(parent).not.toContain("const reviewDbIntegrationNeed = useCallback");
    expect(parent).not.toContain("const generateDataModelDraft = useCallback");
    expect(parent).not.toContain("const confirmMockImplementationMode = useCallback");
  });
});
