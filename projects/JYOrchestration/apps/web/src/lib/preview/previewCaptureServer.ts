import type { PreviewCaptureViewport } from "@/lib/preview/previewCaptureTypes";
import { PREVIEW_CAPTURE_GOTO_TIMEOUT_MS } from "@/lib/preview/previewCaptureTypes";

export type ServerPreviewScreenshotResult =
  | Readonly<{
      readonly ok: true;
      readonly pngBuffer: Buffer;
      readonly width: number;
      readonly height: number;
    }>
  | Readonly<{ readonly ok: false; readonly message: string }>;

export async function capturePreviewUrlWithPlaywright(input: {
  readonly absolutePreviewUrl: string;
  readonly viewport: PreviewCaptureViewport;
  readonly fullPage?: boolean;
}): Promise<ServerPreviewScreenshotResult> {
  let browser: Awaited<ReturnType<(typeof import("playwright"))["chromium"]["launch"]>> | null = null;
  try {
    const { chromium } = await import("playwright");
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      viewport: {
        width: input.viewport.width,
        height: input.viewport.height,
        ...(input.viewport.deviceScaleFactor ? { deviceScaleFactor: input.viewport.deviceScaleFactor } : {}),
      },
    });

    await page.route("**/*", (route) => {
      const url = route.request().url();
      if (/^(file:|ftp:|data:)/i.test(url)) {
        void route.abort();
        return;
      }
      void route.continue();
    });

    await page.goto(input.absolutePreviewUrl, {
      waitUntil: "networkidle",
      timeout: PREVIEW_CAPTURE_GOTO_TIMEOUT_MS,
    });

    const pngBuffer = await page.screenshot({
      type: "png",
      fullPage: input.fullPage ?? false,
      timeout: PREVIEW_CAPTURE_GOTO_TIMEOUT_MS,
    });

    const width = input.viewport.width;
    const height = input.viewport.height;
    return { ok: true, pngBuffer, width, height };
  } catch (e) {
    const message =
      e instanceof Error && e.message.trim()
        ? e.message.trim()
        : "Preview 화면 캡처에 실패했습니다.";
    return {
      ok: false,
      message: message.includes("Timeout")
        ? "Preview 화면 캡처 시간이 초과되었습니다."
        : "Preview 화면 캡처에 실패했습니다. 잠시 후 다시 시도하거나 Preview URL 상태를 확인해 주세요.",
    };
  } finally {
    if (browser) {
      await browser.close().catch(() => undefined);
    }
  }
}

export function pngBufferToDataUrl(pngBuffer: Buffer): string {
  return `data:image/png;base64,${pngBuffer.toString("base64")}`;
}
