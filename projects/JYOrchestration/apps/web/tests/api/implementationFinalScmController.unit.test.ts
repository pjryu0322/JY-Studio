import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const previewDir = join(__dirname, "../../src/components/preview");

describe("implementation final SCM controller wiring", () => {
  it("declares Final SCM controller responsibility", () => {
    const src = readFileSync(join(previewDir, "useImplementationFinalScmController.ts"), "utf8");
    expect(src).toContain("Controls implementation-stage Final SCM and platform SCM actions");
    expect(src).toContain("execute platform SCM push/PR step");
    expect(src).toContain("finalize integrated final SCM stage");
  });

  it("uses Final SCM controller from parent panel hook", () => {
    const parent = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(parent).toContain("useImplementationFinalScmController");
  });

  it("moves Final SCM handlers out of parent panel hook", () => {
    const parent = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(parent).toContain("useImplementationFinalScmController");
    expect(parent).not.toContain("const applyPlatformScmExecutorJson = useCallback");
    expect(parent).not.toContain("const runFinalScmIntegratedStageStep = useCallback");
    expect(parent).not.toContain("const runPlatformScmMergeStep = useCallback");
    expect(parent).not.toContain("fetchPlatformScmExecutePersistPatch({");
    expect(parent).not.toContain("fetchPlatformScmMergePersistPatch({");
  });
});
