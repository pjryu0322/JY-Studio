import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const previewDir = join(__dirname, "../../src/components/preview");

describe("implementation planning action controller wiring", () => {
  it("declares planning action controller responsibility", () => {
    const src = readFileSync(join(previewDir, "useImplementationPlanningActionController.ts"), "utf8");
    expect(src).toContain("Controls implementation-stage planning, seed, and task-list actions");
  });

  it("uses planning action controller from parent panel hook", () => {
    const parent = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(parent).toContain("useImplementationPlanningActionController");
  });

  it("moves planning action handlers out of parent panel hook", () => {
    const parent = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(parent).not.toContain("const createImplementationSeedFromQuickDesignDraft = useCallback");
    expect(parent).not.toContain("const confirmQuickDesignForImplementation = useCallback");
    expect(parent).not.toContain("const generateImplementationTaskList = useCallback");
    expect(parent).not.toContain("const generateImplementationWorkPlanDraft = useCallback");
    expect(parent).not.toContain("const confirmImplementationTaskPlan = useCallback");
  });
});
