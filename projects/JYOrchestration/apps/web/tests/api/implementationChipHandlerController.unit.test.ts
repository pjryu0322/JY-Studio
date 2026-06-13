import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const previewDir = join(__dirname, "../../src/components/preview");

describe("implementation chip handler controller wiring", () => {
  it("declares chip handler controller responsibility", () => {
    const src = readFileSync(join(previewDir, "useImplementationChipHandlerController.ts"), "utf8");
    expect(src).toContain("Controls implementation-stage chip/interview label handling");
    expect(src).toContain("map implementation chips to stage actions");
  });

  it("moves chip handlers out of parent panel hook", () => {
    const parent = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(parent).toContain("useImplementationChipHandlerController");
    expect(parent).not.toContain("const handleImplementationChip = useCallback");
    expect(parent).not.toContain("const onPickImplementationInterviewLabel = useCallback");
  });
});
