"use client";

import type { CSSProperties, KeyboardEventHandler, ReactNode } from "react";

interface InlineFormContainerProps {
  children: ReactNode;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  margin?: string;
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
}

export default function InlineFormContainer({
  children,
  onSubmit,
  onCancel,
  submitLabel = "저장",
  cancelLabel = "취소",
  margin = "6px 0 4px 14px",
  onKeyDown,
}: InlineFormContainerProps) {
  const wrapStyle: CSSProperties = {
    margin,
    display: "flex",
    gap: 6,
    alignItems: "center",
    padding: 6,
    border: "1px solid #e3e3e3",
    borderRadius: 6,
    background: "#fafafa",
  };

  return (
    <div style={wrapStyle} onKeyDown={onKeyDown}>
      {children}
      <button type="button" onClick={onSubmit} style={{ fontSize: 11 }}>
        {submitLabel}
      </button>
      <button type="button" onClick={onCancel} style={{ fontSize: 11 }}>
        {cancelLabel}
      </button>
    </div>
  );
}
