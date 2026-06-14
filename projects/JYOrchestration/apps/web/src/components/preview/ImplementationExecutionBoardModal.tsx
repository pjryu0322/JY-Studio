"use client";

import { useEffect, type CSSProperties, type ReactNode } from "react";

const overlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 58,
  background: "rgba(15, 23, 42, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const panel: CSSProperties = {
  width: "min(1200px, 100%)",
  maxHeight: "min(92vh, 900px)",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  borderRadius: 16,
  background: "#fafbfc",
  boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.35)",
  border: "1px solid #e2e8f0",
};

export function ImplementationExecutionBoardModal(props: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly ariaLabel?: string;
}): ReactNode {
  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        props.onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.open, props.onClose]);

  if (!props.open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={props.ariaLabel ?? "개발 현황판"}
      data-testid="implementation-execution-board-modal"
      style={overlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div style={panel} onMouseDown={(e) => e.stopPropagation()}>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {props.children}
        </div>
      </div>
    </div>
  );
}
