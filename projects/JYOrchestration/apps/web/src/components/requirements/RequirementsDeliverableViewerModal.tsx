"use client";

import { useEffect, useMemo, useState } from "react";
import type { IdeationDeliverableAsset } from "@/lib/requirements/ideationDeliverables";
import { RequirementsAiMessageMarkdown } from "@/components/requirements/RequirementsAiMessageMarkdown";

export function RequirementsDeliverableViewerModal({
  open,
  onClose,
  assets,
  initialAssetId,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly assets: readonly IdeationDeliverableAsset[];
  readonly initialAssetId?: string | null;
}) {
  const ordered = useMemo(() => [...assets].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))), [assets]);
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    const first = initialAssetId && ordered.some((a) => a.id === initialAssetId) ? initialAssetId : ordered[0]?.id ?? "";
    setActiveId(first);
  }, [open, initialAssetId, ordered]);

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

  const active = ordered.find((a) => a.id === activeId) ?? ordered[0] ?? null;

  return (
    <>
      <button
        type="button"
        aria-label="닫기"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 80,
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
        aria-label="산출물 보기"
        style={{
          position: "fixed",
          zIndex: 81,
          left: "max(12px, 50% - min(92vw, 720px) / 2)",
          top: "max(12px, 8vh)",
          width: "min(92vw, 720px)",
          maxHeight: "min(84vh, 900px)",
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
          <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a", minWidth: 0 }}>{active?.title ?? "산출물"}</div>
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
        {ordered.length > 1 ? (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              padding: "10px 16px",
              borderBottom: "1px solid #f1f5f9",
              maxHeight: 120,
              overflowY: "auto",
            }}
          >
            {ordered.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setActiveId(a.id)}
                style={{
                  borderRadius: 999,
                  border: a.id === activeId ? "1px solid #0f766e" : "1px solid #e2e8f0",
                  background: a.id === activeId ? "#ecfdf5" : "#fff",
                  padding: "6px 12px",
                  fontSize: 12.5,
                  fontWeight: 800,
                  color: a.id === activeId ? "#065f46" : "#334155",
                  cursor: "pointer",
                }}
              >
                {a.title}
              </button>
            ))}
          </div>
        ) : null}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "14px 16px 18px" }}>
          {active ? <RequirementsAiMessageMarkdown text={active.content} variant="default" /> : <div style={{ color: "#64748b" }}>문서가 없습니다.</div>}
        </div>
      </div>
    </>
  );
}
