import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  annotationToolSummary,
  emptyPreviewCaptureAnnotationDocument,
  removeAnnotationsHitByEraser,
  type PreviewCaptureStroke,
} from "@/lib/preview/previewCaptureAnnotationModel";

describe("preview capture annotation UI", () => {
  it("removes memo input from send overlay", () => {
    const path = resolve(process.cwd(), "src/components/preview/PreviewAreaCaptureSendOverlay.tsx");
    const src = readFileSync(path, "utf8");
    expect(src).not.toContain("메모 (선택)");
    expect(src).not.toContain('aria-label="캡처 메모"');
    expect(src).toContain("preview-capture-annotation-toolbar");
    expect(src).toContain("preview-capture-tool-${tool}");
    expect(src).toContain('toolBtn("pen"');
  });
});

describe("preview capture annotation canvas model", () => {
  it("builds tool summary from strokes and shapes", () => {
    const doc = {
      items: [
        { id: "1", tool: "pen" as const, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], size: 3, color: "#f00" },
        { id: "2", tool: "arrow" as const, start: { x: 0, y: 0 }, end: { x: 5, y: 5 }, size: 3, color: "#f00" },
      ],
    };
    expect(annotationToolSummary(doc.items)).toEqual(["pen", "arrow"]);
  });

  it("eraser removes stroke hit by path", () => {
    const stroke: PreviewCaptureStroke = {
      id: "s1",
      tool: "pen",
      points: [
        { x: 10, y: 10 },
        { x: 20, y: 20 },
      ],
      size: 3,
      color: "#f00",
    };
    const next = removeAnnotationsHitByEraser([stroke], [{ x: 15, y: 15 }], 8);
    expect(next).toHaveLength(0);
  });

  it("clear all resets document", () => {
    expect(emptyPreviewCaptureAnnotationDocument().items).toEqual([]);
  });
});

describe("preview capture annotated attachment", () => {
  it("stageRegionToComposer posts annotated image and meta", () => {
    const path = resolve(process.cwd(), "src/components/preview/useServerPreviewAreaCapture.ts");
    const src = readFileSync(path, "utf8");
    expect(src).toContain("annotatedImageDataUrl");
    expect(src).toContain("hasAnnotations");
    expect(src).not.toMatch(/memo:\s*sendInput\.memo/);
  });

  it("composer attach message carries meta", () => {
    const path = resolve(process.cwd(), "src/lib/prototype/previewCaptureSingleChatBridge.ts");
    const src = readFileSync(path, "utf8");
    expect(src).toContain("message.meta");
  });
});
