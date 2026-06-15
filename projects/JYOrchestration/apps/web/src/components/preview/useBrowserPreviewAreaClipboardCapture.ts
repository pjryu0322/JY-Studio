"use client";

import { useCallback, useRef, useState } from "react";
import type { PreviewAreaCaptureSendInput } from "@/components/preview/previewAreaCaptureSendTypes";
import {
  DEFAULT_PREVIEW_CAPTURE_VIEWPORT,
  type PreviewCaptureRegionRect,
} from "@/lib/preview/previewCaptureTypes";
import {
  copyCanvasToClipboard,
  PreviewRegionCaptureError,
  PREVIEW_CLIPBOARD_COPY_SUCCESS_MESSAGE,
} from "@/lib/prototype/capturePreviewRegionToClipboard";
import {
  JYO_PREVIEW_CAPTURE_ATTACH_TO_COMPOSER,
  postPreviewCaptureAttachToComposerOpener,
} from "@/lib/prototype/previewCaptureSingleChatBridge";

export type BrowserPreviewAreaCaptureState = Readonly<{
  readonly open: boolean;
  readonly imageUrl: string | null;
  readonly loading: boolean;
  readonly lastError: string | null;
}>;

export function useBrowserPreviewAreaClipboardCapture() {
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    for (const track of streamRef.current?.getTracks() ?? []) {
      track.stop();
    }
    streamRef.current = null;
  }, []);

  const close = useCallback(() => {
    stopStream();
    sourceCanvasRef.current = null;
    setImageUrl(null);
    setLastError(null);
  }, [stopStream]);

  const startDisplayCapture = useCallback(async (): Promise<void> => {
    setLastError(null);
    if (typeof window === "undefined") return;

    if (!window.isSecureContext) {
      throw new PreviewRegionCaptureError(
        "unsupported",
        "화면 캡처 또는 클립보드 복사는 보안 컨텍스트에서만 동작할 수 있습니다. localhost 또는 HTTPS 환경에서 다시 시도해 주세요.",
      );
    }

    if (!navigator.mediaDevices?.getDisplayMedia) {
      throw new PreviewRegionCaptureError(
        "unsupported",
        "현재 브라우저가 화면 캡처를 지원하지 않습니다. Chrome 또는 Edge 최신 버전에서 다시 시도해 주세요.",
      );
    }

    setLoading(true);
    stopStream();
    sourceCanvasRef.current = null;
    setImageUrl(null);

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      streamRef.current = stream;

      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();

      await new Promise<void>((resolve, reject) => {
        if (video.readyState >= 2 && video.videoWidth > 0) {
          resolve();
          return;
        }
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("video metadata"));
      });

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx || canvas.width < 1 || canvas.height < 1) {
        throw new PreviewRegionCaptureError("capture_failed", "화면 캡처에 실패했습니다.");
      }
      ctx.drawImage(video, 0, 0);

      sourceCanvasRef.current = canvas;
      setImageUrl(canvas.toDataURL("image/png"));
    } catch (err) {
      if (err instanceof PreviewRegionCaptureError) throw err;
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        throw new PreviewRegionCaptureError(
          "permission_denied",
          "화면 캡처 권한이 취소되었습니다. 다시 시도하려면 영역 캡처를 다시 선택해 주세요.",
        );
      }
      throw new PreviewRegionCaptureError("capture_failed", "화면 캡처에 실패했습니다.");
    } finally {
      if (stream) {
        for (const track of stream.getTracks()) track.stop();
      }
      streamRef.current = null;
      setLoading(false);
    }
  }, [stopStream]);

  const readViewport = useCallback(() => {
    const source = sourceCanvasRef.current;
    if (!source) return DEFAULT_PREVIEW_CAPTURE_VIEWPORT;
    return { width: source.width, height: source.height, deviceScaleFactor: 1 };
  }, []);

  const copyAnnotatedToClipboard = useCallback(async (sendInput: PreviewAreaCaptureSendInput): Promise<string> => {
    const dataUrl = sendInput.annotatedImageDataUrl;
    const img = document.createElement("img");
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new PreviewRegionCaptureError("capture_failed", "주석 이미지를 불러오지 못했습니다."));
      img.src = dataUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new PreviewRegionCaptureError("capture_failed", "클립보드용 canvas를 만들 수 없습니다.");
    }
    ctx.drawImage(img, 0, 0);
    await copyCanvasToClipboard(canvas);
    return PREVIEW_CLIPBOARD_COPY_SUCCESS_MESSAGE;
  }, []);

  const stageRegionToComposer = useCallback(
    (input: {
      readonly projectId: string;
      readonly previewUrl: string;
      readonly sendInput: PreviewAreaCaptureSendInput;
    }): Readonly<{ readonly ok: true } | { readonly ok: false; readonly errorMessage: string }> => {
      const rect: PreviewCaptureRegionRect = {
        x: Math.round(input.sendInput.region.x * input.sendInput.scaleX),
        y: Math.round(input.sendInput.region.y * input.sendInput.scaleY),
        width: Math.max(1, Math.round(input.sendInput.region.width * input.sendInput.scaleX)),
        height: Math.max(1, Math.round(input.sendInput.region.height * input.sendInput.scaleY)),
      };
      const posted = postPreviewCaptureAttachToComposerOpener({
        type: JYO_PREVIEW_CAPTURE_ATTACH_TO_COMPOSER,
        projectId: input.projectId.trim(),
        stage: "implementation",
        previewUrl: input.previewUrl.trim(),
        captureId: crypto.randomUUID(),
        regionCaptureId: crypto.randomUUID(),
        imageDataUrl: input.sendInput.annotatedImageDataUrl,
        rect,
        viewport: readViewport(),
        meta: {
          hasAnnotations: input.sendInput.hasAnnotations,
          annotationToolSummary: input.sendInput.annotationToolSummary,
          annotationStyleSummary: input.sendInput.annotationStyleSummary,
        },
      });
      if (!posted) {
        return {
          ok: false,
          errorMessage:
            "구현단계 화면을 찾을 수 없어 대화입력창에 추가하지 못했습니다. Preview를 구현단계 Toolbar에서 다시 열어 주세요.",
        };
      }
      return { ok: true };
    },
    [readViewport],
  );

  const state: BrowserPreviewAreaCaptureState = {
    open: Boolean(imageUrl),
    imageUrl,
    loading,
    lastError,
  };

  return {
    state,
    startDisplayCapture,
    close,
    copyAnnotatedToClipboard,
    stageRegionToComposer,
    setLastError,
  };
}
