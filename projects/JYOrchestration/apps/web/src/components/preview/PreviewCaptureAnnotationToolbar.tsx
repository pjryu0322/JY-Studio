"use client";

import type { CSSProperties, ReactNode } from "react";
import type { PreviewCaptureTool } from "@/lib/preview/previewCaptureAnnotationModel";

export type PreviewCaptureAnnotationToolbarProps = Readonly<{
  readonly activeTool: PreviewCaptureTool;
  readonly onToolChange: (tool: PreviewCaptureTool) => void;
  readonly onClearAll: () => void;
  readonly toolsEnabled: boolean;
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
});

const toolbarStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  justifyContent: "flex-start",
  flexShrink: 0,
  alignItems: "center",
  overflowX: "auto",
  maxWidth: "100%",
  WebkitOverflowScrolling: "touch",
};

export function PreviewCaptureAnnotationToolbar(props: PreviewCaptureAnnotationToolbarProps): ReactNode {
  const toolBtn = (tool: PreviewCaptureTool, label: string) => (
    <button
      key={tool}
      type="button"
      data-testid={`preview-capture-tool-${tool}`}
      style={toolBtnStyle(props.activeTool === tool, props.disabled || !props.toolsEnabled)}
      disabled={props.disabled || !props.toolsEnabled}
      onClick={() => props.onToolChange(tool)}
    >
      {label}
    </button>
  );

  return (
    <div style={toolbarStyle} data-testid="preview-capture-annotation-toolbar">
      {toolBtn("pen", "펜")}
      {toolBtn("arrow", "화살표")}
      {toolBtn("rect", "사각형")}
      {toolBtn("eraser", "지우개")}
      <button
        type="button"
        data-testid="preview-capture-clear-annotations"
        style={toolBtnStyle(false, props.disabled || !props.canClearAll)}
        disabled={props.disabled || !props.canClearAll}
        onClick={props.onClearAll}
      >
        전체 지우기
      </button>
      {props.trailingActions}
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
  };
}
