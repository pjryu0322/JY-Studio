"use client";

import { useEffect, useMemo, useState } from "react";
import type { IdeationDeliverableAsset } from "@/lib/requirements/ideationDeliverables";
import { IDEATION_DELIVERABLE_LABELS, isIdeationDeliverableType } from "@/lib/requirements/ideationDeliverables";
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
  const latestVersionByType = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of ordered) {
      const prev = m.get(a.type) ?? -1;
      if (typeof a.version === "number" && a.version > prev) m.set(a.type, a.version);
    }
    return m;
  }, [ordered]);

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
  const onlyFullPlanAssets = ordered.length > 0 && ordered.every((a) => a.type === "full_plan");
  const formatCreatedAt = (ts: string) => {
    const d = new Date(ts);
    if (!Number.isFinite(d.getTime())) return ts;
    try {
      return d.toLocaleString("ko-KR");
    } catch {
      return d.toISOString();
    }
  };

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
        <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>
          <div
            style={{
              width: 300,
              maxWidth: "42%",
              borderRight: "1px solid #f1f5f9",
              overflowY: "auto",
              padding: "10px 12px 12px",
              background: "#fbfdff",
            }}
          >
            <div style={{ fontSize: 12.5, fontWeight: 900, color: "#0f172a", margin: "2px 4px 10px" }}>
              {onlyFullPlanAssets ? "기획안 버전" : "문서목록"}
            </div>
            {ordered.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {ordered
                  .slice()
                  .sort((a, b) => {
                    const at = String(a.type).localeCompare(String(b.type));
                    if (at !== 0) return at;
                    return String(b.createdAt).localeCompare(String(a.createdAt));
                  })
                  .map((a) => {
                    const isActive = a.id === activeId;
                    const maxVer = latestVersionByType.get(a.type) ?? a.version;
                    const isLatest = typeof a.version === "number" && typeof maxVer === "number" ? a.version === maxVer : false;
                    const isConfirmed = Boolean(a.confirmedAt);
                    const typeLabel = isIdeationDeliverableType(a.type) ? IDEATION_DELIVERABLE_LABELS[a.type] : String(a.type);
                    const typeLine = onlyFullPlanAssets ? null : (
                      <span style={{ fontSize: 12, fontWeight: 900, color: "#334155" }}>{typeLabel}</span>
                    );
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setActiveId(a.id)}
                        style={{
                          textAlign: "left",
                          borderRadius: 12,
                          border: isActive ? "1px solid #0f766e" : "1px solid #e2e8f0",
                          background: isActive ? "#ecfdf5" : "#fff",
                          padding: "10px 10px",
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 900, color: "#0f172a", lineHeight: 1.25, wordBreak: "break-word" }}>
                            {a.title}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", flexShrink: 0 }}>
                            {isLatest ? (
                              <span style={{ fontSize: 11, fontWeight: 900, color: "#0f766e", background: "#ecfdf5", border: "1px solid #99f6e4", padding: "2px 8px", borderRadius: 999 }}>
                                최신
                              </span>
                            ) : (
                              <span style={{ fontSize: 11, fontWeight: 900, color: "#64748b", background: "#f8fafc", border: "1px solid #e2e8f0", padding: "2px 8px", borderRadius: 999 }}>
                                과거
                              </span>
                            )}
                            {isConfirmed ? (
                              <span style={{ fontSize: 11, fontWeight: 900, color: "#1d4ed8", background: "#eff6ff", border: "1px solid #bfdbfe", padding: "2px 8px", borderRadius: 999 }}>
                                확정
                              </span>
                            ) : (
                              <span style={{ fontSize: 11, fontWeight: 900, color: "#94a3b8", background: "#fff", border: "1px solid #e2e8f0", padding: "2px 8px", borderRadius: 999 }}>
                                미확정
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                          {typeLine}
                          <span style={{ fontSize: 12, fontWeight: 800, color: "#64748b" }}>v{a.version}</span>
                        </div>
                        <div style={{ fontSize: 11.5, fontWeight: 800, color: "#64748b" }}>{formatCreatedAt(a.createdAt)}</div>
                      </button>
                    );
                  })}
              </div>
            ) : (
              <div style={{ padding: "10px 6px", fontSize: 13, color: "#64748b" }}>문서가 없습니다.</div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "14px 16px 18px" }}>
            {active ? <RequirementsAiMessageMarkdown text={active.content} variant="default" /> : <div style={{ color: "#64748b" }}>문서가 없습니다.</div>}
          </div>
        </div>
      </div>
    </>
  );
}
