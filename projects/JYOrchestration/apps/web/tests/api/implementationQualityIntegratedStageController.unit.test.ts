import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const previewDir = join(__dirname, "../../src/components/preview");

describe("implementation quality/integrated-stage controller wiring", () => {
  it("declares quality/integrated-stage controller responsibility", () => {
    const src = readFileSync(
      join(previewDir, "useImplementationQualityIntegratedStageController.ts"),
      "utf8",
    );
    expect(src).toContain("Controls implementation-stage quality gates and non-Final-SCM integrated steps");
    expect(src).toContain("run reviewer/security quality gate checks");
    expect(src).toContain("run integrated stage steps except Final SCM");
  });

  it("uses quality/integrated-stage controller from parent panel hook", () => {
    const parent = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(parent).toContain("useImplementationQualityIntegratedStageController");
  });

  it("moves quality/integrated stage handlers out of parent panel hook", () => {
    const parent = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(parent).not.toContain("const runImplementationQualityGate = useCallback");
    expect(parent).not.toContain("const runIntegratedStageStep = useCallback");
    expect(parent).not.toContain("executeImplementationQualityGateCheck({");
    expect(parent).not.toContain("integrateCompletedCodeTasksForPreview({");
  });
});
