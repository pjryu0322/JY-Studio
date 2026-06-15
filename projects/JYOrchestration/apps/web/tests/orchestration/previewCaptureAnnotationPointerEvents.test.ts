import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("preview capture annotation pointer events", () => {
  it("uses pointer handlers on annotation drawing hook", () => {
    const path = resolve(process.cwd(), "src/components/preview/usePreviewCaptureAnnotationDrawing.ts");
    const src = readFileSync(path, "utf8");
    expect(src).toContain("onPointerDown");
    expect(src).toContain("onPointerMove");
    expect(src).toContain("onPointerUp");
    expect(src).toContain("onPointerCancel");
    expect(src).toContain("setPointerCapture");
    expect(src).not.toContain("onMouseDown");
  });

  it("uses pointer handlers on region selection hook", () => {
    const path = resolve(process.cwd(), "src/components/preview/usePreviewCaptureRegionSelection.ts");
    const src = readFileSync(path, "utf8");
    expect(src).toContain("onPointerDown");
    expect(src).not.toContain("onMouseDown");
  });
});

describe("preview capture annotation shared component", () => {
  it("server and fallback overlays use annotated region shell", () => {
    const send = readFileSync(
      resolve(process.cwd(), "src/components/preview/PreviewAreaCaptureSendOverlay.tsx"),
      "utf8",
    );
    const clip = readFileSync(
      resolve(process.cwd(), "src/components/preview/PreviewAreaCaptureClipboardOverlay.tsx"),
      "utf8",
    );
    expect(send).toContain("PreviewAreaCaptureAnnotatedRegionOverlay");
    expect(clip).toContain("PreviewAreaCaptureAnnotatedRegionOverlay");
    const shared = readFileSync(
      resolve(process.cwd(), "src/components/preview/PreviewAreaCaptureAnnotatedRegionOverlay.tsx"),
      "utf8",
    );
    expect(shared).toContain("PreviewCaptureAnnotationToolbar");
  });
});

describe("preview capture fallback annotated attachment", () => {
  it("browser hook stages composer attach with meta", () => {
    const path = resolve(process.cwd(), "src/components/preview/useBrowserPreviewAreaClipboardCapture.ts");
    const src = readFileSync(path, "utf8");
    expect(src).toContain("stageRegionToComposer");
    expect(src).toContain("hasAnnotations");
    expect(src).toContain("annotatedImageDataUrl");
  });
});

describe("preview capture mobile toolbar", () => {
  it("toolbar allows wrap and min touch height", () => {
    const path = resolve(process.cwd(), "src/components/preview/PreviewCaptureAnnotationToolbar.tsx");
    const src = readFileSync(path, "utf8");
    expect(src).toContain("flexWrap");
    expect(src).toContain("minHeight: 36");
    expect(src).toContain("overflowX");
  });
});
