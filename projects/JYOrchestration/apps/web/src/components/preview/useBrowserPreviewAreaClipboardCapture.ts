"use client";

import { useCallback, useRef, useState } from "react";
import {
  copyCanvasToClipboard,
  cropCanvasFromSource,
  PreviewRegionCaptureError,
  PREVIEW_CLIPBOARD_COPY_SUCCESS_MESSAGE,
  type PreviewCaptureRegion,
} from "@/lib/prototype/capturePreviewRegionToClipboard";

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

  const copyRegionToClipboard = useCallback(
    async (input: {
      readonly region: PreviewCaptureRegion;
      readonly scaleX: number;
      readonly scaleY: number;
    }): Promise<string> => {
      const source = sourceCanvasRef.current;
      if (!source) {
        throw new PreviewRegionCaptureError("capture_failed", "캡처 이미지가 없습니다.");
      }
      const cropped = cropCanvasFromSource({
        source,
        region: input.region,
        scaleX: input.scaleX,
        scaleY: input.scaleY,
      });
      await copyCanvasToClipboard(cropped);
      return PREVIEW_CLIPBOARD_COPY_SUCCESS_MESSAGE;
    },
    [],
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
    copyRegionToClipboard,
    setLastError,
  };
}
