"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { PreviewCaptureRegion } from "@/lib/prototype/capturePreviewRegionToClipboard";
import { exportAnnotatedPreviewRegionCapture } from "@/lib/preview/previewCaptureAnnotationExport";
import {
  annotationToolSummary,
  emptyPreviewCaptureAnnotationDocument,
  paintArrow,
  paintPreviewCaptureAnnotations,
  paintRect,
  PREVIEW_CAPTURE_ANNOTATION_DEFAULT_COLOR,
  PREVIEW_CAPTURE_ANNOTATION_DEFAULT_SIZE,
  PREVIEW_CAPTURE_ERASER_SIZE,
  removeAnnotationsHitByEraser,
  type PreviewCaptureAnnotationDocument,
  type PreviewCaptureShape,
  type PreviewCaptureStroke,
  type PreviewCaptureTool,
} from "@/lib/preview/previewCaptureAnnotationModel";

const MIN_SIZE = 6;

type Point = Readonly<{ readonly x: number; readonly y: number }>;

export type PreviewAreaCaptureSendInput = Readonly<{
  readonly region: PreviewCaptureRegion;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly annotatedImageDataUrl: string;
  readonly hasAnnotations: boolean;
  readonly annotationToolSummary: readonly PreviewCaptureTool[];
}>;

