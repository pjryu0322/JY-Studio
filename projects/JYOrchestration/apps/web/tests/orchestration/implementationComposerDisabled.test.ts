import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("implementationComposerDisabled wiring", () => {
  it("locks composer attachments and capture when canChat is false", () => {
    const panel = readFileSync(
      resolve(process.cwd(), "src/components/preview/PrototypeImplementationStagePanel.tsx"),
      "utf8",
    );
    expect(panel).toContain("composerDisableAttachments={!implementationChatAvailability.canChat}");
    expect(panel).toContain("composerDisablePreviewCapture={!implementationChatAvailability.canChat}");
    expect(panel).toContain("inputDisabled={isMessageInputBlocked}");
  });

  it("PrototypeExecutionComposer supports attachment/capture disable props", () => {
    const composer = readFileSync(
      resolve(process.cwd(), "src/components/preview/PrototypeExecutionComposer.tsx"),
      "utf8",
    );
    expect(composer).toContain("disableAttachments");
    expect(composer).toContain("disablePreviewCapture");
    expect(composer).toContain("disabled={inputDisabled}");
  });

  it("pending attachment hook blocks file/capture staging when disabled", () => {
    const hook = readFileSync(
      resolve(process.cwd(), "src/components/preview/useImplementationComposerPendingAttachments.ts"),
      "utf8",
    );
    expect(hook).toContain("fileAttachEnabled");
    expect(hook).toContain("captureAttachEnabled");
    expect(hook).toContain("Preview가 준비되면");
  });
});
