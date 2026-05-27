"use client";

import { useEffect, type CSSProperties } from "react";
import {
  PROTOTYPE_TEMPLATES,
  type PrototypeTemplateType,
} from "@/lib/templates/prototypeTemplates";
import { PROTOTYPE_INLINE_TEMPLATE_AI_VALUE } from "@/lib/prototype/prototypeInlineTemplateConstants";

const btnBase: CSSProperties = {
  padding: "8px 14px",
  borderRadius: 10,
  fontSize: 12.5,
  fontWeight: 900,
  cursor: "pointer",
};

const btnMuted: CSSProperties = {
  ...btnBase,
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  color: "#0f172a",
};

const btnTeal: CSSProperties = {
  ...btnBase,
  border: "1px solid #0f766e",
  background: "#0f766e",
  color: "#fff",
};

export type PrototypeTemplateChangeModalProps = Readonly<{
  open: boolean;
  onClose: () => void;
  canChange: boolean;
  draftPickerValue: string;
  recommendedTemplateId: PrototypeTemplateType;
  recommendedTemplateNameKo: string;
  disabled: boolean;
  onSelect: (value: string) => void;
  onPreview: () => void;
}>;

export function PrototypeTemplateChangeModal(p: PrototypeTemplateChangeModalProps) {
  useEffect(() => {
    if (!p.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") p.onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [p.open, p.onClose]);

  if (!p.open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="prototype-template-change-modal-title"
      data-testid="prototype-template-change-modal"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(15, 23, 42, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) p.onClose();
      }}
    >
      <div
        style={{
          width: "min(420px, 100%)",
          display: "flex",
          flexDirection: "column",
          background: "#fff",
          borderRadius: 16,
          border: "1px solid #e2e8f0",
          boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.28)",
          overflow: "hidden",
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <header
          style={{
            flexShrink: 0,
            padding: "14px 18px",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <h2
            id="prototype-template-change-modal-title"
            style={{ margin: 0, fontSize: 17, fontWeight: 900, color: "#0f172a" }}
          >
            템플릿 변경
          </h2>
        </header>

        <div style={{ padding: "16px 18px", display: "grid", gap: 14 }}>
          {p.canChange ? (
            <>
              <p style={{ margin: 0, fontSize: 12, color: "#475569", lineHeight: 1.55 }}>
                AI 추천 템플릿을 기본값으로 사용합니다. 필요하면 아래에서 템플릿을 변경하거나 미리볼 수 있습니다.
              </p>
              <label style={{ display: "grid", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 900, color: "#334155" }}>템플릿</span>
                <select
                  value={p.draftPickerValue}
                  disabled={p.disabled}
                  onChange={(e) => p.onSelect(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #cbd5e1",
                    background: "#fff",
                    fontSize: 13,
                    fontWeight: 800,
                    color: "#0f172a",
                  }}
                >
                  <option value={PROTOTYPE_INLINE_TEMPLATE_AI_VALUE}>
                    AI 추천 템플릿 ({p.recommendedTemplateNameKo})
                  </option>
                  {PROTOTYPE_TEMPLATES.filter((t) => t.id !== p.recommendedTemplateId).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nameKo}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#64748b" }}>
              현재 상태에서는 템플릿을 변경할 수 없습니다.
            </p>
          )}
        </div>

        {p.canChange ? (
          <footer
            style={{
              flexShrink: 0,
              padding: "12px 18px 16px",
              borderTop: "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={p.onPreview}
              disabled={p.disabled}
              style={{
                ...btnMuted,
                cursor: p.disabled ? "not-allowed" : "pointer",
                opacity: p.disabled ? 0.55 : 1,
              }}
            >
              미리보기
            </button>
            <button type="button" onClick={p.onClose} style={btnTeal}>
              닫기
            </button>
          </footer>
        ) : (
          <footer
            style={{
              flexShrink: 0,
              padding: "12px 18px 16px",
              borderTop: "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <button type="button" onClick={p.onClose} style={btnMuted}>
              닫기
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}
