"use client";

import type { PrototypeImprovementItem } from "@/lib/prototype/prototypeReviewStore";
import { Button } from "@/components/ui/Button";
import { uiTokens as t } from "@/components/ui/tokens";

export function ReviewImprovementDetailModal(p: {
  readonly item: PrototypeImprovementItem | null;
  readonly onClose: () => void;
}) {
  if (!p.item) return null;

  return (
    <div
      role="dialog"
      aria-modal
      aria-labelledby="jyo-review-improvement-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(15, 23, 42, 0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        boxSizing: "border-box",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) p.onClose();
      }}
    >
      <div
        style={{
          width: "min(100%, 420px)",
          maxHeight: "min(85vh, 520px)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          borderRadius: t.radiusLg,
          background: t.bgCard,
          border: `1px solid ${t.border}`,
          boxShadow: "0 20px 50px -12px rgba(15, 23, 42, 0.35)",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "16px 18px 12px", borderBottom: `1px solid ${t.border}` }}>
          <div id="jyo-review-improvement-title" style={{ fontSize: 12, fontWeight: 800, color: t.textMuted, marginBottom: 6 }}>
            AI개선안
          </div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: t.textPrimary, lineHeight: 1.35 }}>{p.item.title}</h2>
        </div>
        <div style={{ padding: "14px 18px", overflowY: "auto", flex: 1, fontSize: 14, color: t.textSecondary, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
          {p.item.detail}
        </div>
        <div style={{ padding: "12px 18px 16px", borderTop: `1px solid ${t.border}`, display: "flex", justifyContent: "flex-end" }}>
          <Button type="button" variant="primary" size="md" onClick={p.onClose}>
            닫기
          </Button>
        </div>
      </div>
    </div>
  );
}
