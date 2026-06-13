import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const previewDir = join(__dirname, "../../src/components/preview");

describe("implementation stage action controller wiring", () => {
  it("declares Stage Action controller responsibility", () => {
    const src = readFileSync(join(previewDir, "useImplementationStageActionController.ts"), "utf8");
    expect(src).toContain("Controls implementation-stage user/action dispatch");
    expect(src).toContain("route implementation stage actions to the correct controller");
  });

  it("uses Stage Action controller from parent implementation hook", () => {
    const src = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(src).toContain("useImplementationStageActionController");
    expect(src).not.toContain("dispatchSimpleImplementationStageAction(");
    expect(src).not.toContain("dispatchExecutionStageAction(");
  });

  it("does not keep large action dispatch switch in parent hook", () => {
    const src = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(src).not.toContain('case "START_QUICK_IMPLEMENTATION":');
    expect(src).not.toContain('case "VERIFY_TASK_CURSOR_GITHUB":');
    expect(src).not.toContain('case "PREPARE_INTEGRATION_PREVIEW":');
    expect(src).not.toContain('case "OPEN_PREVIEW":');
    expect(src).not.toContain('action === "START_QUICK_IMPLEMENTATION"');
    expect(src).not.toContain('action === "VERIFY_TASK_CURSOR_GITHUB"');
  });

  it("routes control plane actions inside stage action controller", () => {
    const src = readFileSync(join(previewDir, "useImplementationStageActionController.ts"), "utf8");
    expect(src).toContain("routeImplementationStageControlPlaneAction");
    expect(src).toContain("executeCodeTasks");
    expect(src).toContain("runIntegrationPipeline");
  });
});
