import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const previewDir = join(__dirname, "../../src/components/preview");

describe("implementation stage action orchestrator wiring", () => {
  it("declares stage action orchestrator responsibility", () => {
    const src = readFileSync(join(previewDir, "useImplementationStageActionOrchestrator.ts"), "utf8");
    expect(src).toContain("Orchestrates implementation-stage action clicks");
    expect(src).toContain("persist stage action click timeline entries");
    expect(src).toContain("persist ImplementationStageActionRun result");
  });

  it("moves action orchestration out of parent panel hook", () => {
    const parent = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(parent).toContain("useImplementationStageActionOrchestrator");
    expect(parent).not.toContain("orchestrateImplementationStageAction({");
    expect(parent).not.toContain("buildImplementationStageActionClickedTimelineEntry({");
  });
});
