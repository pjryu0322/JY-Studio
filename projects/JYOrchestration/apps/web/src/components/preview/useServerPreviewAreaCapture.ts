"use client";

import { useCallback, useState } from "react";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";
import type { PreviewAreaCaptureSendInput } from "@/components/preview/previewAreaCaptureSendTypes";
import {
  DEFAULT_PREVIEW_CAPTURE_VIEWPORT,
  type PreviewCaptureRegionRect,
  type PreviewCaptureViewport,
} from "@/lib/preview/previewCaptureTypes";
import {
  JYO_PREVIEW_CAPTURE_ATTACH_TO_COMPOSER,
  postPreviewCaptureAttachToComposerOpener,
} from "@/lib/prototype/previewCaptureSingleChatBridge";

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
  readonly stageRegionToComposer: (
    input: PreviewAreaCaptureSendInput,
  ) => Promise<Readonly<{ readonly ok: true } | { readonly ok: false; readonly errorMessage: string }>>;
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

  const stageRegionToComposer = useCallback(
    async (
      sendInput: PreviewAreaCaptureSendInput,
    ): Promise<Readonly<{ readonly ok: true } | { readonly ok: false; readonly errorMessage: string }>> => {
      const captureId = state.captureId;
      const previewUrl = state.previewUrl;
      const imageDataUrl = state.imageDataUrl;
      if (!captureId || !previewUrl || !imageDataUrl) {
        return { ok: false, errorMessage: "캡처 정보가 없습니다." };
      }

      setState((prev) => ({ ...prev, phase: "sending" }));

      const rect: PreviewCaptureRegionRect = {
        x: Math.round(sendInput.region.x * sendInput.scaleX),
        y: Math.round(sendInput.region.y * sendInput.scaleY),
        width: Math.max(1, Math.round(sendInput.region.width * sendInput.scaleX)),
        height: Math.max(1, Math.round(sendInput.region.height * sendInput.scaleY)),
      };

      const annotatedDataUrl = sendInput.annotatedImageDataUrl;

      const res = await credentialsIncludeFetch("/api/preview-capture/region", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: input.projectId.trim(),
          captureId,
          previewUrl,
          imageDataUrl: annotatedDataUrl,
          rect,
          viewport: state.viewport,
          stage: "implementation",
          meta: {
            hasAnnotations: sendInput.hasAnnotations,
            annotationToolSummary: sendInput.annotationToolSummary,
            annotationStyleSummary: sendInput.annotationStyleSummary,
          },
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        regionCaptureId?: string;
        imageUrl?: string;
        errorMessage?: string;
      };
      if (!res.ok || !json.ok || !json.regionCaptureId) {
        setState((prev) => ({ ...prev, phase: "overlay" }));
        return {
          ok: false,
          errorMessage: json.errorMessage ?? "대화입력창에 추가하지 못했습니다.",
        };
      }

      const posted = postPreviewCaptureAttachToComposerOpener({
        type: JYO_PREVIEW_CAPTURE_ATTACH_TO_COMPOSER,
        projectId: input.projectId.trim(),
        stage: "implementation",
        previewUrl,
        captureId,
        regionCaptureId: json.regionCaptureId,
        imageDataUrl: json.imageUrl ?? annotatedDataUrl,
        rect,
        viewport: state.viewport,
        meta: {
          hasAnnotations: sendInput.hasAnnotations,
          annotationToolSummary: sendInput.annotationToolSummary,
          annotationStyleSummary: sendInput.annotationStyleSummary,
        },
      });

      setState(initialState);

      if (!posted) {
        return {
          ok: false,
          errorMessage:
            "구현단계 화면을 찾을 수 없어 대화입력창에 추가하지 못했습니다. Preview를 구현단계 Toolbar에서 다시 열어 주세요.",
        };
      }

      return { ok: true };
    },
    [input.projectId, state.captureId, state.imageDataUrl, state.previewUrl, state.viewport],
  );

  return { state, startServerCapture, close, stageRegionToComposer };
}
