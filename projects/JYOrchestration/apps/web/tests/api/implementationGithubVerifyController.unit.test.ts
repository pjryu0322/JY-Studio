import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const previewDir = join(__dirname, "../../src/components/preview");

describe("usePrototypeImplementationStagePanel GitHub verify controller wiring", () => {
  it("imports useImplementationGithubVerifyController", () => {
    const src = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(src).toContain("useImplementationGithubVerifyController");
    expect(src).not.toContain("runQuickRunStuckGithubVerifyRecovery({");
    expect(src).not.toContain("runCodeTaskGithubVerifyRecheck({");
  });
});

describe("useImplementationGithubVerifyController", () => {
  it("declares GitHub verify controller responsibility", () => {
    const src = readFileSync(join(previewDir, "useImplementationGithubVerifyController.ts"), "utf8");
    expect(src).toContain("Controls implementation-stage GitHub verification client actions");
    expect(src).toContain("recover stuck Quick Run GitHub verification");
  });
});
