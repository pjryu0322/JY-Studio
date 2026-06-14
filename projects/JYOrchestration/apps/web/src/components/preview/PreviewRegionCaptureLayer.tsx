"use client";

import { useCallback, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  capturePreviewRegionToClipboard,
  PreviewRegionCaptureError,
  PREVIEW_CLIPBOARD_COPY_SUCCESS_MESSAGE,
  type PreviewCaptureRegion,
} from "@/lib/prototype/capturePreviewRegionToClipboard";

const MIN_SIZE = 6;

type Point = Readonly<{ readonly x: number; readonly y: number }>;

export function PreviewRegionCaptureLayer(props: {
  readonly active: boolean;
  readonly iframeRef: React.RefObject<HTMLIFrameElement | null>;
  readonly onCaptureDone: () => void;
  readonly onCaptureError: (message: string) => void;
  readonly onCaptureSuccess: (message: string) => void;
}): ReactNode {
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [dragCurrent, setDragCurrent] = useState<Point | null>(null);
  const busyRef = useRef(false);

  const reset = useCallback(() => {
    setDragStart(null);
    setDragCurrent(null);
  }, []);

  const localPoint = useCallback((e: React.MouseEvent<HTMLDivElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(rect.width, e.clientX - rect.left)),
      y: Math.max(0, Math.min(rect.height, e.clientY - rect.top)),
    };
  }, []);

  const selection = ((): PreviewCaptureRegion | null => {
    if (!dragStart || !dragCurrent) return null;
    const x = Math.min(dragStart.x, dragCurrent.x);
    const y = Math.min(dragStart.y, dragCurrent.y);
    const width = Math.abs(dragCurrent.x - dragStart.x);
    const height = Math.abs(dragCurrent.y - dragStart.y);
    if (width < MIN_SIZE || height < MIN_SIZE) return null;
    return { x, y, width, height };
  })();

  const finishCapture = useCallback(
    async (region: PreviewCaptureRegion) => {
      const iframe = props.iframeRef.current;
      if (!iframe || busyRef.current) return;
      busyRef.current = true;
      try {
        await capturePreviewRegionToClipboard({ iframe, region });
        props.onCaptureSuccess(PREVIEW_CLIPBOARD_COPY_SUCCESS_MESSAGE);
      } catch (err) {
        const message =
          err instanceof PreviewRegionCaptureError
            ? err.message
            : "캡처 중 오류가 발생했습니다.";
        props.onCaptureError(message);
      } finally {
        busyRef.current = false;
        reset();
        props.onCaptureDone();
      }
    },
    [props, reset],
  );

  if (!props.active) return null;

  const overlay: CSSProperties = {
    position: "absolute",
    inset: 0,
    cursor: "crosshair",
    zIndex: 4,
    touchAction: "none",
  };

  const shade: CSSProperties = {
    position: "absolute",
    border: "2px solid #0ea5e9",
    background: "rgba(14, 165, 233, 0.12)",
    boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.35)",
    pointerEvents: "none",
  };

  return (
    <div
      role="presentation"
      data-testid="preview-region-capture-layer"
      style={overlay}
      onMouseDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        setDragStart(localPoint(e));
        setDragCurrent(localPoint(e));
      }}
      onMouseMove={(e) => {
        if (!dragStart) return;
        setDragCurrent(localPoint(e));
      }}
      onMouseUp={(e) => {
        if (!dragStart) return;
        const end = localPoint(e);
        const x = Math.min(dragStart.x, end.x);
        const y = Math.min(dragStart.y, end.y);
        const width = Math.abs(end.x - dragStart.x);
        const height = Math.abs(end.y - dragStart.y);
        reset();
        if (width >= MIN_SIZE && height >= MIN_SIZE) {
          void finishCapture({ x, y, width, height });
        }
      }}
      onMouseLeave={() => {
        if (dragStart) reset();
      }}
    >
      {selection ? (
        <div
          style={{
            ...shade,
            left: selection.x,
            top: selection.y,
            width: selection.width,
            height: selection.height,
          }}
        />
      ) : null}
    </div>
  );
}
