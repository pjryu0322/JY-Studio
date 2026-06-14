"use client";

import { useCallback, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { FixedToast } from "@/components/ui/FixedToast";
import { PreviewAreaCaptureClipboardOverlay } from "@/components/preview/PreviewAreaCaptureClipboardOverlay";
import { PreviewAreaCaptureSendOverlay } from "@/components/preview/PreviewAreaCaptureSendOverlay";
import { PreviewRegionCaptureLayer } from "@/components/preview/PreviewRegionCaptureLayer";
import { useBrowserPreviewAreaClipboardCapture } from "@/components/preview/useBrowserPreviewAreaClipboardCapture";
import { useServerPreviewAreaCapture } from "@/components/preview/useServerPreviewAreaCapture";
import { PreviewRegionCaptureError, PREVIEW_CLIPBOARD_COPY_SUCCESS_MESSAGE } from "@/lib/prototype/capturePreviewRegionToClipboard";
import { resolvePreviewViewerIframeSrc } from "@/lib/prototype/implementationPreviewViewerWindow";

const shell: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100vh",
  width: "100%",
  minHeight: 0,
  background: "#f1f5f9",
};

const headerRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "12px 20px",
  borderBottom: "1px solid #e2e8f0",
  background: "#fff",
  flexShrink: 0,
};

const body: CSSProperties = {
  flex: 1,
  minHeight: 0,
  position: "relative",
  background: "#e2e8f0",
};

const iframeStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  border: "none",
  display: "block",
  background: "#fff",
};

export function ImplementationPreviewViewerChrome(props: {
  readonly projectId: string;
  readonly previewUrl: string;
  readonly onClose?: () => void;
}): ReactNode {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [internalCaptureMode, setInternalCaptureMode] = useState(false);
  const [toast, setToast] = useState<{ readonly message: string; readonly tone: "success" | "error" } | null>(
    null,
  );

  const browserCapture = useBrowserPreviewAreaClipboardCapture();
  const serverCapture = useServerPreviewAreaCapture({
    projectId: props.projectId,
    previewUrl: props.previewUrl,
  });

  const src = useMemo(() => resolvePreviewViewerIframeSrc(props.previewUrl), [props.previewUrl]);

  const notify = useCallback((message: string, tone: "success" | "error" = "success") => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 4200);
  }, []);

  const onClose = useCallback(() => {
    browserCapture.close();
    serverCapture.close();
    setInternalCaptureMode(false);
    if (props.onClose) {
      props.onClose();
      return;
    }
    window.close();
  }, [browserCapture, serverCapture, props.onClose]);

  const onCaptureButtonClick = useCallback(() => {
    if (serverCapture.state.phase === "overlay" || serverCapture.state.phase === "sending") {
      serverCapture.close();
      return;
    }
    if (internalCaptureMode) {
      setInternalCaptureMode(false);
      return;
    }

    void (async () => {
      const result = await serverCapture.startServerCapture();
      if (result.ok) return;

      notify(result.errorMessage, "error");
      if (!result.securityBlocked) {
        try {
          await browserCapture.startDisplayCapture();
        } catch {
          setInternalCaptureMode(true);
          notify("서버·화면 캡처를 사용할 수 없어 iframe 영역 캡처(fallback)로 전환했습니다.", "success");
        }
      }
    })();
  }, [serverCapture, internalCaptureMode, notify, browserCapture]);

  const captureBusy =
    serverCapture.state.phase === "loading" ||
    serverCapture.state.phase === "sending" ||
    browserCapture.state.loading;

  const subtitle =
    serverCapture.state.phase === "loading"
      ? "서버에서 Preview 화면을 캡처하고 있습니다…"
      : serverCapture.state.phase === "overlay" || serverCapture.state.phase === "sending"
        ? "캡처 이미지에서 영역을 지정하고 AI 개발자에게 전달하세요."
        : browserCapture.state.open
          ? "화면 캡처(fallback)에서 영역을 지정하세요."
          : internalCaptureMode
            ? "캡처할 영역을 드래그하세요 (iframe · fallback)."
            : "실제 앱 화면을 새 창에서 확인합니다.";

  const captureButtonLabel =
    serverCapture.state.phase === "loading"
      ? "캡처 중…"
      : serverCapture.state.phase === "overlay" || serverCapture.state.phase === "sending"
        ? "캡처 취소"
        : internalCaptureMode
          ? "캡처 취소"
          : "영역 캡처";

  return (
    <div data-testid="implementation-preview-viewer" style={shell}>
      <header style={headerRow}>
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0f172a" }}>Preview</h1>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>{subtitle}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            data-testid="preview-region-capture-start"
            disabled={captureBusy}
            onClick={onCaptureButtonClick}
            style={{
              fontSize: 13,
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              background:
                internalCaptureMode || serverCapture.state.phase === "overlay" ? "#0f172a" : "#fff",
              color:
                internalCaptureMode || serverCapture.state.phase === "overlay" ? "#fff" : "#0f172a",
              cursor: captureBusy ? "wait" : "pointer",
              opacity: captureBusy ? 0.75 : 1,
            }}
          >
            {captureButtonLabel}
          </button>
          <button
            type="button"
            aria-label="Preview 창 닫기"
            onClick={onClose}
            style={{
              fontSize: 13,
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            닫기
          </button>
        </div>
      </header>
      <div style={body}>
        <iframe
          ref={iframeRef}
          title="앱 Preview"
          src={src}
          style={iframeStyle}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
        <PreviewRegionCaptureLayer
          active={internalCaptureMode && serverCapture.state.phase === "idle" && !browserCapture.state.open}
          iframeRef={iframeRef}
          onCaptureDone={() => setInternalCaptureMode(false)}
          onCaptureError={(message) => notify(message, "error")}
          onCaptureSuccess={(message) =>
            notify(message || PREVIEW_CLIPBOARD_COPY_SUCCESS_MESSAGE, "success")
          }
        />
      </div>

      {serverCapture.state.imageDataUrl && serverCapture.state.phase !== "idle" ? (
        <PreviewAreaCaptureSendOverlay
          imageUrl={serverCapture.state.imageDataUrl}
          busy={serverCapture.state.phase === "sending"}
          onClose={() => serverCapture.close()}
          onSend={async (sendInput) => {
            try {
              await serverCapture.sendRegionToAiDeveloper(sendInput);
              notify("AI 개발자 SingleChat에 Preview 캡처를 전달했습니다.", "success");
            } catch (err) {
              const msg = err instanceof Error ? err.message : "AI 개발자에게 전달하지 못했습니다.";
              notify(msg, "error");
            }
          }}
        />
      ) : null}

      {browserCapture.state.imageUrl ? (
        <PreviewAreaCaptureClipboardOverlay
          imageUrl={browserCapture.state.imageUrl}
          busy={browserCapture.state.loading}
          onClose={() => browserCapture.close()}
          onCopy={async (copyInput) => {
            try {
              const message = await browserCapture.copyRegionToClipboard(copyInput);
              notify(message, "success");
              browserCapture.close();
            } catch (err) {
              const msg =
                err instanceof PreviewRegionCaptureError
                  ? err.message
                  : "클립보드 복사에 실패했습니다.";
              notify(msg, "error");
            }
          }}
        />
      ) : null}

      {toast ? (
        <FixedToast tone={toast.tone === "error" ? "error" : "success"} role={toast.tone === "error" ? "alert" : undefined}>
          {toast.message}
        </FixedToast>
      ) : null}
    </div>
  );
}
