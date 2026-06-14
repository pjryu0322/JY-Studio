export type PreviewCaptureRegion = Readonly<{
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}>;

export class PreviewRegionCaptureError extends Error {
  readonly code: "cross_origin" | "capture_failed" | "clipboard_failed" | "permission_denied" | "unsupported";
  constructor(code: PreviewRegionCaptureError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

export async function copyCanvasToClipboard(canvas: HTMLCanvasElement): Promise<void> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((next) => {
      if (!next) reject(new Error("이미지 Blob 생성에 실패했습니다."));
      else resolve(next);
    }, "image/png");
  }).catch(() => {
    throw new PreviewRegionCaptureError("capture_failed", "이미지 변환에 실패했습니다.");
  });

  if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
    throw new PreviewRegionCaptureError(
      "clipboard_failed",
      "현재 브라우저가 이미지 클립보드 복사를 지원하지 않습니다.",
    );
  }

  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        "image/png": blob,
      }),
    ]);
  } catch {
    throw new PreviewRegionCaptureError(
      "clipboard_failed",
      "클립보드 복사에 실패했습니다. 브라우저 권한 또는 보안 설정을 확인해 주세요.",
    );
  }
}

export function cropCanvasFromSource(input: {
  readonly source: HTMLCanvasElement;
  readonly region: PreviewCaptureRegion;
  readonly scaleX: number;
  readonly scaleY: number;
}): HTMLCanvasElement {
  const x = Math.round(input.region.x * input.scaleX);
  const y = Math.round(input.region.y * input.scaleY);
  const width = Math.max(1, Math.round(input.region.width * input.scaleX));
  const height = Math.max(1, Math.round(input.region.height * input.scaleY));
  const maxW = input.source.width;
  const maxH = input.source.height;
  const clampX = Math.max(0, Math.min(x, maxW - 1));
  const clampY = Math.max(0, Math.min(y, maxH - 1));
  const clampW = Math.min(width, maxW - clampX);
  const clampH = Math.min(height, maxH - clampY);

  const out = document.createElement("canvas");
  out.width = clampW;
  out.height = clampH;
  const ctx = out.getContext("2d");
  if (!ctx) {
    throw new PreviewRegionCaptureError("capture_failed", "crop canvas를 만들 수 없습니다.");
  }
  ctx.drawImage(input.source, clampX, clampY, clampW, clampH, 0, 0, clampW, clampH);
  return out;
}

export async function capturePreviewRegionToClipboard(input: {
  readonly iframe: HTMLIFrameElement;
  readonly region: PreviewCaptureRegion;
}): Promise<void> {
  const { iframe, region } = input;
  if (region.width < 4 || region.height < 4) {
    throw new PreviewRegionCaptureError("capture_failed", "캡처 영역이 너무 작습니다.");
  }

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    throw new PreviewRegionCaptureError(
      "cross_origin",
      "iframe 직접 캡처가 불가합니다. 브라우저 화면 캡처를 사용해 주세요.",
    );
  }

  const { default: html2canvas } = await import("html2canvas");
  const scrollX = win.scrollX ?? 0;
  const scrollY = win.scrollY ?? 0;

  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(doc.documentElement, {
      x: region.x + scrollX,
      y: region.y + scrollY,
      width: region.width,
      height: region.height,
      scrollX: -scrollX,
      scrollY: -scrollY,
      windowWidth: doc.documentElement.clientWidth,
      windowHeight: doc.documentElement.clientHeight,
      scale: window.devicePixelRatio || 1,
      useCORS: true,
      logging: false,
    });
  } catch {
    throw new PreviewRegionCaptureError("capture_failed", "화면 캡처에 실패했습니다.");
  }

  await copyCanvasToClipboard(canvas);
}

export const PREVIEW_CLIPBOARD_COPY_SUCCESS_MESSAGE =
  "선택한 Preview 영역을 클립보드에 복사했습니다. AI 개발자 채팅에 붙여넣어 보완요청과 함께 전달할 수 있습니다." as const;
