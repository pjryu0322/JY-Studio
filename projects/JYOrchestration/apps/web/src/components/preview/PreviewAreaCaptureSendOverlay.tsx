"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { PreviewCaptureRegion } from "@/lib/prototype/capturePreviewRegionToClipboard";

const MIN_SIZE = 6;

type Point = Readonly<{ readonly x: number; readonly y: number }>;

export function PreviewAreaCaptureSendOverlay(props: {
  readonly imageUrl: string;
  readonly busy?: boolean;
  readonly onClose: () => void;
  readonly onSend: (input: {
    readonly region: PreviewCaptureRegion;
    readonly scaleX: number;
    readonly scaleY: number;
    readonly memo: string;
  }) => Promise<void>;
}): ReactNode {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [dragCurrent, setDragCurrent] = useState<Point | null>(null);
  const [selectionLocked, setSelectionLocked] = useState<PreviewCaptureRegion | null>(null);
  const [sendBusy, setSendBusy] = useState(false);
  const [memo, setMemo] = useState("");

  const resetSelection = useCallback(() => {
    setDragStart(null);
    setDragCurrent(null);
    setSelectionLocked(null);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        props.onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.onClose]);

  const localPoint = useCallback((clientX: number, clientY: number): Point | null => {
    const img = imgRef.current;
    if (!img) return null;
    const rect = img.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(rect.width, clientX - rect.left)),
      y: Math.max(0, Math.min(rect.height, clientY - rect.top)),
    };
  }, []);

  const liveSelection = ((): PreviewCaptureRegion | null => {
    if (selectionLocked) return selectionLocked;
    if (!dragStart || !dragCurrent) return null;
    const x = Math.min(dragStart.x, dragCurrent.x);
    const y = Math.min(dragStart.y, dragCurrent.y);
    const width = Math.abs(dragCurrent.x - dragStart.x);
    const height = Math.abs(dragCurrent.y - dragStart.y);
    if (width < MIN_SIZE || height < MIN_SIZE) return null;
    return { x, y, width, height };
  })();

  const computeScale = useCallback(() => {
    const img = imgRef.current;
    if (!img || !img.naturalWidth || !img.clientWidth) {
      return { scaleX: 1, scaleY: 1 };
    }
    return {
      scaleX: img.naturalWidth / img.clientWidth,
      scaleY: img.naturalHeight / img.clientHeight,
    };
  }, []);

  const onSendClick = useCallback(async () => {
    const region = selectionLocked ?? liveSelection;
    if (!region || sendBusy || props.busy) return;
    setSendBusy(true);
    try {
      const { scaleX, scaleY } = computeScale();
      await props.onSend({ region, scaleX, scaleY, memo: memo.trim() });
    } finally {
      setSendBusy(false);
    }
  }, [selectionLocked, liveSelection, sendBusy, props, computeScale, memo]);

  const shell: CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 100,
    background: "rgba(15, 23, 42, 0.72)",
    display: "flex",
    flexDirection: "column",
    padding: 16,
    gap: 12,
  };

  const toolbar: CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "flex-end",
    flexShrink: 0,
    alignItems: "center",
  };

  const btn = (primary?: boolean): CSSProperties => ({
    fontSize: 13,
    padding: "8px 14px",
    borderRadius: 8,
    border: primary ? "1px solid #0f172a" : "1px solid #cbd5e1",
    background: primary ? "#0f172a" : "#fff",
    color: primary ? "#fff" : "#0f172a",
    cursor: "pointer",
    opacity: props.busy || sendBusy ? 0.7 : 1,
  });

  const frame: CSSProperties = {
    flex: 1,
    minHeight: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "auto",
  };

  const imgWrap: CSSProperties = {
    position: "relative",
    maxWidth: "100%",
    maxHeight: "100%",
    touchAction: "none",
    cursor: "crosshair",
  };

  const shade: CSSProperties = {
    position: "absolute",
    border: "2px solid #0ea5e9",
    background: "rgba(14, 165, 233, 0.15)",
    boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.45)",
    pointerEvents: "none",
  };

  const canSend = Boolean(selectionLocked ?? liveSelection);

  const bindDragSurface = {
    onMouseDown: (e: React.MouseEvent) => {
      if (e.button !== 0 || sendBusy) return;
      e.preventDefault();
      setSelectionLocked(null);
      const p = localPoint(e.clientX, e.clientY);
      if (!p) return;
      setDragStart(p);
      setDragCurrent(p);
    },
    onMouseMove: (e: React.MouseEvent) => {
      if (!dragStart || sendBusy) return;
      const p = localPoint(e.clientX, e.clientY);
      if (p) setDragCurrent(p);
    },
    onMouseUp: (e: React.MouseEvent) => {
      if (!dragStart || sendBusy) return;
      const end = localPoint(e.clientX, e.clientY);
      if (!end) {
        resetSelection();
        return;
      }
      const x = Math.min(dragStart.x, end.x);
      const y = Math.min(dragStart.y, end.y);
      const width = Math.abs(end.x - dragStart.x);
      const height = Math.abs(end.y - dragStart.y);
      setDragStart(null);
      setDragCurrent(null);
      if (width >= MIN_SIZE && height >= MIN_SIZE) {
        setSelectionLocked({ x, y, width, height });
      }
    },
    onTouchStart: (e: React.TouchEvent) => {
      if (sendBusy) return;
      const t = e.changedTouches[0];
      if (!t) return;
      setSelectionLocked(null);
      const p = localPoint(t.clientX, t.clientY);
      if (!p) return;
      setDragStart(p);
      setDragCurrent(p);
    },
    onTouchMove: (e: React.TouchEvent) => {
      if (!dragStart || sendBusy) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const p = localPoint(t.clientX, t.clientY);
      if (p) setDragCurrent(p);
    },
    onTouchEnd: (e: React.TouchEvent) => {
      if (!dragStart || sendBusy) return;
      const t = e.changedTouches[0];
      if (!t) {
        resetSelection();
        return;
      }
      const end = localPoint(t.clientX, t.clientY);
      if (!end) {
        resetSelection();
        return;
      }
      const x = Math.min(dragStart.x, end.x);
      const y = Math.min(dragStart.y, end.y);
      const width = Math.abs(end.x - dragStart.x);
      const height = Math.abs(end.y - dragStart.y);
      setDragStart(null);
      setDragCurrent(null);
      if (width >= MIN_SIZE && height >= MIN_SIZE) {
        setSelectionLocked({ x, y, width, height });
      }
    },
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Preview 영역 캡처"
      data-testid="preview-area-capture-send-overlay"
      style={shell}
    >
      <div style={toolbar}>
        <input
          type="text"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="메모 (선택)"
          aria-label="캡처 메모"
          disabled={sendBusy}
          style={{
            flex: "1 1 200px",
            minWidth: 160,
            maxWidth: 420,
            fontSize: 13,
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
          }}
        />
        <button type="button" style={btn()} onClick={resetSelection} disabled={sendBusy}>
          다시 선택
        </button>
        <button
          type="button"
          data-testid="preview-area-capture-send"
          style={btn(true)}
          disabled={!canSend || sendBusy || props.busy}
          onClick={() => void onSendClick()}
        >
          대화입력창에 추가
        </button>
        <button type="button" style={btn()} onClick={props.onClose} disabled={sendBusy}>
          닫기
        </button>
      </div>
      <div style={frame} ref={frameRef}>
        <div style={imgWrap} {...bindDragSurface}>
          <img
            ref={imgRef}
            src={props.imageUrl}
            alt="Preview 캡처 미리보기"
            style={{
              display: "block",
              maxWidth: "100%",
              maxHeight: "calc(100vh - 160px)",
              width: "auto",
              height: "auto",
            }}
            draggable={false}
          />
          {liveSelection ? (
            <div
              style={{
                ...shade,
                left: liveSelection.x,
                top: liveSelection.y,
                width: liveSelection.width,
                height: liveSelection.height,
              }}
            />
          ) : null}
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 12, color: "#e2e8f0", flexShrink: 0 }}>
        드래그로 영역을 지정한 뒤 「대화입력창에 추가」를 누르세요. Esc로 닫을 수 있습니다.
      </p>
    </div>
  );
}
