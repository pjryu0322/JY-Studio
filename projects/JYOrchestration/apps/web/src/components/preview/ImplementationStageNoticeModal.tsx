"use client";

import type { CSSProperties } from "react";

const overlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 55,
  background: "rgba(15, 23, 42, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const panel: CSSProperties = {
  width: "min(520px, 100%)",
  maxHeight: "min(80vh, 640px)",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  borderRadius: 16,
  background: "#fff",
  boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.25)",
  border: "1px solid #e2e8f0",
};

export function ImplementationStageNoticeModal({
  open,
  title = "구현 진행 안내",
  body,
  actionLabels,
  onAction,
  onClose,
}: Readonly<{
  readonly open: boolean;
  readonly title?: string;
  readonly body: string;
  readonly actionLabels?: readonly string[];
  readonly onAction?: (label: string) => void;
  readonly onClose: () => void;
}>) {
  if (!open) return null;
  const trimmed = String(body ?? "").trim();
  const actions = (actionLabels ?? []).filter((l) => String(l ?? "").trim());

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="implementation-stage-notice-title"
      data-testid="implementation-stage-notice-modal"
      style={overlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={panel}>
        <div
          style={{
            padding: "18px 20px 12px",
            borderBottom: "1px solid #e2e8f0",
            flexShrink: 0,
          }}
        >
          <h2
            id="implementation-stage-notice-title"
            style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#0f172a" }}
          >
            {title}
          </h2>
        </div>
        {trimmed ? (
          <div
            style={{
              padding: "16px 20px",
              overflowY: "auto",
              fontSize: 14,
              lineHeight: 1.55,
              color: "#334155",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {trimmed}
          </div>
        ) : null}
        {actions.length > 0 ? (
          <div
            style={{
              padding: "0 20px 12px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {actions.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => onAction?.(label)}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #cbd5e1",
                  background: "#f8fafc",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  color: "#1e293b",
                  textAlign: "left",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
        <div
          style={{
            padding: "12px 20px 18px",
            borderTop: actions.length || trimmed ? "1px solid #e2e8f0" : undefined,
            display: "flex",
            justifyContent: "flex-end",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 18px",
              borderRadius: 8,
              border: "1px solid #2563eb",
              background: "#2563eb",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              color: "#fff",
            }}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
