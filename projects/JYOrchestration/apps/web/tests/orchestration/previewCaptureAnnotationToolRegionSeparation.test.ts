import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("preview capture annotation tool region separation", () => {
  it("tool buttons only call onToolChange", () => {
    const toolbar = readFileSync(
      resolve(process.cwd(), "src/components/preview/PreviewCaptureAnnotationToolbar.tsx"),
      "utf8",
    );
    expect(toolbar).toContain("onClick={() => props.onToolChange(tool)}");
    expect(toolbar).not.toContain("enterRegionSelect");
    expect(toolbar).not.toContain("regionSelectActive");
    expect(toolbar).not.toContain("setRegionSelectActive");
  });

  it("region select enters only from 다시 선택 control", () => {
    const overlay = readFileSync(
      resolve(process.cwd(), "src/components/preview/PreviewAreaCaptureAnnotatedRegionOverlay.tsx"),
      "utf8",
    );
    expect(overlay).toContain("enterRegionSelectMode");
    expect(overlay).toContain("preview-capture-enter-region-select");
    expect(overlay).not.toMatch(/onToolChange[\s\S]{0,120}enterRegionSelectMode/);
    expect(overlay).toContain("onToolChange={ann.setActiveTool}");
  });

  it("defaults to full image annotation region on load", () => {
    const overlay = readFileSync(
      resolve(process.cwd(), "src/components/preview/PreviewAreaCaptureAnnotatedRegionOverlay.tsx"),
      "utf8",
    );
    expect(overlay).toContain("readFullImageDisplayRegion");
    expect(overlay).toContain("preview-capture-annotate-mode");
  });
});

describe("preview capture annotation style toolbar", () => {
  it("exposes pen variants, colors, and stroke widths", () => {
    const toolbar = readFileSync(
      resolve(process.cwd(), "src/components/preview/PreviewCaptureAnnotationToolbar.tsx"),
      "utf8",
    );
    expect(toolbar).toContain('toolBtn("highlighter"');
    expect(toolbar).toContain('toolBtn("dashedPen"');
    expect(toolbar).toContain('toolBtn("marker"');
    expect(toolbar).toContain("preview-capture-color-swatches");
    expect(toolbar).toContain("preview-capture-stroke-widths");
    expect(toolbar).toContain("preview-capture-stroke-width-${opt.value}");
    expect(toolbar).toContain("onColorChange");
    expect(toolbar).toContain("onStrokeWidthChange");
  });

  it("drawing hook freezes style at pointer down", () => {
    const hook = readFileSync(
      resolve(process.cwd(), "src/components/preview/usePreviewCaptureAnnotationDrawing.ts"),
      "utf8",
    );
    expect(hook).toContain("buildAnnotationStyle");
    expect(hook).toContain("style: buildAnnotationStyle");
    expect(hook).not.toContain("size:");
  });
});
