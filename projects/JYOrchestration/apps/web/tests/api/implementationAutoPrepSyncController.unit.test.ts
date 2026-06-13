import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const previewDir = join(__dirname, "../../src/components/preview");

describe("implementation auto prep sync controller wiring", () => {
  it("declares auto prep sync controller responsibility", () => {
    const src = readFileSync(join(previewDir, "useImplementationAutoPrepSyncController.ts"), "utf8");
    expect(src).toContain("Controls one-shot implementation prep auto-refine synchronization");
    expect(src).toContain("run one-shot implementation prep sync when requested");
    expect(src).toContain("avoid running while WIP is active");
  });

  it("uses auto prep sync controller from parent panel hook", () => {
    const parent = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(parent).toContain("useImplementationAutoPrepSyncController");
  });

  it("moves auto prep sync effect out of parent panel hook", () => {
    const parent = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(parent).not.toContain("const autoRefineOnceRef = useRef(false)");
    expect(parent).not.toContain("forceLlm: true");
    expect(parent).not.toContain("forceRefresh: true");
  });
});
