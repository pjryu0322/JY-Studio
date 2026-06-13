import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const previewDir = join(__dirname, "../../src/components/preview");

describe("implementation Quick Run controller wiring", () => {
  it("declares Quick Run controller responsibility", () => {
    const src = readFileSync(join(previewDir, "useImplementationQuickRunController.ts"), "utf8");
    expect(src).toContain("Controls implementation-stage Quick Run client actions");
    expect(src).toContain("start DB runtime job");
    expect(src).toContain("dispatch first CodeTask execution after job start");
  });

  it("uses Quick Run controller from parent implementation hook", () => {
    const src = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(src).toContain("useImplementationQuickRunController");
    expect(src).not.toContain("postImplementationQuickRunStartJob({");
    expect(src).not.toContain("continueImplementationQuickRunAfterStart({");
    expect(src).not.toContain("buildQuickRunOrchestrationAfterJobStart({");
  });

  it("does not call prep/selection helpers directly from parent hook", () => {
    const src = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(src).not.toContain("evaluateImplementationQuickRunPrepAndSelection({");
    expect(src).not.toContain("buildImplementationQuickRunRequirementsPrepPersistPatch({");
  });
});
