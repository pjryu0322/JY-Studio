import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("preview capture annotation toolbar click", () => {
  it("does not gate tool buttons on selected region", () => {
    const toolbar = readFileSync(
      resolve(process.cwd(), "src/components/preview/PreviewCaptureAnnotationToolbar.tsx"),
      "utf8",
    );
    expect(toolbar).not.toContain("toolsEnabled");
    expect(toolbar).toContain("aria-pressed");
    expect(toolbar).toContain("onClick={() => props.onToolChange(tool)}");

    const overlay = readFileSync(
      resolve(process.cwd(), "src/components/preview/PreviewAreaCaptureAnnotatedRegionOverlay.tsx"),
      "utf8",
    );
    expect(overlay).not.toContain("toolsEnabled");
  });

  it("wires clear all action", () => {
    const toolbar = readFileSync(
      resolve(process.cwd(), "src/components/preview/PreviewCaptureAnnotationToolbar.tsx"),
      "utf8",
    );
    expect(toolbar).toContain("onClick={props.onClearAll}");
  });
});

describe("preview capture annotation layering", () => {
  it("toolbar wrapper sits above canvas with pointer events", () => {
    const toolbar = readFileSync(
      resolve(process.cwd(), "src/components/preview/PreviewCaptureAnnotationToolbar.tsx"),
      "utf8",
    );
    expect(toolbar).toContain("zIndex: 10002");
    expect(toolbar).toContain('pointerEvents: "auto"');

    const canvas = readFileSync(
      resolve(process.cwd(), "src/components/preview/PreviewCaptureAnnotationCanvas.tsx"),
      "utf8",
    );
    expect(canvas).toContain("zIndex: 2");
  });
});

describe("preview capture annotation interaction", () => {
  it("disables drawing until region is locked", () => {
    const overlay = readFileSync(
      resolve(process.cwd(), "src/components/preview/PreviewAreaCaptureAnnotatedRegionOverlay.tsx"),
      "utf8",
    );
    expect(overlay).toContain("regionSelectActive");
    expect(overlay).toContain("readFullImageDisplayRegion");
    expect(overlay).toContain("preview-capture-enter-region-select");
  });

  it("measures selection from live surface bounds", () => {
    const sel = readFileSync(
      resolve(process.cwd(), "src/components/preview/usePreviewCaptureRegionSelection.ts"),
      "utf8",
    );
    expect(sel).toContain("getBoundingClientRect");
    expect(sel).not.toContain("surfaceWidth");
  });
});
