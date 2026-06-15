import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const previewDir = join(__dirname, "../../src/components/preview");

describe("implementationResetScopeDialog", () => {
  it("opens scope dialog from toolbar without immediate full reset confirm", () => {
    const toolbar = readFileSync(join(previewDir, "useImplementationToolbarController.tsx"), "utf8");
    expect(toolbar).toContain("onOpenImplementationResetDialog");
    expect(toolbar).not.toContain("onResetImplementationSession");
    expect(toolbar).not.toContain("confirmResetConversation");
  });

  it("renders reset scope selection modal", () => {
    const panel = readFileSync(join(previewDir, "PrototypeImplementationStagePanel.tsx"), "utf8");
    expect(panel).toContain("ImplementationResetScopeDialog");
  });

  it("reset controller does not call cascade for conversation-only path", () => {
    const ctrl = readFileSync(join(previewDir, "useImplementationSessionResetController.ts"), "utf8");
    expect(ctrl).toContain("clearImplementationConversationOnlyFromRequirementsJson");
    expect(ctrl).toContain('scope === "conversation_only"');
    expect(ctrl).toContain("implementationResetScopeDialogOpen");
  });
});
