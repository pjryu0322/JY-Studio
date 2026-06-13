import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const previewDir = join(__dirname, "../../src/components/preview");

describe("implementation developer prompt copy controller wiring", () => {
  it("declares Developer Prompt copy controller responsibility", () => {
    const src = readFileSync(
      join(previewDir, "useImplementationDeveloperPromptCopyController.ts"),
      "utf8",
    );
    expect(src).toContain("Controls implementation-stage Developer Prompt copy actions");
    expect(src).toContain("copy a single CodeTask Cursor prompt");
    expect(src).toContain("copy selected/current Developer prompts from the header action");
  });

  it("uses Developer Prompt copy controller from parent panel hook", () => {
    const parent = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(parent).toContain("useImplementationDeveloperPromptCopyController");
  });

  it("moves Developer Prompt copy handlers out of parent panel hook", () => {
    const parent = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(parent).not.toContain("const handleCopyCodeTaskCursorPrompt = useCallback");
    expect(parent).not.toContain("const handleCopyDeveloperPromptsFromHeader = useCallback");
    expect(parent).not.toContain("resolveCodeTaskDeveloperPromptForCopy({");
    expect(parent).not.toContain("resolveDeveloperPromptCopyFromSelection({");
  });
});
