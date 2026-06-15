"use client";

import { useCallback, useEffect, type CSSProperties, type ReactNode, type RefObject } from "react";
import type { PreviewCaptureRegion } from "@/lib/prototype/capturePreviewRegionToClipboard";
import { PREVIEW_CAPTURE_POINTER_SURFACE_STYLE } from "@/lib/preview/previewCapturePointerUtils";
import {
  paintPreviewCaptureAnnotationItem,
  paintPreviewCaptureAnnotations,
  type PreviewCaptureAnnotationDocument,
  type PreviewCaptureShape,
  type PreviewCaptureStroke,
  type PreviewCaptureTool,
} from "@/lib/preview/previewCaptureAnnotationModel";

export type PreviewCaptureAnnotationCanvasProps = Readonly<{
  readonly canvasRef: RefObject<HTMLCanvasElement | null>;
  readonly imgRef: RefObject<HTMLImageElement | null>;
  readonly region: PreviewCaptureRegion;
  readonly annotations: PreviewCaptureAnnotationDocument;
  readonly draftStroke: PreviewCaptureStroke | null;
  readonly draftShape: PreviewCaptureShape | null;
  readonly activeTool: PreviewCaptureTool;
  readonly bindAnnotationCanvas: React.CanvasHTMLAttributes<HTMLCanvasElement>;
  readonly imgRevision: number;
}>;

export function PreviewCaptureAnnotationCanvas(props: PreviewCaptureAnnotationCanvasProps): ReactNode {
  const computeScale = useCallback(() => {
    const img = props.imgRef.current;
    if (!img || !img.naturalWidth || !img.clientWidth) {
      return { scaleX: 1, scaleY: 1 };
    }
    return {
      scaleX: img.naturalWidth / img.clientWidth,
      scaleY: img.naturalHeight / img.clientHeight,
    };
  }, [props.imgRef]);

  const repaint = useCallback(() => {
    const canvas = props.canvasRef.current;
    const img = props.imgRef.current;
    const region = props.region;
    if (!canvas || !img || !img.naturalWidth) return;

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvas.width = Math.max(1, Math.round(region.width * dpr));
    canvas.height = Math.max(1, Math.round(region.height * dpr));
    canvas.style.width = `${region.width}px`;
    canvas.style.height = `${region.height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, region.width, region.height);

    const { scaleX, scaleY } = computeScale();
    const sx = region.x * scaleX;
    const sy = region.y * scaleY;
    const sw = region.width * scaleX;
    const sh = region.height * scaleY;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, region.width, region.height);

    paintPreviewCaptureAnnotations(ctx, props.annotations.items, 1);
    if (props.draftStroke && props.draftStroke.points.length >= 2) {
      paintPreviewCaptureAnnotationItem(ctx, props.draftStroke, 1);
    }
    if (props.draftShape) {
      paintPreviewCaptureAnnotationItem(ctx, props.draftShape, 1);
    }
  }, [computeScale, props]);

  useEffect(() => {
    repaint();
  }, [repaint, props.imgRevision]);

  const canvasStyle: CSSProperties = {
    position: "absolute",
    left: props.region.x,
    top: props.region.y,
    width: props.region.width,
    height: props.region.height,
    zIndex: 2,
    cursor: props.activeTool === "eraser" ? "cell" : "crosshair",
    ...PREVIEW_CAPTURE_POINTER_SURFACE_STYLE,
  };

  return (
    <canvas
      ref={props.canvasRef}
      data-testid="preview-capture-annotation-canvas"
      style={canvasStyle}
      {...props.bindAnnotationCanvas}
    />
  );
}

export function usePreviewCaptureImageDisplaySize(imgRef: RefObject<HTMLImageElement | null>, imgRevision: number): {
  readonly width: number;
  readonly height: number;
} {
  const img = imgRef.current;
  void imgRevision;
  if (!img) return { width: 0, height: 0 };
  const rect = img.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}
