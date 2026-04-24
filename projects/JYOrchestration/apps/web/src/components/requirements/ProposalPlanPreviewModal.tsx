"use client";

import { useEffect } from "react";
import { RequirementsAiMessageMarkdown } from "@/components/requirements/RequirementsAiMessageMarkdown";

export function ProposalPlanPreviewModal({
  open,
  title,
  markdown,
  busy,
  onClose,
  onRegenerate,
  onConfirm,
}: {
  readonly open: boolean;
  readonly title: string;
  readonly markdown: string;
  readonly busy: boolean;
  readonly onClose: () => void;
  readonly onRegenerate: () => void;
  readonly onConfirm: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="배경 닫기"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 82,
          border: 0,
          padding: 0,
          margin: 0,
          background: "rgba(15, 23, 42, 0.45)",
          cursor: "pointer",
        }}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="기획안 미리보기"
        style={{
          position: "fixed",
          zIndex: 83,
          left: "max(12px, 50% - min(92vw, 720px) / 2)",
          top: "max(12px, 6vh)",
          width: "min(92vw, 720px)",
          maxHeight: "min(88vh, 900px)",
          borderRadius: 16,
          border: "1px solid #e2e8f0",
          background: "#fff",
          boxShadow: "0 24px 64px -20px rgba(15, 23, 42, 0.35)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a", minWidth: 0, lineHeight: 1.35 }}>{title}</div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
              borderRadius: 10,
              padding: "8px 12px",
              fontSize: 13,
              fontWeight: 800,
              color: "#475569",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            닫기
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "14px 16px 18px" }}>
          <RequirementsAiMessageMarkdown text={markdown} variant="default" />
        </div>
        <div
          style={{
            padding: "12px 16px 16px",
            borderTop: "1px solid #f1f5f9",
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            justifyContent: "flex-end",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            disabled={busy}
            onClick={onRegenerate}
            style={{
              border: "1px solid #e2e8f0",
              background: "#fff",
              borderRadius: 10,
              padding: "9px 12px",
              fontSize: 13,
              fontWeight: 900,
              color: "#334155",
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.55 : 1,
            }}
          >
            재생성
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            style={{
              border: "1px solid #0f766e",
              background: "#ecfdf5",
              borderRadius: 10,
              padding: "9px 12px",
              fontSize: 13,
              fontWeight: 900,
              color: "#065f46",
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.55 : 1,
            }}
          >
            확정
          </button>
        </div>
      </div>
    </>
  );
}
