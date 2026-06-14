import type { PreviewCaptureRegionRect } from "@/lib/preview/previewCaptureTypes";

export async function cropPreviewCaptureImageDataUrl(input: {
  readonly imageDataUrl: string;
  readonly region: PreviewCaptureRegionRect;
  readonly scaleX: number;
  readonly scaleY: number;
}): Promise<string> {
  const img = await loadImage(input.imageDataUrl);
  const canvas = document.createElement("canvas");
  const x = Math.round(input.region.x * input.scaleX);
  const y = Math.round(input.region.y * input.scaleY);
  const width = Math.max(1, Math.round(input.region.width * input.scaleX));
  const height = Math.max(1, Math.round(input.region.height * input.scaleY));
  const clampX = Math.max(0, Math.min(x, img.naturalWidth - 1));
  const clampY = Math.max(0, Math.min(y, img.naturalHeight - 1));
  const clampW = Math.min(width, img.naturalWidth - clampX);
  const clampH = Math.min(height, img.naturalHeight - clampY);
  canvas.width = clampW;
  canvas.height = clampH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("crop canvas를 만들 수 없습니다.");
  ctx.drawImage(img, clampX, clampY, clampW, clampH, 0, 0, clampW, clampH);
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
