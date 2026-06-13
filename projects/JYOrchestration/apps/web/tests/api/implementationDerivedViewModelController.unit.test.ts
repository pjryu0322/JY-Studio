import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const previewDir = join(__dirname, "../../src/components/preview");

describe("implementation derived view model controller wiring", () => {
  it("declares derived view model controller responsibility", () => {
    const src = readFileSync(
      join(previewDir, "useImplementationDerivedViewModelController.ts"),
      "utf8",
    );
    expect(src).toContain("Builds implementation-stage derived view models");
  });

  it("uses derived view model controller from parent panel hook", () => {
    const parent = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(parent).toContain("useImplementationDerivedViewModelController");
  });

  it("moves major derived view-model useMemo blocks out of parent panel hook", () => {
    const parent = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(parent).not.toContain("const implementationBootstrapInput = useMemo");
    expect(parent).not.toContain("const implementationStageBoardInput = useMemo");
    expect(parent).not.toContain("const implementationBootstrapShell = useMemo");
    expect(parent).not.toContain("const implementationVisibleActionLabels = useMemo");
  });
});
