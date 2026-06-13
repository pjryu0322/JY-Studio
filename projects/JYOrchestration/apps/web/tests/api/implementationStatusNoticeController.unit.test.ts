import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const previewDir = join(__dirname, "../../src/components/preview");

describe("implementation status notice controller wiring", () => {
  it("declares status notice controller responsibility", () => {
    const src = readFileSync(join(previewDir, "useImplementationStatusNoticeController.ts"), "utf8");
    expect(src).toContain("Controls implementation-stage status and notice actions");
  });

  it("uses status notice controller from parent panel hook", () => {
    const parent = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(parent).toContain("useImplementationStatusNoticeController");
  });

  it("moves status notice handlers out of parent panel hook", () => {
    const parent = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(parent).not.toContain("const appendImplementationTaskListAiMessage = useCallback");
    expect(parent).not.toContain("const appendStatusQueryFromChip = useCallback");
    expect(parent).not.toContain("const showRoleCheckDetails = useCallback");
    expect(parent).not.toContain("const showImplementationSeedReadinessCheck = useCallback");
  });
});
