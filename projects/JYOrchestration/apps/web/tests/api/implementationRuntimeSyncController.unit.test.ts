import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const previewDir = join(__dirname, "../../src/components/preview");

describe("implementation runtime sync controller wiring", () => {
  it("declares runtime sync controller responsibility", () => {
    const src = readFileSync(
      join(previewDir, "useImplementationRuntimeSyncController.ts"),
      "utf8",
    );
    expect(src).toContain("Controls implementation-stage runtime synchronization wiring");
  });

  it("uses runtime sync controller from parent panel hook", () => {
    const parent = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(parent).toContain("useImplementationRuntimeSyncController");
  });

  it("moves runtime sync hook wiring out of parent panel hook", () => {
    const parent = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(parent).not.toContain("useImplementationRuntimeDbSync(");
    expect(parent).not.toContain("useDbQueuedQuickRunAutoDispatch(");
    expect(parent).not.toContain("useRecoverServerQuickRunContinuation(");
    expect(parent).not.toContain("useTaskCursorServerJobPoll(");
    expect(parent).not.toContain("useImplementationAutoQualityGateTrigger(");
  });
});