export function PreviewAreaCaptureSendOverlay(props: {
  readonly imageUrl: string;
  readonly busy?: boolean;
  readonly onClose: () => void;
  readonly onSend: (input: PreviewAreaCaptureSendInput) => Promise<void>;
}): ReactNode {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [dragCurrent, setDragCurrent] = useState<Point | null>(null);
  const [selectionLocked, setSelectionLocked] = useState<PreviewCaptureRegion | null>(null);
  const [sendBusy, setSendBusy] = useState(false);
  const [activeTool, setActiveTool] = useState<PreviewCaptureTool>("pen");
  const [annotations, setAnnotations] = useState<PreviewCaptureAnnotationDocument>(() =>
    emptyPreviewCaptureAnnotationDocument(),
  );
  const [draftStroke, setDraftStroke] = useState<PreviewCaptureStroke | null>(null);
  const [draftShape, setDraftShape] = useState<PreviewCaptureShape | null>(null);
  const [eraserPoints, setEraserPoints] = useState<readonly Point[]>([]);
  const [imgRevision, setImgRevision] = useState(0);
  const draftStrokeRef = useRef<PreviewCaptureStroke | null>(null);
  const draftShapeRef = useRef<PreviewCaptureShape | null>(null);
  const eraserPointsRef = useRef<readonly Point[]>([]);

  useEffect(() => {
    draftStrokeRef.current = draftStroke;
  }, [draftStroke]);
  useEffect(() => {
    draftShapeRef.current = draftShape;
  }, [draftShape]);
  useEffect(() => {
    eraserPointsRef.current = eraserPoints;
  }, [eraserPoints]);

  const resetSelection = useCallback(() => {
    setDragStart(null);
    setDragCurrent(null);
    setSelectionLocked(null);
    setAnnotations(emptyPreviewCaptureAnnotationDocument());
    setDraftStroke(null);
    setDraftShape(null);
    setEraserPoints([]);
  }, []);

  const clearAllAnnotations = useCallback(() => {
    setAnnotations(emptyPreviewCaptureAnnotationDocument());
    setDraftStroke(null);
    setDraftShape(null);
    setEraserPoints([]);
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

  const localPointInRegion = useCallback(
    (clientX: number, clientY: number): Point | null => {
      const canvas = canvasRef.current;
      if (!canvas || !selectionLocked) return null;
      const rect = canvas.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(selectionLocked.width, clientX - rect.left)),
        y: Math.max(0, Math.min(selectionLocked.height, clientY - rect.top)),
      };
    },
    [selectionLocked],
  );

  const localPointOnImage = useCallback((clientX: number, clientY: number): Point | null => {
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

  const repaintAnnotationCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    const region = selectionLocked;
    if (!canvas || !img || !region || !img.naturalWidth) return;

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvas.width = Math.max(1, Math.round(region.width * dpr));
    canvas.height = Math.max(1, Math.round(region.height * dpr));
    canvas.style.width = `${region.width}px`;
    canvas.style.height = `${region.height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, region.width, region.height);

    const { scaleX, scaleY } = computeScale();
    const sx = region.x * scaleX;
    const sy = region.y * scaleY;
    const sw = region.width * scaleX;
    const sh = region.height * scaleY;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, region.width, region.height);

    paintPreviewCaptureAnnotations(ctx, annotations.items, 1);
    if (draftStroke && draftStroke.points.length >= 2) {
      paintPreviewCaptureAnnotations(ctx, [draftStroke], 1);
    }
    if (draftShape) {
      if (draftShape.tool === "arrow") {
        paintArrow(ctx, draftShape.start, draftShape.end, draftShape.size, draftShape.color);
      } else {
        paintRect(ctx, draftShape.start, draftShape.end, draftShape.size, draftShape.color);
      }
    }
  }, [annotations.items, computeScale, draftShape, draftStroke, selectionLocked]);

  useEffect(() => {
    void repaintAnnotationCanvas();
  }, [repaintAnnotationCanvas, imgRevision]);

  const newId = () =>
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `ann-${Date.now()}`;

  const finishEraser = useCallback(
    (points: readonly Point[]) => {
      if (!points.length) return;
      setAnnotations((prev) => ({
        items: removeAnnotationsHitByEraser(prev.items, points, PREVIEW_CAPTURE_ERASER_SIZE),
      }));
      setEraserPoints([]);
    },
    [],
  );

  const onSendClick = useCallback(async () => {
    const region = selectionLocked ?? liveSelection;
    if (!region || sendBusy || props.busy) return;
    setSendBusy(true);
    try {
      const { scaleX, scaleY } = computeScale();
      const annotatedImageDataUrl = await exportAnnotatedPreviewRegionCapture({
        imageDataUrl: props.imageUrl,
        region,
        scaleX,
        scaleY,
        annotations,
      });
      const summary = annotationToolSummary(annotations.items);
      await props.onSend({
        region,
        scaleX,
        scaleY,
        annotatedImageDataUrl,
        hasAnnotations: annotations.items.length > 0,
        annotationToolSummary: summary,
      });
    } finally {
      setSendBusy(false);
    }
  }, [selectionLocked, liveSelection, sendBusy, props, computeScale, annotations]);

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
    justifyContent: "flex-start",
    flexShrink: 0,
    alignItems: "center",
  };

  const btn = (primary?: boolean, active?: boolean): CSSProperties => ({
    fontSize: 13,
    padding: "8px 14px",
    borderRadius: 8,
    border: primary || active ? "1px solid #0f172a" : "1px solid #cbd5e1",
    background: primary ? "#0f172a" : active ? "#e2e8f0" : "#fff",
    color: primary ? "#fff" : "#0f172a",
    cursor: "pointer",
    opacity: props.busy || sendBusy ? 0.7 : 1,
  });

  const toolBtn = (tool: PreviewCaptureTool, label: string) => (
    <button
      key={tool}
      type="button"
      data-testid={`preview-capture-tool-${tool}`}
      style={btn(false, activeTool === tool)}
      disabled={!selectionLocked || sendBusy}
      onClick={() => setActiveTool(tool)}
    >
      {label}
    </button>
  );

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
    cursor: selectionLocked ? "default" : "crosshair",
  };

  const shade: CSSProperties = {
    position: "absolute",
    border: "2px solid #0ea5e9",
    background: "rgba(14, 165, 233, 0.15)",
    boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.45)",
    pointerEvents: "none",
  };

  const canSend = Boolean(selectionLocked ?? liveSelection);

  const bindSelectionSurface = {
    onMouseDown: (e: React.MouseEvent) => {
      if (selectionLocked || e.button !== 0 || sendBusy) return;
      e.preventDefault();
      const p = localPointOnImage(e.clientX, e.clientY);
      if (!p) return;
      setDragStart(p);
      setDragCurrent(p);
    },
    onMouseMove: (e: React.MouseEvent) => {
      if (selectionLocked || !dragStart || sendBusy) return;
      const p = localPointOnImage(e.clientX, e.clientY);
      if (p) setDragCurrent(p);
    },
    onMouseUp: (e: React.MouseEvent) => {
      if (selectionLocked || !dragStart || sendBusy) return;
      const end = localPointOnImage(e.clientX, e.clientY);
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
        setActiveTool("pen");
      }
    },
  };

  const bindAnnotationSurface = {
    onMouseDown: (e: React.MouseEvent) => {
      if (!selectionLocked || e.button !== 0 || sendBusy) return;
      e.preventDefault();
      e.stopPropagation();
      const p = localPointInRegion(e.clientX, e.clientY);
      if (!p) return;
      if (activeTool === "pen") {
        setDraftStroke({
          id: newId(),
          tool: "pen",
          points: [p],
          size: PREVIEW_CAPTURE_ANNOTATION_DEFAULT_SIZE,
          color: PREVIEW_CAPTURE_ANNOTATION_DEFAULT_COLOR,
        });
      } else if (activeTool === "eraser") {
        setEraserPoints([p]);
      } else {
        setDraftShape({
          id: newId(),
          tool: activeTool,
          start: p,
          end: p,
          size: PREVIEW_CAPTURE_ANNOTATION_DEFAULT_SIZE,
          color: PREVIEW_CAPTURE_ANNOTATION_DEFAULT_COLOR,
        });
      }
    },
    onMouseMove: (e: React.MouseEvent) => {
      if (!selectionLocked || sendBusy) return;
      const p = localPointInRegion(e.clientX, e.clientY);
      if (!p) return;
      if (draftStroke) {
        setDraftStroke((prev) => (prev ? { ...prev, points: [...prev.points, p] } : prev));
      } else if (draftShape) {
        setDraftShape((prev) => (prev ? { ...prev, end: p } : prev));
      } else if (eraserPoints.length) {
        setEraserPoints((prev) => [...prev, p]);
      }
    },
    onMouseUp: () => {
      const stroke = draftStrokeRef.current;
      if (stroke && stroke.points.length >= 2) {
        setAnnotations((prev) => ({ items: [...prev.items, stroke] }));
      }
      setDraftStroke(null);
      const shape = draftShapeRef.current;
      if (shape) {
        const dx = Math.abs(shape.end.x - shape.start.x);
        const dy = Math.abs(shape.end.y - shape.start.y);
        if (dx >= 2 || dy >= 2) {
          setAnnotations((prev) => ({ items: [...prev.items, shape] }));
        }
        setDraftShape(null);
      }
      const eraser = eraserPointsRef.current;
      if (eraser.length) finishEraser(eraser);
    },
    onMouseLeave: () => {
      const stroke = draftStrokeRef.current;
      if (stroke && stroke.points.length >= 2) {
        setAnnotations((prev) => ({ items: [...prev.items, stroke] }));
      }
      setDraftStroke(null);
      const shape = draftShapeRef.current;
      if (shape) {
        const dx = Math.abs(shape.end.x - shape.start.x);
        const dy = Math.abs(shape.end.y - shape.start.y);
        if (dx >= 2 || dy >= 2) {
          setAnnotations((prev) => ({ items: [...prev.items, shape] }));
        }
        setDraftShape(null);
      }
      const eraser = eraserPointsRef.current;
      if (eraser.length) finishEraser(eraser);
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
      <div style={toolbar} data-testid="preview-capture-annotation-toolbar">
        {toolBtn("pen", "펜")}
        {toolBtn("arrow", "화살표")}
        {toolBtn("rect", "사각형")}
        {toolBtn("eraser", "지우개")}
        <button
          type="button"
          data-testid="preview-capture-clear-annotations"
          style={btn()}
          disabled={!selectionLocked || sendBusy || annotations.items.length === 0}
          onClick={clearAllAnnotations}
        >
          전체 지우기
        </button>
        <span style={{ flex: 1 }} />
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
        <div style={imgWrap} {...(selectionLocked ? {} : bindSelectionSurface)}>
          <img
            ref={imgRef}
            src={props.imageUrl}
            alt="Preview 캡처 미리보기"
            onLoad={() => setImgRevision((n) => n + 1)}
            style={{
              display: "block",
              maxWidth: "100%",
              maxHeight: "calc(100vh - 160px)",
              width: "auto",
              height: "auto",
              visibility: selectionLocked ? "hidden" : "visible",
            }}
            draggable={false}
          />
          {!selectionLocked && liveSelection ? (
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
          {selectionLocked ? (
            <canvas
              ref={canvasRef}
              data-testid="preview-capture-annotation-canvas"
              style={{
                position: "absolute",
                left: selectionLocked.x,
                top: selectionLocked.y,
                width: selectionLocked.width,
                height: selectionLocked.height,
                cursor: activeTool === "eraser" ? "cell" : "crosshair",
                touchAction: "none",
              }}
              {...bindAnnotationSurface}
            />
          ) : null}
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 12, color: "#e2e8f0", flexShrink: 0 }}>
        {selectionLocked
          ? "펜·화살표·사각형으로 표시한 뒤 「대화입력창에 추가」를 누르세요. 설명은 구현단계 대화입력창에서 작성합니다."
          : "드래그로 영역을 지정하세요. Esc로 닫을 수 있습니다."}
      </p>
    </div>
  );
}
