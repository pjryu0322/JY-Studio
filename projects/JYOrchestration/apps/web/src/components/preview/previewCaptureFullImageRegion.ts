import type { PreviewCaptureRegion } from "@/lib/prototype/capturePreviewRegionToClipboard";

export function readFullImageDisplayRegion(img: HTMLImageElement): PreviewCaptureRegion {
  return {
    x: 0,
    y: 0,
    width: Math.max(1, img.clientWidth),
    height: Math.max(1, img.clientHeight),
  };
}
