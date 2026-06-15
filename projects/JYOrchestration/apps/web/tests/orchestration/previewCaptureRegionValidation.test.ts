import { describe, expect, it, beforeEach } from "vitest";
import { putPreviewCaptureSession, clearPreviewCaptureStoreForTests } from "@/lib/preview/previewCaptureSessionStore";
import {
  validatePreviewCaptureSessionForRegion,
  validatePreviewRegionImageAndRect,
} from "@/lib/preview/previewCaptureRegionValidation";
import type { PreviewCaptureRegionRequest } from "@/lib/preview/previewCaptureTypes";

function sampleRegionRequest(overrides: Partial<PreviewCaptureRegionRequest> = {}): PreviewCaptureRegionRequest {
  return {
    projectId: "p1",
    captureId: "cap-1",
    previewUrl: "https://demo.github.io/app",
    imageDataUrl: "data:image/png;base64,abcd",
    rect: { x: 0, y: 0, width: 100, height: 80 },
    viewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
    stage: "implementation",
    ...overrides,
  };
}

describe("previewCaptureRegionValidation", () => {
  beforeEach(() => {
    clearPreviewCaptureStoreForTests();
  });

  it("rejects missing capture session", () => {
    const result = validatePreviewCaptureSessionForRegion(sampleRegionRequest());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("rejects projectId mismatch", () => {
    putPreviewCaptureSession({
      captureId: "cap-1",
      projectId: "other",
      previewUrl: "https://demo.github.io/app",
      imageDataUrl: "data:image/png;base64,xx",
      width: 1440,
      height: 900,
    });
    const result = validatePreviewCaptureSessionForRegion(sampleRegionRequest({ projectId: "p1" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it("accepts valid capture session", () => {
    putPreviewCaptureSession({
      captureId: "cap-1",
      projectId: "p1",
      previewUrl: "https://demo.github.io/app",
      imageDataUrl: "data:image/png;base64,xx",
      width: 1440,
      height: 900,
    });
    const result = validatePreviewCaptureSessionForRegion(sampleRegionRequest());
    expect(result.ok).toBe(true);
  });

  it("accepts persisted session when in-memory store is empty", () => {
    const result = validatePreviewCaptureSessionForRegion(sampleRegionRequest(), {
      captureId: "cap-1",
      projectId: "p1",
      previewUrl: "https://demo.github.io/app/",
      width: 1440,
      height: 900,
      createdAt: new Date().toISOString(),
    });
    expect(result.ok).toBe(true);
  });

  it("rejects previewUrl mismatch", () => {
    putPreviewCaptureSession({
      captureId: "cap-1",
      projectId: "p1",
      previewUrl: "https://demo.github.io/other",
      imageDataUrl: "data:image/png;base64,xx",
      width: 1440,
      height: 900,
    });
    const result = validatePreviewCaptureSessionForRegion(sampleRegionRequest());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("validates png data url and rect bounds", () => {
    const badMime = validatePreviewRegionImageAndRect(
      sampleRegionRequest({ imageDataUrl: "data:image/jpeg;base64,abcd" }),
    );
    expect(badMime.ok).toBe(false);

    const outOfBounds = validatePreviewRegionImageAndRect(
      sampleRegionRequest({ rect: { x: 0, y: 0, width: 5000, height: 100 } }),
    );
    expect(outOfBounds.ok).toBe(false);
  });
});
