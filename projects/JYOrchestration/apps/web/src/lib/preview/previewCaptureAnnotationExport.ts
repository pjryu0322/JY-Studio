import type { PreviewCaptureRegion } from "@/lib/prototype/capturePreviewRegionToClipboard";
import {
  emptyPreviewCaptureAnnotationDocument,
  paintPreviewCaptureAnnotations,
  type PreviewCaptureAnnotationDocument,
} from "@/lib/preview/previewCaptureAnnotationModel";

export async function exportAnnotatedPreviewRegionCapture(input: {
  readonly imageDataUrl: string;
  readonly region: PreviewCaptureRegion;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly annotations?: PreviewCaptureAnnotationDocument;
}): Promise<string> {
  const doc = input.annotations ?? emptyPreviewCaptureAnnotationDocument();
  const img = await loadImage(input.imageDataUrl);
  const cropX = Math.round(input.region.x * input.scaleX);
  const cropY = Math.round(input.region.y * input.scaleY);
  const cropW = Math.max(1, Math.round(input.region.width * input.scaleX));
  const cropH = Math.max(1, Math.round(input.region.height * input.scaleY));
  const clampX = Math.max(0, Math.min(cropX, img.naturalWidth - 1));
  const clampY = Math.max(0, Math.min(cropY, img.naturalHeight - 1));
  const clampW = Math.min(cropW, img.naturalWidth - clampX);
  const clampH = Math.min(cropH, img.naturalHeight - clampY);

  const canvas = document.createElement("canvas");
  canvas.width = clampW;
  canvas.height = clampH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("annotation canvas를 만들 수 없습니다.");

  ctx.drawImage(img, clampX, clampY, clampW, clampH, 0, 0, clampW, clampH);

  const displayToPixel = clampW / Math.max(1, input.region.width);
  paintPreviewCaptureAnnotations(ctx, doc.items, displayToPixel);

  return canvas.toDataURL("image/png");
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("캡처 이미지를 불러오지 못했습니다."));
    img.src = src;
  });
}
