import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const previewDir = join(__dirname, "../../src/components/preview");

describe("implementation execution log controller wiring", () => {
  it("declares execution log controller responsibility", () => {
    const src = readFileSync(
      join(previewDir, "useImplementationExecutionLogController.ts"),
      "utf8",
    );
    expect(src).toContain("Controls implementation-stage execution log UI actions");
    expect(src).toContain("open execution log modal");
    expect(src).toContain("clear execution log timeline entries");
  });

  it("uses execution log controller from parent panel hook", () => {
    const parent = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(parent).toContain("useImplementationExecutionLogController");
  });

  it("moves execution log handlers out of parent panel hook", () => {
    const parent = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(parent).not.toContain("const onOpenImplementationExecutionLog = useCallback");
    expect(parent).not.toContain("const onClearImplementationExecutionLog = useCallback");
    expect(parent).not.toContain("stripExecutionLogTimelineEntries(current)");
  });
});
