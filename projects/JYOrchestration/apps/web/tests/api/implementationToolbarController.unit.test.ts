import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const previewDir = join(__dirname, "../../src/components/preview");

describe("implementation toolbar controller wiring", () => {
  it("declares toolbar controller responsibility", () => {
    const src = readFileSync(join(previewDir, "useImplementationToolbarController.tsx"), "utf8");
    expect(src).toContain("Builds implementation-stage toolbar actions");
    expect(src).toContain("build implementation conversation icon toolbar");
  });

  it("uses toolbar controller from parent panel hook", () => {
    const parent = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(parent).toContain("useImplementationToolbarController");
  });

  it("moves toolbar JSX out of parent panel hook", () => {
    const parent = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(parent).not.toContain("const onOpenExecutionEnvironmentSettings = useCallback");
    expect(parent).not.toContain("const executionConversationIconToolbar = useMemo");
    expect(parent).not.toContain("<WorkspaceHubChromeIconButton");
  });
});
