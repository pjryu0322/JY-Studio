import { describe, expect, it } from "vitest";
import {
  composerAttachmentFromAttachMessage,
  isPreviewCaptureComposerAttachMessage,
  JYO_PREVIEW_CAPTURE_ATTACH_TO_COMPOSER,
} from "@/lib/prototype/previewCaptureSingleChatBridge";

describe("preview capture composer attach message", () => {
  const validMessage = {
    type: JYO_PREVIEW_CAPTURE_ATTACH_TO_COMPOSER,
    projectId: "p1",
    stage: "implementation" as const,
    previewUrl: "https://demo.github.io/app",
    captureId: "cap-1",
    regionCaptureId: "reg-1",
    imageDataUrl: "data:image/png;base64,abcd",
    rect: { x: 1, y: 2, width: 10, height: 12 },
    viewport: { width: 1440, height: 900 },
  };

  it("accepts attach-to-composer payload", () => {
    expect(isPreviewCaptureComposerAttachMessage(validMessage)).toBe(true);
    const attachment = composerAttachmentFromAttachMessage(validMessage);
    expect(attachment.regionCaptureId).toBe("reg-1");
  });

  it("rejects wrong type", () => {
    expect(isPreviewCaptureComposerAttachMessage({ ...validMessage, type: "other" })).toBe(false);
  });
});
