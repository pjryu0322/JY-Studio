import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const previewDir = join(__dirname, "../../src/components/preview");

describe("implementation notice modal controller wiring", () => {
  it("declares notice modal controller responsibility", () => {
    const src = readFileSync(join(previewDir, "useImplementationNoticeModalController.ts"), "utf8");
    expect(src).toContain("Controls implementation-stage notice modal policy");
  });

  it("uses notice modal controller from parent panel hook", () => {
    const parent = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(parent).toContain("useImplementationNoticeModalController");
  });

  it("moves notice modal policy out of parent panel hook", () => {
    const parent = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(parent).not.toContain("const [implementationStageNoticeModal, setImplementationStageNoticeModal] = useState");
    expect(parent).not.toContain("const appendAiNoticeForImplementation = useCallback");
    expect(parent).not.toContain("const appendUserNotice = useCallback");
    expect(parent).not.toContain("const appendImplementationExecutionNotice = useCallback");
  });
});
