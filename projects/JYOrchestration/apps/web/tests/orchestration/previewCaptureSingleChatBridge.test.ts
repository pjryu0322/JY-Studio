import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  JYO_PREVIEW_CAPTURE_ATTACH_TO_COMPOSER,
  postPreviewCaptureAttachToComposerOpener,
} from "@/lib/prototype/previewCaptureSingleChatBridge";

describe("previewCaptureSingleChatBridge postMessage", () => {
  const origin = "https://app.test";

  beforeEach(() => {
    vi.stubGlobal("window", {
      location: { origin },
      opener: null as Window | null,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const payload = {
    type: JYO_PREVIEW_CAPTURE_ATTACH_TO_COMPOSER,
    projectId: "p1",
    stage: "implementation" as const,
    previewUrl: "https://demo.github.io/app",
    captureId: "cap-1",
    regionCaptureId: "reg-1",
    imageDataUrl: "data:image/png;base64,abcd",
    rect: { x: 0, y: 0, width: 10, height: 10 },
    viewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
  };

  it("returns false when opener is missing", () => {
    expect(postPreviewCaptureAttachToComposerOpener(payload)).toBe(false);
  });

  it("returns false when opener is closed", () => {
    (window as unknown as { opener: { closed: boolean } }).opener = { closed: true };
    expect(postPreviewCaptureAttachToComposerOpener(payload)).toBe(false);
  });

  it("posts to opener with same origin", () => {
    const postMessage = vi.fn();
    (window as unknown as { opener: { closed: boolean; postMessage: typeof postMessage } }).opener = {
      closed: false,
      postMessage,
    };
    expect(postPreviewCaptureAttachToComposerOpener(payload)).toBe(true);
    expect(postMessage).toHaveBeenCalledWith(payload, origin);
  });
});
