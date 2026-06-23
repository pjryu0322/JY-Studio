"use client";

import { useEffect } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import type { ProjectGraphContextMenuItem } from "@/components/project-graph/ProjectGraphContextMenu";

export function ProjectGraphNodeActionSheet(p: {
  readonly open: boolean;
  readonly nodeTitle: string;
  readonly items: readonly ProjectGraphContextMenuItem[];
  readonly onClose: () => void;
}) {
  useEffect(() => {
    if (!p.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        p.onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [p.open, p.onClose]);

  if (!p.open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="노드 작업 닫기"
        onClick={p.onClose}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 24,
          border: 0,
          padding: 0,
          background: "rgba(15, 23, 42, 0.45)",
          cursor: "pointer",
        }}
      />
      <div
        role="menu"
        aria-label="노드 작업"
        style={{
          position: "absolute",
          left: 12,
          right: 12,
          bottom: 12,
          zIndex: 25,
          borderRadius: 16,
          border: `1px solid ${t.border}`,
          background: t.bgCard,
          padding: "12px 12px 10px",
          boxShadow: "0 -8px 32px rgba(15,23,42,0.2)",
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 900,
            color: t.textPrimary,
            marginBottom: 10,
            padding: "0 4px",
            lineHeight: 1.35,
          }}
        >
          {p.nodeTitle}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {p.items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                if (item.disabled) return;
                item.onSelect();
                p.onClose();
              }}
              style={{
                minHeight: 48,
                borderRadius: 12,
                border: `1px solid ${t.border}`,
                background: t.bgPage,
                fontSize: 14,
                fontWeight: 800,
                color: item.disabled ? t.textMuted : t.textPrimary,
                cursor: item.disabled ? "not-allowed" : "pointer",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
