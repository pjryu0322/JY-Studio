import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const previewDir = join(__dirname, "../../src/components/preview");

describe("implementation runtime recovery controller wiring", () => {
  it("declares runtime recovery controller responsibility", () => {
    const src = readFileSync(
      join(previewDir, "useImplementationRuntimeRecoveryController.ts"),
      "utf8",
    );
    expect(src).toContain("Controls implementation runtime recovery and retry actions");
    expect(src).toContain("retry a failed CodeTask through the runtime API");
    expect(src).toContain("poll recovery while Quick Run and TaskCursor are in-flight");
  });

  it("uses runtime recovery controller from parent panel hook", () => {
    const parent = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(parent).toContain("useImplementationRuntimeRecoveryController");
  });

  it("moves runtime recovery handlers out of parent panel hook", () => {
    const parent = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(parent).not.toContain("const handleRetryFailedCodeTask = useCallback");
    expect(parent).not.toContain("window.setInterval(tick, 10_000)");
    expect(parent).not.toContain("/api/prototype/implementation-runtime/retry-failed-task");
  });
});
