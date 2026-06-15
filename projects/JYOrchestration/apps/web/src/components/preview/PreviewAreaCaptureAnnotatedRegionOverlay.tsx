"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { exportAnnotatedPreviewRegionCapture } from "@/lib/preview/previewCaptureAnnotationExport";
import { PREVIEW_CAPTURE_POINTER_SURFACE_STYLE } from "@/lib/preview/previewCapturePointerUtils";
import {
  annotationToolSummary,
  emptyPreviewCaptureAnnotationDocument,
} from "@/lib/preview/previewCaptureAnnotationModel";
import { PreviewCaptureAnnotationCanvas } from "@/components/preview/PreviewCaptureAnnotationCanvas";
import {
  PreviewCaptureAnnotationToolbar,
  previewCaptureOverlayActionBtnStyle,
} from "@/components/preview/PreviewCaptureAnnotationToolbar";
import { usePreviewCaptureAnnotationDrawing } from "@/components/preview/usePreviewCaptureAnnotationDrawing";
import { usePreviewCaptureRegionSelection } from "@/components/preview/usePreviewCaptureRegionSelection";
import type { PreviewAreaCaptureSendInput } from "@/components/preview/previewAreaCaptureSendTypes";

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
  const [imgSize, setImgSize] = useState({ width: 0, height: 0 });
  const [actionBusy, setActionBusy] = useState(false);

  const regionSel = usePreviewCaptureRegionSelection({
    disabled: props.busy || actionBusy,
    surfaceWidth: imgSize.width,
    surfaceHeight: imgSize.height,
  });

  const ann = usePreviewCaptureAnnotationDrawing({
    disabled: props.busy || actionBusy,
    region: regionSel.selectionLocked,
  });

  useEffect(() => {
    if (regionSel.selectionLocked) {
      ann.setActiveTool("pen");
      ann.resetAnnotationDrawingState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lock transition only
  }, [regionSel.selectionLocked]);

  const syncImageSize = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    setImgSize({ width: img.clientWidth, height: img.clientHeight });
    setImgRevision((n) => n + 1);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        ann.resetAnnotationDrawingState();
        props.onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ann, props]);

  const computeScale = useCallback(() => {
    const img = imgRef.current;
    if (!img || !img.naturalWidth || !img.clientWidth) return { scaleX: 1, scaleY: 1 };
    return { scaleX: img.naturalWidth / img.clientWidth, scaleY: img.naturalHeight / img.clientHeight };
  }, []);

  const resetAll = useCallback(() => {
    ann.resetAnnotationDrawingState();
    ann.setAnnotations(emptyPreviewCaptureAnnotationDocument());
    regionSel.resetSelection();
  }, [ann, regionSel]);

  const buildSendInput = useCallback(async (): Promise<PreviewAreaCaptureSendInput | null> => {
    const region = regionSel.selectionLocked ?? regionSel.liveSelection;
    if (!region) return null;
    ann.resetAnnotationDrawingState();
    const { scaleX, scaleY } = computeScale();
    const annotatedImageDataUrl = await exportAnnotatedPreviewRegionCapture({
      imageDataUrl: props.imageUrl,
      region,
      scaleX,
      scaleY,
      annotations: ann.annotations,
    });
    return {
      region,
      scaleX,
      scaleY,
      annotatedImageDataUrl,
      hasAnnotations: ann.annotations.items.length > 0,
      annotationToolSummary: annotationToolSummary(ann.annotations.items),
    };
  }, [ann, computeScale, props.imageUrl, regionSel]);

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
        regionSel.resetSelection();
      } finally {
        setActionBusy(false);
      }
    },
    [actionBusy, buildSendInput, ann, props.busy, regionSel],
  );

  const locked = regionSel.selectionLocked;
  const live = regionSel.liveSelection;
  const canAct = Boolean(locked ?? live);

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

  const frame: CSSProperties = {
    flex: 1,
    minHeight: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "auto",
  };

  const imgWrap: CSSProperties = {
    position: "relative",
    maxWidth: "100%",
    maxHeight: "100%",
    ...PREVIEW_CAPTURE_POINTER_SURFACE_STYLE,
    cursor: locked ? "default" : "crosshair",
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
        onClearAll={() => ann.clearAllAnnotations()}
        toolsEnabled={Boolean(locked)}
        canClearAll={Boolean(locked && ann.annotations.items.length > 0)}
        disabled={props.busy || actionBusy}
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
              style={previewCaptureOverlayActionBtnStyle(false, actionBusy)}
              onClick={resetAll}
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
        <div style={imgWrap} {...(locked ? {} : regionSel.bindSelectionSurface)}>
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
              visibility: locked ? "hidden" : "visible",
            }}
            draggable={false}
          />
          {!locked && live ? (
            <div style={{ ...shade, left: live.x, top: live.y, width: live.width, height: live.height }} />
          ) : null}
          {locked ? (
            <PreviewCaptureAnnotationCanvas
              canvasRef={canvasRef}
              imgRef={imgRef}
              region={locked}
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
        {locked
          ? "펜·화살표·사각형으로 표시한 뒤 버튼을 누르세요. 설명은 구현단계 대화입력창에서 작성합니다."
          : "드래그로 영역을 지정하세요. Esc로 닫을 수 있습니다."}
      </p>
    </div>
  );
}
