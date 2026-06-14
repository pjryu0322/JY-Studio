"use client";

import { useCallback, useState } from "react";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";
import { cropPreviewCaptureImageDataUrl } from "@/lib/preview/previewCaptureClientCrop";
import {
  DEFAULT_PREVIEW_CAPTURE_VIEWPORT,
  type PreviewCaptureRegionRect,
  type PreviewCaptureViewport,
} from "@/lib/preview/previewCaptureTypes";
import { notifyPreviewRegionCaptureSentToOpener } from "@/lib/prototype/previewCaptureSingleChatBridge";
import type { PreviewCaptureRegion } from "@/lib/prototype/capturePreviewRegionToClipboard";

export type ServerPreviewAreaCapturePhase = "idle" | "loading" | "overlay" | "sending";

export type ServerPreviewAreaCaptureState = Readonly<{
  readonly phase: ServerPreviewAreaCapturePhase;
  readonly imageDataUrl: string | null;
  readonly captureId: string | null;
  readonly viewport: PreviewCaptureViewport;
  readonly previewUrl: string | null;
  readonly errorMessage: string | null;
  readonly securityBlocked: boolean;
}>;

const initialState: ServerPreviewAreaCaptureState = {
  phase: "idle",
  imageDataUrl: null,
  captureId: null,
  viewport: DEFAULT_PREVIEW_CAPTURE_VIEWPORT,
  previewUrl: null,
  errorMessage: null,
  securityBlocked: false,
};

export function useServerPreviewAreaCapture(input: {
  readonly projectId: string;
  readonly previewUrl: string;
}): Readonly<{
  readonly state: ServerPreviewAreaCaptureState;
  readonly startServerCapture: () => Promise<
    Readonly<{ readonly ok: true } | { readonly ok: false; readonly errorMessage: string; readonly securityBlocked: boolean }>
  >;
  readonly close: () => void;
  readonly sendRegionToAiDeveloper: (input: {
    readonly region: PreviewCaptureRegion;
    readonly scaleX: number;
    readonly scaleY: number;
    readonly memo: string;
  }) => Promise<void>;
}> {
  const [state, setState] = useState<ServerPreviewAreaCaptureState>(initialState);

  const close = useCallback(() => {
    setState(initialState);
  }, []);

  const startServerCapture = useCallback(async (): Promise<
    Readonly<{ readonly ok: true } | { readonly ok: false; readonly errorMessage: string; readonly securityBlocked: boolean }>
  > => {
    const projectId = input.projectId.trim();
    const previewUrl = input.previewUrl.trim();
    if (!projectId || !previewUrl) {
      return { ok: false, errorMessage: "Preview 정보가 없습니다.", securityBlocked: false };
    }

    setState({
      ...initialState,
      phase: "loading",
      previewUrl,
    });

    try {
      const res = await credentialsIncludeFetch("/api/preview-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          previewUrl,
          platformOrigin: typeof window !== "undefined" ? window.location.origin : undefined,
          viewport: DEFAULT_PREVIEW_CAPTURE_VIEWPORT,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        captureId?: string;
        imageDataUrl?: string;
        width?: number;
        height?: number;
        errorMessage?: string;
        errorCode?: string;
      };

      if (!res.ok || !json.ok || !json.captureId || !json.imageDataUrl) {
        const securityBlocked = json.errorCode === "security" || res.status === 403;
        const errorMessage =
          json.errorMessage ??
          "Preview 화면 캡처에 실패했습니다. 잠시 후 다시 시도하거나 Preview URL 상태를 확인해 주세요.";
        setState({
          ...initialState,
          phase: "idle",
          previewUrl,
          errorMessage,
          securityBlocked,
        });
        return { ok: false, errorMessage, securityBlocked };
      }

      setState({
        phase: "overlay",
        imageDataUrl: json.imageDataUrl,
        captureId: json.captureId,
        viewport: {
          width: json.width ?? DEFAULT_PREVIEW_CAPTURE_VIEWPORT.width,
          height: json.height ?? DEFAULT_PREVIEW_CAPTURE_VIEWPORT.height,
          deviceScaleFactor: DEFAULT_PREVIEW_CAPTURE_VIEWPORT.deviceScaleFactor,
        },
        previewUrl,
        errorMessage: null,
        securityBlocked: false,
      });
      return { ok: true };
    } catch {
      const errorMessage =
        "Preview 화면 캡처에 실패했습니다. 잠시 후 다시 시도하거나 Preview URL 상태를 확인해 주세요.";
      setState({
        ...initialState,
        phase: "idle",
        previewUrl,
        errorMessage,
        securityBlocked: false,
      });
      return { ok: false, errorMessage, securityBlocked: false };
    }
  }, [input.projectId, input.previewUrl]);

  const sendRegionToAiDeveloper = useCallback(
    async (sendInput: {
      readonly region: PreviewCaptureRegion;
      readonly scaleX: number;
      readonly scaleY: number;
      readonly memo: string;
    }) => {
      const captureId = state.captureId;
      const previewUrl = state.previewUrl;
      const imageDataUrl = state.imageDataUrl;
      if (!captureId || !previewUrl || !imageDataUrl) return;

      setState((prev) => ({ ...prev, phase: "sending" }));

      const rect: PreviewCaptureRegionRect = {
        x: Math.round(sendInput.region.x * sendInput.scaleX),
        y: Math.round(sendInput.region.y * sendInput.scaleY),
        width: Math.max(1, Math.round(sendInput.region.width * sendInput.scaleX)),
        height: Math.max(1, Math.round(sendInput.region.height * sendInput.scaleY)),
      };

      const croppedDataUrl = await cropPreviewCaptureImageDataUrl({
        imageDataUrl,
        region: sendInput.region,
        scaleX: sendInput.scaleX,
        scaleY: sendInput.scaleY,
      });

      const res = await credentialsIncludeFetch("/api/preview-capture/region", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: input.projectId.trim(),
          captureId,
          previewUrl,
          imageDataUrl: croppedDataUrl,
          rect,
          viewport: state.viewport,
          memo: sendInput.memo,
          stage: "implementation",
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        messageId?: string;
        errorMessage?: string;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.errorMessage ?? "AI 개발자에게 전달하지 못했습니다.");
      }

      notifyPreviewRegionCaptureSentToOpener({
        projectId: input.projectId,
        messageId: json.messageId,
      });
      setState(initialState);
    },
    [input.projectId, state.captureId, state.imageDataUrl, state.previewUrl, state.viewport],
  );

  return { state, startServerCapture, close, sendRegionToAiDeveloper };
}
