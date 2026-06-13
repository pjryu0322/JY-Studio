import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const previewDir = join(__dirname, "../../src/components/preview");

describe("implementation GitHub verify controller wiring", () => {
  it("declares GitHub verify controller responsibility", () => {
    const src = readFileSync(join(previewDir, "useImplementationGithubVerifyController.ts"), "utf8");
    expect(src).toContain("Controls implementation-stage GitHub verification client actions");
    expect(src).toContain("recover stuck Quick Run GitHub verification");
    expect(src).toContain("recheck a single CodeTask GitHub verification");
  });

  it("uses GitHub verify controller from parent implementation hook", () => {
    const src = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(src).toContain("useImplementationGithubVerifyController");
    expect(src).not.toContain("runQuickRunStuckGithubVerifyRecovery({");
    expect(src).not.toContain("runCodeTaskGithubVerifyRecheck({");
  });

  it("does not import GitHub verify recovery module in parent hook", () => {
    const src = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(src).not.toContain("implementationQuickRunGithubVerifyRecovery");
  });
});
