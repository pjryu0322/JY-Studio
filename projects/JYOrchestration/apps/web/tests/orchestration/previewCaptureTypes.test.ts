import { describe, expect, it } from "vitest";
import {
  parsePreviewCaptureRegionRequest,
  parsePreviewCaptureRequest,
} from "@/lib/preview/previewCaptureTypes";

describe("previewCaptureTypes", () => {
  it("parses preview capture request", () => {
    const parsed = parsePreviewCaptureRequest({
      projectId: " abc ",
      previewUrl: "https://demo.github.io/app",
      viewport: { width: 1280, height: 720 },
    });
    expect(parsed).toEqual({
      projectId: "abc",
      previewUrl: "https://demo.github.io/app",
      viewport: { width: 1280, height: 720 },
    });
  });

  it("parses region request with png data url", () => {
    const parsed = parsePreviewCaptureRegionRequest({
      projectId: "p1",
      captureId: "cap-1",
      previewUrl: "https://demo.github.io/app",
      imageDataUrl: "data:image/png;base64,abcd",
      rect: { x: 1, y: 2, width: 10, height: 12 },
      viewport: { width: 1440, height: 900 },
      stage: "implementation",
      memo: "fix layout",
    });
    expect(parsed?.projectId).toBe("p1");
    expect(parsed?.memo).toBe("fix layout");
    expect(parsed?.rect.width).toBe(10);
  });

  it("rejects invalid region payload", () => {
    expect(parsePreviewCaptureRegionRequest({ projectId: "p1" })).toBeNull();
  });
});
