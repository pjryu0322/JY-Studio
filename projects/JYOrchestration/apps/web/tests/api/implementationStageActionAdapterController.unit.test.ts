import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const previewDir = join(__dirname, "../../src/components/preview");

describe("implementation stage action adapter controller wiring", () => {
  it("declares stage action adapter controller responsibility", () => {
    const src = readFileSync(
      join(previewDir, "useImplementationStageActionAdapterController.ts"),
      "utf8",
    );
    expect(src).toContain("Controls implementation-stage action adapter wiring");
    expect(src).toContain("build legacy stage action dispatch bundle");
    expect(src).toContain("adapt stage Preview action to integrated app Preview open");
  });

  it("uses stage action adapter controller from parent panel hook", () => {
    const parent = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(parent).toContain("useImplementationStageActionAdapterController");
  });

  it("moves stage action adapter wiring out of parent panel hook", () => {
    const parent = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(parent).not.toContain("const legacyDispatch = useImplementationStageActionLegacyDispatchBundle");
    expect(parent).not.toContain("const executeCodeTasks = useCallback");
    expect(parent).not.toContain("const openPreviewFromStageAction = useCallback");
    expect(parent).not.toContain("runImplementationStageActionRef.current = runImplementationStageAction");
  });
});
