import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const previewDir = join(__dirname, "../../src/components/preview");

describe("implementation preview controller wiring", () => {
  it("declares Preview controller responsibility", () => {
    const src = readFileSync(join(previewDir, "useImplementationPreviewController.ts"), "utf8");
    expect(src).toContain("Controls implementation-stage Preview entry actions");
    expect(src).toContain("open integrated app Preview");
    expect(src).toContain("run completed CodeTask preview fallback when needed");
  });

  it("moves Preview handlers out of parent panel hook", () => {
    const parent = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(parent).toContain("useImplementationPreviewController");
    expect(parent).not.toContain("const openImplementationPreview = useCallback");
    expect(parent).not.toContain("const mergeIntegrationPullRequest = useCallback");
    expect(parent).not.toContain("setIntegrationMergeBusy(true)");
  });
});
