import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const previewDir = join(__dirname, "../../src/components/preview");

describe("implementation notice modal controller wiring", () => {
  it("declares notice modal controller responsibility", () => {
    const src = readFileSync(join(previewDir, "useImplementationNoticeModalController.ts"), "utf8");
    expect(src).toContain("Controls implementation-stage notice modal policy");
    expect(src).toContain("append AI/user/execution notices");
    expect(src).toContain("suppress legacy CodeTask preview notices after integrated Preview is ready");
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
    expect(parent).not.toContain("COMPLETED_CODETASK_PREVIEW_NOTICE_SUPPRESSED_LOG_ACTION");
  });
});
