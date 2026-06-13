import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const previewDir = join(__dirname, "../../src/components/preview");

describe("implementation WIP chip handler controller wiring", () => {
  it("declares WIP chip handler controller responsibility", () => {
    const src = readFileSync(join(previewDir, "useImplementationWipChipHandlerController.ts"), "utf8");
    expect(src).toContain("Controls implementation-stage WIP chip handler wiring");
    expect(src).toContain("build WIP chip handler slice");
    expect(src).toContain("connect platform SCM post-commit callback");
  });

  it("uses WIP chip handler controller from parent panel hook", () => {
    const parent = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(parent).toContain("useImplementationWipChipHandlerController");
  });

  it("moves WIP chip handler wiring out of parent panel hook", () => {
    const parent = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(parent).not.toContain("const wipChipHandlers = useMemo");
    expect(parent).not.toContain("buildWipChipHandlerSlice({");
    expect(parent).not.toContain("evaluateCursorExecutionAvailability({ setup: executionSetupRow }).ready");
  });
});
