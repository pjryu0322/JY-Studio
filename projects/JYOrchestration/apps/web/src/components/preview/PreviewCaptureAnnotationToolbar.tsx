"use client";

import type { CSSProperties, ReactNode } from "react";
import {
  ANNOTATION_COLOR_OPTIONS,
  ANNOTATION_STROKE_WIDTH_OPTIONS,
  type AnnotationColor,
  type AnnotationStrokeWidth,
  type PreviewCaptureTool,
} from "@/lib/preview/previewCaptureAnnotationModel";

export type PreviewCaptureAnnotationToolbarProps = Readonly<{
  readonly activeTool: PreviewCaptureTool;
  readonly onToolChange: (tool: PreviewCaptureTool) => void;
  readonly activeColor: AnnotationColor;
  readonly onColorChange: (color: AnnotationColor) => void;
  readonly strokeWidth: AnnotationStrokeWidth;
  readonly onStrokeWidthChange: (width: AnnotationStrokeWidth) => void;
  readonly onClearAll: () => void;
  readonly canClearAll: boolean;
  readonly disabled?: boolean;
  readonly trailingActions?: ReactNode;
}>;

const toolBtnStyle = (active: boolean, disabled?: boolean): CSSProperties => ({
  fontSize: 13,
  padding: "10px 14px",
  minHeight: 36,
  minWidth: 36,
  borderRadius: 8,
  border: active ? "1px solid #0f172a" : "1px solid #cbd5e1",
  background: active ? "#e2e8f0" : "#fff",
  color: "#0f172a",
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.65 : 1,
  flexShrink: 0,
  pointerEvents: disabled ? "none" : "auto",
});

const toolbarWrapperStyle: CSSProperties = {
  position: "relative",
  zIndex: 10002,
  pointerEvents: "auto",
  flexShrink: 0,
  isolation: "isolate",
};

const toolbarStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  justifyContent: "flex-start",
  alignItems: "center",
  overflowX: "auto",
  maxWidth: "100%",
  WebkitOverflowScrolling: "touch",
  pointerEvents: "auto",
};

const swatchStyle = (color: string, active: boolean, disabled?: boolean): CSSProperties => ({
  width: 28,
  height: 28,
  borderRadius: 6,
  border: active ? "2px solid #0f172a" : "1px solid #94a3b8",
  background: color,
  boxShadow: color === "#ffffff" ? "inset 0 0 0 1px #cbd5e1" : undefined,
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.65 : 1,
  flexShrink: 0,
  pointerEvents: disabled ? "none" : "auto",
  padding: 0,
});

export function PreviewCaptureAnnotationToolbar(props: PreviewCaptureAnnotationToolbarProps): ReactNode {
  const toolDisabled = Boolean(props.disabled);

  const toolBtn = (tool: PreviewCaptureTool, label: string) => (
    <button
      key={tool}
      type="button"
      data-testid={`preview-capture-tool-${tool}`}
      aria-pressed={props.activeTool === tool}
      style={toolBtnStyle(props.activeTool === tool, toolDisabled)}
      disabled={toolDisabled}
      onClick={() => props.onToolChange(tool)}
    >
      {label}
    </button>
  );

  return (
    <div style={toolbarWrapperStyle} data-testid="preview-capture-annotation-toolbar-wrapper">
      <div style={toolbarStyle} data-testid="preview-capture-annotation-toolbar">
        {toolBtn("pen", "펜")}
        {toolBtn("highlighter", "형광펜")}
        {toolBtn("dashedPen", "점선")}
        {toolBtn("marker", "마커")}
        {toolBtn("arrow", "화살표")}
        {toolBtn("rect", "사각형")}
        {toolBtn("eraser", "지우개")}
        <span
          style={{ width: 1, height: 24, background: "#cbd5e1", flexShrink: 0 }}
          aria-hidden
          data-testid="preview-capture-toolbar-style-divider"
        />
        <div style={{ display: "flex", gap: 6, alignItems: "center" }} data-testid="preview-capture-color-swatches">
          {ANNOTATION_COLOR_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              title={opt.label}
              aria-label={opt.label}
              aria-pressed={props.activeColor === opt.id}
              data-testid={`preview-capture-color-${opt.id.slice(1)}`}
              style={swatchStyle(opt.id, props.activeColor === opt.id, toolDisabled)}
              disabled={toolDisabled}
              onClick={() => props.onColorChange(opt.id)}
            />
          ))}
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }} data-testid="preview-capture-stroke-widths">
          {ANNOTATION_STROKE_WIDTH_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              data-testid={`preview-capture-stroke-width-${opt.value}`}
              aria-pressed={props.strokeWidth === opt.value}
              style={toolBtnStyle(props.strokeWidth === opt.value, toolDisabled)}
              disabled={toolDisabled}
              onClick={() => props.onStrokeWidthChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          data-testid="preview-capture-clear-annotations"
          style={toolBtnStyle(false, toolDisabled || !props.canClearAll)}
          disabled={toolDisabled || !props.canClearAll}
          onClick={props.onClearAll}
        >
          전체 지우기
        </button>
        {props.trailingActions}
      </div>
    </div>
  );
}

export function previewCaptureOverlayActionBtnStyle(primary?: boolean, disabled?: boolean): CSSProperties {
  return {
    fontSize: 13,
    padding: "10px 14px",
    minHeight: 36,
    borderRadius: 8,
    border: primary ? "1px solid #0f172a" : "1px solid #cbd5e1",
    background: primary ? "#0f172a" : "#fff",
    color: primary ? "#fff" : "#0f172a",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.65 : 1,
    flexShrink: 0,
    pointerEvents: disabled ? "none" : "auto",
  };
}
