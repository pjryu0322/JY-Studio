"use client";

import { useCallback, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { FixedToast } from "@/components/ui/FixedToast";
import { PreviewAreaCaptureClipboardOverlay } from "@/components/preview/PreviewAreaCaptureClipboardOverlay";
import { PreviewRegionCaptureLayer } from "@/components/preview/PreviewRegionCaptureLayer";
import { useBrowserPreviewAreaClipboardCapture } from "@/components/preview/useBrowserPreviewAreaClipboardCapture";
import { PreviewRegionCaptureError, PREVIEW_CLIPBOARD_COPY_SUCCESS_MESSAGE } from "@/lib/prototype/capturePreviewRegionToClipboard";
import {
  EXTERNAL_PREVIEW_CAPTURE_GUIDANCE,
  isPreviewViewerExternalCaptureTarget,
} from "@/lib/prototype/previewViewerCaptureMode";
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
  readonly previewUrl: string;
  readonly onClose?: () => void;
}): ReactNode {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [internalCaptureMode, setInternalCaptureMode] = useState(false);
  const [toast, setToast] = useState<{ readonly message: string; readonly tone: "success" | "error" } | null>(
    null,
  );

  const browserCapture = useBrowserPreviewAreaClipboardCapture();
  const isExternalCapture = useMemo(
    () => isPreviewViewerExternalCaptureTarget(props.previewUrl),
    [props.previewUrl],
  );

  const src = useMemo(() => resolvePreviewViewerIframeSrc(props.previewUrl), [props.previewUrl]);

  const notify = useCallback((message: string, tone: "success" | "error" = "success") => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 4200);
  }, []);

  const onClose = useCallback(() => {
    browserCapture.close();
    setInternalCaptureMode(false);
    if (props.onClose) {
      props.onClose();
      return;
    }
    window.close();
  }, [browserCapture, props.onClose]);

  const onCaptureButtonClick = useCallback(() => {
    if (isExternalCapture) {
      void (async () => {
        notify(EXTERNAL_PREVIEW_CAPTURE_GUIDANCE, "success");
        try {
          await browserCapture.startDisplayCapture();
        } catch (err) {
          const message =
            err instanceof PreviewRegionCaptureError
              ? err.message
              : "화면 캡처에 실패했습니다.";
          notify(message, "error");
        }
      })();
      return;
    }
    setInternalCaptureMode((v) => !v);
  }, [browserCapture, isExternalCapture, notify]);

  const subtitle = browserCapture.state.open
    ? "캡처 이미지에서 영역을 지정한 뒤 클립보드에 복사하세요."
    : internalCaptureMode
      ? "캡처할 영역을 드래그하세요."
      : "실제 앱 화면을 새 창에서 확인합니다.";

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
            disabled={browserCapture.state.loading}
            onClick={onCaptureButtonClick}
            style={{
              fontSize: 13,
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              background: internalCaptureMode ? "#0f172a" : "#fff",
              color: internalCaptureMode ? "#fff" : "#0f172a",
              cursor: browserCapture.state.loading ? "wait" : "pointer",
              opacity: browserCapture.state.loading ? 0.75 : 1,
            }}
          >
            {browserCapture.state.loading
              ? "캡처 중…"
              : internalCaptureMode
                ? "캡처 취소"
                : "영역 캡처"}
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
        {!isExternalCapture ? (
          <PreviewRegionCaptureLayer
            active={internalCaptureMode}
            iframeRef={iframeRef}
            onCaptureDone={() => setInternalCaptureMode(false)}
            onCaptureError={(message) => notify(message, "error")}
            onCaptureSuccess={(message) =>
              notify(message || PREVIEW_CLIPBOARD_COPY_SUCCESS_MESSAGE, "success")
            }
          />
        ) : null}
      </div>

      {browserCapture.state.imageUrl ? (
        <PreviewAreaCaptureClipboardOverlay
          imageUrl={browserCapture.state.imageUrl}
          busy={browserCapture.state.loading}
          onClose={() => browserCapture.close()}
          onCopy={async (input) => {
            try {
              const message = await browserCapture.copyRegionToClipboard(input);
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
