"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { exportAnnotatedPreviewRegionCapture } from "@/lib/preview/previewCaptureAnnotationExport";
import { PREVIEW_CAPTURE_POINTER_SURFACE_STYLE } from "@/lib/preview/previewCapturePointerUtils";
import {
  annotationStyleSummary,
  annotationToolSummary,
  emptyPreviewCaptureAnnotationDocument,
  PREVIEW_CAPTURE_ANNOTATION_DEFAULT_COLOR,
  PREVIEW_CAPTURE_ANNOTATION_DEFAULT_STROKE_WIDTH,
  type AnnotationColor,
  type AnnotationStrokeWidth,
} from "@/lib/preview/previewCaptureAnnotationModel";
import { PreviewCaptureAnnotationCanvas } from "@/components/preview/PreviewCaptureAnnotationCanvas";
import {
  PreviewCaptureAnnotationToolbar,
  previewCaptureOverlayActionBtnStyle,
} from "@/components/preview/PreviewCaptureAnnotationToolbar";
import { usePreviewCaptureAnnotationDrawing } from "@/components/preview/usePreviewCaptureAnnotationDrawing";
import { usePreviewCaptureRegionSelection } from "@/components/preview/usePreviewCaptureRegionSelection";
import { readFullImageDisplayRegion } from "@/components/preview/previewCaptureFullImageRegion";
import type { PreviewAreaCaptureSendInput } from "@/components/preview/previewAreaCaptureSendTypes";
import type { PreviewCaptureRegion } from "@/lib/prototype/capturePreviewRegionToClipboard";

export type PreviewAreaCaptureAnnotatedRegionOverlayProps = Readonly<{
  readonly testId: string;
  readonly imageUrl: string;
  readonly busy?: boolean;
  readonly onClose: () => void;
  readonly primaryAction: Readonly<{
    readonly testId: string;
    readonly label: string;
    readonly onClick: (input: PreviewAreaCaptureSendInput) => Promise<void>;
  }>;
  readonly secondaryAction?: Readonly<{
    readonly testId: string;
    readonly label: string;
    readonly onClick: (input: PreviewAreaCaptureSendInput) => Promise<void>;
  }>;
}>;

