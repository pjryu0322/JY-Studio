import { describe, expect, it } from "vitest";
import { resolveWorkingQueueItemPreviewImageUrl } from "@/lib/prototype/implementationWorkingQueuePreviewThumbnail";
import type { ImplementationWorkingQueueItem } from "@/lib/prototype/implementationWorkingQueueTypes";
import { newRequirementsMessage } from "@/lib/requirements/requirementsMessage";

function baseItem(overrides: Partial<ImplementationWorkingQueueItem> = {}): ImplementationWorkingQueueItem {
  return {
    id: "iwq-1",
    projectId: "p1",
    rawUserMessage: "fix ui",
    title: "Preview 캡처 기반 보완요청",
    description: "세로스크롤 없게",
    affectedArea: "ui",
    status: "pending",
    riskLevel: "medium",
    createdAt: "2026-06-14T00:00:00.000Z",
    updatedAt: "2026-06-14T00:00:00.000Z",
    ...overrides,
  };
}

describe("resolveWorkingQueueItemPreviewImageUrl", () => {
  it("resolves from source message meta", () => {
    const msg = newRequirementsMessage({
      id: "msg-1",
      role: "user",
      content: "세로스크롤 없게",
      meta: {
        regionCaptureId: "reg-1",
        previewRegionCaptureImageDataUrl: "data:image/png;base64,abcd",
      },
    });
    const url = resolveWorkingQueueItemPreviewImageUrl(
      baseItem({ sourceMessageId: "msg-1", regionCaptureId: "reg-1" }),
      { regionCaptures: [], messages: [msg] },
    );
    expect(url).toBe("data:image/png;base64,abcd");
  });

  it("resolves from persisted region capture record", () => {
    const url = resolveWorkingQueueItemPreviewImageUrl(baseItem({ regionCaptureId: "reg-2" }), {
      regionCaptures: [
        {
          id: "reg-2",
          projectId: "p1",
          stage: "implementation",
          previewUrl: "https://example.com",
          source: "server_preview_capture",
          captureId: "cap-1",
          imageDataUrl: "data:image/png;base64,zz",
          viewport: { width: 100, height: 80 },
          rect: { x: 0, y: 0, width: 100, height: 80 },
          createdAt: "2026-06-14T00:00:00.000Z",
        },
      ],
      messages: [],
    });
    expect(url).toBe("data:image/png;base64,zz");
  });

  it("returns null when no capture reference", () => {
    expect(resolveWorkingQueueItemPreviewImageUrl(baseItem(), { regionCaptures: [], messages: [] })).toBeNull();
  });
});
