import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const previewDir = join(__dirname, "../../src/components/preview");

describe("implementation stage action legacy dispatch bundle wiring", () => {
  it("declares legacy dispatch bundle responsibility", () => {
    const src = readFileSync(
      join(previewDir, "useImplementationStageActionLegacyDispatchBundle.ts"),
      "utf8",
    );
    expect(src).toContain("Builds the legacy implementation-stage action dispatch bundle");
    expect(src).toContain("compose simple/review/execution legacy dispatch inputs");
  });

  it("removes legacy dispatch input composition from parent hook", () => {
    const parent = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(parent).toContain("useImplementationStageActionLegacyDispatchBundle");
    expect(parent).not.toContain("const implementationStageActionLegacyDispatchInput = useMemo");
    expect(parent).not.toContain("useImplementationStageActionLegacyDispatch(");
  });
});