export function PreviewAreaCaptureAnnotatedRegionOverlay(
  props: PreviewAreaCaptureAnnotatedRegionOverlayProps,
): ReactNode {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [imgRevision, setImgRevision] = useState(0);
  const [actionBusy, setActionBusy] = useState(false);
  const [annotationRegion, setAnnotationRegion] = useState<PreviewCaptureRegion | null>(null);
  const [regionSelectActive, setRegionSelectActive] = useState(false);
  const [activeColor, setActiveColor] = useState<AnnotationColor>(PREVIEW_CAPTURE_ANNOTATION_DEFAULT_COLOR);
  const [strokeWidth, setStrokeWidth] = useState<AnnotationStrokeWidth>(
    PREVIEW_CAPTURE_ANNOTATION_DEFAULT_STROKE_WIDTH,
  );
  const onCustomRegionLockedRef = useRef<(region: PreviewCaptureRegion) => void>(() => {});

  const regionSel = usePreviewCaptureRegionSelection({
    disabled: props.busy || actionBusy || !regionSelectActive,
    onSelectionLocked: (region) => onCustomRegionLockedRef.current(region),
  });

  const ann = usePreviewCaptureAnnotationDrawing({
    disabled: props.busy || actionBusy || regionSelectActive || !annotationRegion,
    region: annotationRegion,
    activeColor,
    strokeWidth,
  });

  onCustomRegionLockedRef.current = (region) => {
    setAnnotationRegion(region);
    setRegionSelectActive(false);
    ann.setAnnotations(emptyPreviewCaptureAnnotationDocument());
    ann.resetAnnotationDrawingState();
    regionSel.resetSelection();
  };

  const applyFullImageRegion = useCallback(() => {
    const img = imgRef.current;
    if (!img || img.clientWidth < 1 || img.clientHeight < 1) return;
    setAnnotationRegion(readFullImageDisplayRegion(img));
    setImgRevision((n) => n + 1);
  }, []);

  const syncImageSize = useCallback(() => {
    if (!regionSelectActive) applyFullImageRegion();
    else setImgRevision((n) => n + 1);
  }, [applyFullImageRegion, regionSelectActive]);

  useEffect(() => {
    if (!regionSelectActive && !annotationRegion) applyFullImageRegion();
  }, [annotationRegion, applyFullImageRegion, regionSelectActive]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (regionSelectActive) {
        setRegionSelectActive(false);
        regionSel.resetSelection();
        applyFullImageRegion();
        return;
      }
      ann.resetAnnotationDrawingState();
      props.onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ann, applyFullImageRegion, props, regionSelectActive, regionSel]);

  const computeScale = useCallback(() => {
    const img = imgRef.current;
    if (!img || !img.naturalWidth || !img.clientWidth) return { scaleX: 1, scaleY: 1 };
    return { scaleX: img.naturalWidth / img.clientWidth, scaleY: img.naturalHeight / img.clientHeight };
  }, []);

  const enterRegionSelectMode = useCallback(() => {
    ann.resetAnnotationDrawingState();
    ann.setAnnotations(emptyPreviewCaptureAnnotationDocument());
    regionSel.resetSelection();
    setRegionSelectActive(true);
  }, [ann, regionSel]);

  const buildSendInput = useCallback(async (): Promise<PreviewAreaCaptureSendInput | null> => {
    if (!annotationRegion || regionSelectActive) return null;
    ann.resetAnnotationDrawingState();
    const { scaleX, scaleY } = computeScale();
    const annotatedImageDataUrl = await exportAnnotatedPreviewRegionCapture({
      imageDataUrl: props.imageUrl,
      region: annotationRegion,
      scaleX,
      scaleY,
      annotations: ann.annotations,
    });
    return {
      region: annotationRegion,
      scaleX,
      scaleY,
      annotatedImageDataUrl,
      hasAnnotations: ann.annotations.items.length > 0,
      annotationToolSummary: annotationToolSummary(ann.annotations.items),
      annotationStyleSummary: annotationStyleSummary(ann.annotations.items),
    };
  }, [ann, annotationRegion, computeScale, props.imageUrl, regionSelectActive]);

  const runAction = useCallback(
    async (handler: (input: PreviewAreaCaptureSendInput) => Promise<void>) => {
      if (actionBusy || props.busy) return;
      setActionBusy(true);
      try {
        const payload = await buildSendInput();
        if (!payload) return;
        await handler(payload);
        ann.setAnnotations(emptyPreviewCaptureAnnotationDocument());
        ann.resetAnnotationDrawingState();
        setRegionSelectActive(false);
        regionSel.resetSelection();
        applyFullImageRegion();
      } finally {
        setActionBusy(false);
      }
    },
    [actionBusy, applyFullImageRegion, buildSendInput, ann, props.busy, regionSel],
  );

  const canAct = Boolean(annotationRegion && !regionSelectActive);
  const showAnnotationCanvas = canAct;
  const live = regionSelectActive ? regionSel.liveSelection : null;

  const shell: CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 100,
    background: "rgba(15, 23, 42, 0.72)",
    display: "flex",
    flexDirection: "column",
    padding: 16,
    gap: 12,
    pointerEvents: "auto",
  };

  const frame: CSSProperties = {
    flex: 1,
    minHeight: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "auto",
    position: "relative",
    zIndex: 1,
    pointerEvents: "auto",
  };

  const imgWrap: CSSProperties = {
    position: "relative",
    maxWidth: "100%",
    maxHeight: "100%",
    zIndex: 1,
    ...PREVIEW_CAPTURE_POINTER_SURFACE_STYLE,
    cursor: regionSelectActive ? "crosshair" : "default",
  };

  const shade: CSSProperties = {
    position: "absolute",
    border: "2px solid #0ea5e9",
    background: "rgba(14, 165, 233, 0.15)",
    boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.45)",
    pointerEvents: "none",
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Preview 영역 캡처" data-testid={props.testId} style={shell}>
      <PreviewCaptureAnnotationToolbar
        activeTool={ann.activeTool}
        onToolChange={ann.setActiveTool}
        activeColor={activeColor}
        onColorChange={setActiveColor}
        strokeWidth={strokeWidth}
        onStrokeWidthChange={setStrokeWidth}
        onClearAll={() => ann.clearAllAnnotations()}
        canClearAll={ann.annotations.items.length > 0}
        disabled={props.busy || actionBusy || regionSelectActive}
        trailingActions={
          <>
            <span style={{ flex: 1, minWidth: 8 }} />
            {props.secondaryAction ? (
              <button
                type="button"
                data-testid={props.secondaryAction.testId}
                style={previewCaptureOverlayActionBtnStyle(false, !canAct || actionBusy)}
                disabled={!canAct || actionBusy || props.busy}
                onClick={() => void runAction(props.secondaryAction!.onClick)}
              >
                {props.secondaryAction.label}
              </button>
            ) : null}
            <button
              type="button"
              data-testid="preview-capture-enter-region-select"
              style={previewCaptureOverlayActionBtnStyle(false, actionBusy)}
              onClick={enterRegionSelectMode}
              disabled={actionBusy}
            >
              다시 선택
            </button>
            <button
              type="button"
              data-testid={props.primaryAction.testId}
              style={previewCaptureOverlayActionBtnStyle(true, !canAct || actionBusy)}
              disabled={!canAct || actionBusy || props.busy}
              onClick={() => void runAction(props.primaryAction.onClick)}
            >
              {props.primaryAction.label}
            </button>
            <button
              type="button"
              style={previewCaptureOverlayActionBtnStyle(false, actionBusy)}
              onClick={() => {
                ann.resetAnnotationDrawingState();
                props.onClose();
              }}
              disabled={actionBusy}
            >
              닫기
            </button>
          </>
        }
      />
      <div style={frame}>
        <div
          style={imgWrap}
          data-testid={regionSelectActive ? "preview-capture-region-select-mode" : "preview-capture-annotate-mode"}
          {...(regionSelectActive ? regionSel.bindSelectionSurface : {})}
        >
          <img
            ref={imgRef}
            src={props.imageUrl}
            alt="Preview 캡처 미리보기"
            onLoad={syncImageSize}
            style={{
              display: "block",
              maxWidth: "100%",
              maxHeight: "calc(100vh - 160px)",
              width: "auto",
              height: "auto",
              visibility: showAnnotationCanvas ? "hidden" : "visible",
            }}
            draggable={false}
          />
          {regionSelectActive && live ? (
            <div style={{ ...shade, left: live.x, top: live.y, width: live.width, height: live.height }} />
          ) : null}
          {showAnnotationCanvas && annotationRegion ? (
            <PreviewCaptureAnnotationCanvas
              canvasRef={canvasRef}
              imgRef={imgRef}
              region={annotationRegion}
              annotations={ann.annotations}
              draftStroke={ann.draftStroke}
              draftShape={ann.draftShape}
              activeTool={ann.activeTool}
              bindAnnotationCanvas={ann.bindAnnotationCanvas}
              imgRevision={imgRevision}
            />
          ) : null}
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 12, color: "#e2e8f0" }}>
        {regionSelectActive
          ? "드래그로 영역을 지정하세요. Esc로 선택을 취소합니다."
          : "펜·화살표·사각형으로 표시한 뒤 「대화입력창에 추가」를 누르세요. 영역 변경은 「다시 선택」을 사용합니다."}
      </p>
    </div>
  );
}
