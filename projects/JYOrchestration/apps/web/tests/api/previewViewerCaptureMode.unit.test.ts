import { describe, expect, it } from "vitest";
import {
  EXTERNAL_PREVIEW_CAPTURE_GUIDANCE,
  isPreviewViewerExternalCaptureTarget,
} from "@/lib/prototype/previewViewerCaptureMode";

describe("previewViewerCaptureMode", () => {
  it("treats relative project preview as internal capture", () => {
    expect(isPreviewViewerExternalCaptureTarget("/projects/p1/preview/app")).toBe(false);
  });

  it("treats absolute external http as display-media capture", () => {
    expect(isPreviewViewerExternalCaptureTarget("https://example.github.io/app/")).toBe(true);
  });

  it("exports external capture guidance copy", () => {
    expect(EXTERNAL_PREVIEW_CAPTURE_GUIDANCE).toContain("브라우저 화면 캡처");
  });
});
