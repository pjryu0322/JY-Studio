"use client";

import { useCallback, useEffect, useRef, useState, type CanvasHTMLAttributes, type Dispatch, type PointerEvent, type SetStateAction } from "react";
import type { PreviewCaptureRegion } from "@/lib/prototype/capturePreviewRegionToClipboard";
import {
  clampPointInRegion,
  getLocalPointFromPointerEvent,
} from "@/lib/preview/previewCapturePointerUtils";
import {
  buildAnnotationStyle,
  emptyPreviewCaptureAnnotationDocument,
  isPreviewCaptureShapeTool,
  isPreviewCaptureStrokeTool,
  PREVIEW_CAPTURE_ERASER_SIZE,
  removeAnnotationsHitByEraser,
  type AnnotationColor,
  type AnnotationStrokeWidth,
  type PreviewCaptureAnnotationDocument,
  type PreviewCaptureShape,
  type PreviewCaptureStroke,
  type PreviewCaptureTool,
} from "@/lib/preview/previewCaptureAnnotationModel";

function newAnnotationId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `ann-${Date.now()}`;
}

export function usePreviewCaptureAnnotationDrawing(input: {
  readonly disabled?: boolean;
  readonly region: PreviewCaptureRegion | null;
  readonly activeColor: AnnotationColor;
  readonly strokeWidth: AnnotationStrokeWidth;
}): Readonly<{
  readonly activeTool: PreviewCaptureTool;
  readonly setActiveTool: (tool: PreviewCaptureTool) => void;
  readonly annotations: PreviewCaptureAnnotationDocument;
  readonly setAnnotations: Dispatch<SetStateAction<PreviewCaptureAnnotationDocument>>;
  readonly draftStroke: PreviewCaptureStroke | null;
  readonly draftShape: PreviewCaptureShape | null;
  readonly clearAllAnnotations: () => void;
  readonly resetAnnotationDrawingState: () => void;
  readonly bindAnnotationCanvas: CanvasHTMLAttributes<HTMLCanvasElement>;
}> {
  const [activeTool, setActiveTool] = useState<PreviewCaptureTool>("pen");
  const [annotations, setAnnotations] = useState<PreviewCaptureAnnotationDocument>(() =>
    emptyPreviewCaptureAnnotationDocument(),
  );
  const [draftStroke, setDraftStroke] = useState<PreviewCaptureStroke | null>(null);
  const [draftShape, setDraftShape] = useState<PreviewCaptureShape | null>(null);
  const [eraserPoints, setEraserPoints] = useState<readonly { x: number; y: number }[]>([]);

  const draftStrokeRef = useRef<PreviewCaptureStroke | null>(null);
  const draftShapeRef = useRef<PreviewCaptureShape | null>(null);
  const eraserPointsRef = useRef<readonly { x: number; y: number }[]>([]);
  const activePointerRef = useRef<number | null>(null);
  const isDrawingRef = useRef(false);
  const styleInputRef = useRef({ color: input.activeColor, strokeWidth: input.strokeWidth });
  styleInputRef.current = { color: input.activeColor, strokeWidth: input.strokeWidth };

  useEffect(() => {
    draftStrokeRef.current = draftStroke;
  }, [draftStroke]);
  useEffect(() => {
    draftShapeRef.current = draftShape;
  }, [draftShape]);
  useEffect(() => {
    eraserPointsRef.current = eraserPoints;
  }, [eraserPoints]);

  const resetAnnotationDrawingState = useCallback(() => {
    activePointerRef.current = null;
    isDrawingRef.current = false;
    setDraftStroke(null);
    setDraftShape(null);
    setEraserPoints([]);
  }, []);

  const clearAllAnnotations = useCallback(() => {
    setAnnotations(emptyPreviewCaptureAnnotationDocument());
    resetAnnotationDrawingState();
  }, [resetAnnotationDrawingState]);

  const finishEraser = useCallback((points: readonly { x: number; y: number }[]) => {
    if (!points.length) return;
    setAnnotations((prev) => ({
      items: removeAnnotationsHitByEraser(prev.items, points, PREVIEW_CAPTURE_ERASER_SIZE),
    }));
    setEraserPoints([]);
  }, []);

  const commitCurrentGesture = useCallback(() => {
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

    isDrawingRef.current = false;
    activePointerRef.current = null;
  }, [finishEraser]);

  const localPointInRegion = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      if (!input.region) return null;
      const raw = getLocalPointFromPointerEvent(event);
      return clampPointInRegion(raw, input.region);
    },
    [input.region],
  );

  const bindAnnotationCanvas: CanvasHTMLAttributes<HTMLCanvasElement> = {
    onPointerDown: (e) => {
      if (!input.region || input.disabled || e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      activePointerRef.current = e.pointerId;
      isDrawingRef.current = true;
      const p = localPointInRegion(e);
      if (!p) return;
      const { color, strokeWidth } = styleInputRef.current;
      if (isPreviewCaptureStrokeTool(activeTool)) {
        setDraftStroke({
          id: newAnnotationId(),
          tool: activeTool,
          points: [p],
          style: buildAnnotationStyle(activeTool, color, strokeWidth),
        });
      } else if (activeTool === "eraser") {
        setEraserPoints([p]);
      } else if (isPreviewCaptureShapeTool(activeTool)) {
        setDraftShape({
          id: newAnnotationId(),
          tool: activeTool,
          start: p,
          end: p,
          style: buildAnnotationStyle(activeTool, color, strokeWidth),
        });
      }
    },
    onPointerMove: (e) => {
      if (!input.region || input.disabled || activePointerRef.current !== e.pointerId || !isDrawingRef.current) {
        return;
      }
      const p = localPointInRegion(e);
      if (!p) return;
      if (draftStrokeRef.current) {
        setDraftStroke((prev) => (prev ? { ...prev, points: [...prev.points, p] } : prev));
      } else if (draftShapeRef.current) {
        setDraftShape((prev) => (prev ? { ...prev, end: p } : prev));
      } else if (eraserPointsRef.current.length) {
        setEraserPoints((prev) => [...prev, p]);
      }
    },
    onPointerUp: (e) => {
      if (activePointerRef.current !== e.pointerId) return;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      commitCurrentGesture();
    },
    onPointerCancel: (e) => {
      if (activePointerRef.current !== e.pointerId) return;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      resetAnnotationDrawingState();
    },
    onPointerLeave: (e) => {
      if (activePointerRef.current !== e.pointerId || !isDrawingRef.current) return;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) return;
      commitCurrentGesture();
    },
  };

  return {
    activeTool,
    setActiveTool,
    annotations,
    setAnnotations,
    draftStroke,
    draftShape,
    clearAllAnnotations,
    resetAnnotationDrawingState,
    bindAnnotationCanvas,
  };
}
