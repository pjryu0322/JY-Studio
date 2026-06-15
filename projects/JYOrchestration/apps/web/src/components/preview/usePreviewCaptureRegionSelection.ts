"use client";

import { useCallback, useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react";
import type { PreviewCaptureRegion } from "@/lib/prototype/capturePreviewRegionToClipboard";
import {
  clampPointInSize,
  getLocalPointFromPointerEvent,
  type PreviewCaptureLocalPoint,
} from "@/lib/preview/previewCapturePointerUtils";

export const PREVIEW_CAPTURE_REGION_MIN_SIZE = 6;

export function usePreviewCaptureRegionSelection(input: {
  readonly disabled?: boolean;
  readonly surfaceWidth: number;
  readonly surfaceHeight: number;
  readonly onSelectionLocked?: (region: PreviewCaptureRegion) => void;
  readonly onReset?: () => void;
}): Readonly<{
  readonly selectionLocked: PreviewCaptureRegion | null;
  readonly liveSelection: PreviewCaptureRegion | null;
  readonly resetSelection: () => void;
  readonly bindSelectionSurface: HTMLAttributes<HTMLDivElement>;
}> {
  const [dragStart, setDragStart] = useState<PreviewCaptureLocalPoint | null>(null);
  const [dragCurrent, setDragCurrent] = useState<PreviewCaptureLocalPoint | null>(null);
  const [selectionLocked, setSelectionLocked] = useState<PreviewCaptureRegion | null>(null);
  const activePointerRef = useRef<number | null>(null);

  const resetSelection = useCallback(() => {
    activePointerRef.current = null;
    setDragStart(null);
    setDragCurrent(null);
    setSelectionLocked(null);
    input.onReset?.();
  }, [input]);

  const liveSelection = ((): PreviewCaptureRegion | null => {
    if (selectionLocked) return selectionLocked;
    if (!dragStart || !dragCurrent) return null;
    const x = Math.min(dragStart.x, dragCurrent.x);
    const y = Math.min(dragStart.y, dragCurrent.y);
    const width = Math.abs(dragCurrent.x - dragStart.x);
    const height = Math.abs(dragCurrent.y - dragStart.y);
    if (width < PREVIEW_CAPTURE_REGION_MIN_SIZE || height < PREVIEW_CAPTURE_REGION_MIN_SIZE) return null;
    return { x, y, width, height };
  })();

  const finishDrag = useCallback(
    (end: PreviewCaptureLocalPoint | null) => {
      activePointerRef.current = null;
      if (!dragStart) return;
      if (!end) {
        setDragStart(null);
        setDragCurrent(null);
        return;
      }
      const x = Math.min(dragStart.x, end.x);
      const y = Math.min(dragStart.y, end.y);
      const width = Math.abs(end.x - dragStart.x);
      const height = Math.abs(end.y - dragStart.y);
      setDragStart(null);
      setDragCurrent(null);
      if (width >= PREVIEW_CAPTURE_REGION_MIN_SIZE && height >= PREVIEW_CAPTURE_REGION_MIN_SIZE) {
        const region = { x, y, width, height };
        setSelectionLocked(region);
        input.onSelectionLocked?.(region);
      }
    },
    [dragStart, input],
  );

  const bindSelectionSurface: HTMLAttributes<HTMLDivElement> = {
    onPointerDown: (e) => {
      if (selectionLocked || input.disabled || e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      activePointerRef.current = e.pointerId;
      const p = clampPointInSize(getLocalPointFromPointerEvent(e), input.surfaceWidth, input.surfaceHeight);
      setDragStart(p);
      setDragCurrent(p);
    },
    onPointerMove: (e) => {
      if (selectionLocked || !dragStart || input.disabled || activePointerRef.current !== e.pointerId) return;
      const p = clampPointInSize(getLocalPointFromPointerEvent(e), input.surfaceWidth, input.surfaceHeight);
      setDragCurrent(p);
    },
    onPointerUp: (e) => {
      if (activePointerRef.current !== e.pointerId) return;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      const p = clampPointInSize(getLocalPointFromPointerEvent(e), input.surfaceWidth, input.surfaceHeight);
      finishDrag(p);
    },
    onPointerCancel: (e) => {
      if (activePointerRef.current !== e.pointerId) return;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      setDragStart(null);
      setDragCurrent(null);
      activePointerRef.current = null;
    },
    onPointerLeave: (e) => {
      if (activePointerRef.current !== e.pointerId || selectionLocked) return;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) return;
      setDragStart(null);
      setDragCurrent(null);
      activePointerRef.current = null;
    },
  };

  return { selectionLocked, liveSelection, resetSelection, bindSelectionSurface };
}
