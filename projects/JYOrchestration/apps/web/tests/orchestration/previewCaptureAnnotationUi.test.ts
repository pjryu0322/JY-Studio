import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  annotationStyleSummary,
  annotationToolSummary,
  buildAnnotationStyle,
  emptyPreviewCaptureAnnotationDocument,
  removeAnnotationsHitByEraser,
  type PreviewCaptureStroke,
} from "@/lib/preview/previewCaptureAnnotationModel";

describe("preview capture annotation UI", () => {
  it("uses shared annotated region overlay for send path", () => {
    const path = resolve(process.cwd(), "src/components/preview/PreviewAreaCaptureSendOverlay.tsx");
    const src = readFileSync(path, "utf8");
    expect(src).toContain("PreviewAreaCaptureAnnotatedRegionOverlay");
    expect(src).not.toContain("메모 (선택)");
  });
});

describe("preview capture annotation canvas model", () => {
  const penStyle = buildAnnotationStyle("pen", "#ef4444", 4);

  it("builds tool summary from strokes and shapes", () => {
    const doc = {
      items: [
        { id: "1", tool: "pen" as const, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], style: penStyle },
        {
          id: "2",
          tool: "arrow" as const,
          start: { x: 0, y: 0 },
          end: { x: 5, y: 5 },
          style: buildAnnotationStyle("arrow", "#ef4444", 4),
        },
      ],
    };
    expect(annotationToolSummary(doc.items)).toEqual(["pen", "arrow"]);
  });

  it("builds style summary from committed items", () => {
    const highlighterStyle = buildAnnotationStyle("highlighter", "#2563eb", 8);
    const items = [
      { id: "1", tool: "highlighter" as const, points: [{ x: 0, y: 0 }, { x: 2, y: 2 }], style: highlighterStyle },
      { id: "2", tool: "pen" as const, points: [{ x: 1, y: 1 }, { x: 3, y: 3 }], style: penStyle },
    ];
    expect(annotationStyleSummary(items)).toEqual({
      colors: ["#2563eb", "#ef4444"],
      strokeWidths: [4, 16],
      tools: ["highlighter", "pen"],
    });
  });

  it("buildAnnotationStyle applies highlighter opacity and width scale", () => {
    const style = buildAnnotationStyle("highlighter", "#facc15", 4);
    expect(style.opacity).toBe(0.35);
    expect(style.strokeWidth).toBe(8);
  });

  it("buildAnnotationStyle applies dashed line dash", () => {
    const style = buildAnnotationStyle("dashedPen", "#111827", 2);
    expect(style.lineDash).toEqual([6, 4]);
    expect(style.strokeWidth).toBe(2);
  });

  it("eraser removes stroke hit by path", () => {
    const stroke: PreviewCaptureStroke = {
      id: "s1",
      tool: "pen",
      points: [
        { x: 10, y: 10 },
        { x: 20, y: 20 },
      ],
      style: penStyle,
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
    expect(src).toContain("annotationStyleSummary");
    expect(src).not.toMatch(/memo:\s*sendInput\.memo/);
  });

  it("composer attach message carries meta", () => {
    const path = resolve(process.cwd(), "src/lib/prototype/previewCaptureSingleChatBridge.ts");
    const src = readFileSync(path, "utf8");
    expect(src).toContain("message.meta");
  });
});
