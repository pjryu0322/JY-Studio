import type { CSSProperties, PointerEvent } from "react";
import type { PreviewCaptureRegion } from "@/lib/prototype/capturePreviewRegionToClipboard";

export type PreviewCaptureLocalPoint = Readonly<{ readonly x: number; readonly y: number }>;

export function getLocalPointFromPointerEvent(
  event: PointerEvent<HTMLElement>,
): PreviewCaptureLocalPoint {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

export function clampPointInSize(
  point: PreviewCaptureLocalPoint,
  width: number,
  height: number,
): PreviewCaptureLocalPoint {
  return {
    x: Math.max(0, Math.min(width, point.x)),
    y: Math.max(0, Math.min(height, point.y)),
  };
}

export function clampPointInRegion(
  point: PreviewCaptureLocalPoint,
  region: PreviewCaptureRegion,
): PreviewCaptureLocalPoint {
  return clampPointInSize(point, region.width, region.height);
}

export const PREVIEW_CAPTURE_POINTER_SURFACE_STYLE: CSSProperties = {
  touchAction: "none",
  userSelect: "none",
  overscrollBehavior: "contain",
};
