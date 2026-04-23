"use client";

import type { IdeationDeliverableChatPayload } from "@/lib/requirements/ideationDeliverables";
import { IDEATION_DELIVERABLE_LABELS, isIdeationDeliverableType } from "@/lib/requirements/ideationDeliverables";

const btnBase = {
  border: "1px solid #e2e8f0",
  background: "#fff",
  borderRadius: 10,
  padding: "8px 12px",
  fontSize: 13,
  fontWeight: 800,
  color: "#0f172a",
  cursor: "pointer",
} as const;

export function RequirementsDeliverableChatCard({
  payload,
  onOpenDocument,
  onOpenList,
  onOpenAll,
  onRegenerate,
  onConfirm,
}: {
  readonly payload: IdeationDeliverableChatPayload;
  readonly onOpenDocument: (assetId: string) => void;
  /** 현재 프로젝트 산출물 목록(탐색) */
  readonly onOpenList: (focusAssetId: string | null) => void;
  readonly onOpenAll: (assetIds: readonly string[]) => void;
  readonly onRegenerate: (requestedTypes: readonly string[]) => void;
  readonly onConfirm: (assetIds: readonly string[]) => void;
}) {
  const ids = payload.items.map((i) => i.assetId);
  const types = payload.requestedTypes.length ? payload.requestedTypes : payload.items.map((i) => i.type);
  const focusId = payload.items[0]?.assetId ?? null;

  return (
    <div style={{ padding: "12px 14px 14px", fontSize: 15, color: "#0f172a" }}>
      <div style={{ fontWeight: 900, marginBottom: 10, lineHeight: 1.45 }}>{payload.headline}</div>
      {payload.mode === "single" && payload.items[0] ? (
        <ul style={{ margin: "0 0 14px", paddingLeft: 18, color: "#334155", lineHeight: 1.55 }}>
          {payload.items[0].previewLines.map((line, i) => (
            <li key={i} style={{ marginBottom: 4 }}>
              {line}
            </li>
          ))}
        </ul>
      ) : (
        <ul style={{ margin: "0 0 14px", paddingLeft: 18, color: "#334155", lineHeight: 1.55 }}>
          {payload.items.map((it) => (
            <li key={it.assetId} style={{ marginBottom: 4 }}>
              {it.title}
            </li>
          ))}
        </ul>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {payload.mode === "single" && payload.items[0] ? (
          <>
            <button type="button" style={btnBase} onClick={() => onOpenList(focusId)}>
              문서목록
            </button>
            <button type="button" style={btnBase} onClick={() => onOpenDocument(payload.items[0].assetId)}>
              문서 열기
            </button>
            <button type="button" style={btnBase} onClick={() => onRegenerate([...types])}>
              재생성
            </button>
            <button
              type="button"
              style={{ ...btnBase, border: "1px solid #0f766e", background: "#ecfdf5", color: "#065f46" }}
              onClick={() => onConfirm(ids)}
            >
              확정
            </button>
          </>
        ) : (
          <>
            <button type="button" style={btnBase} onClick={() => onOpenList(focusId)}>
              문서목록
            </button>
            <button
              type="button"
              style={{ ...btnBase, border: "1px solid #0f766e", background: "#ecfdf5", color: "#065f46" }}
              onClick={() => onOpenAll(ids)}
            >
              문서 열기
            </button>
            <button type="button" style={btnBase} onClick={() => onRegenerate([...types])}>
              재생성
            </button>
            <button
              type="button"
              style={{ ...btnBase, border: "1px solid #0f766e", background: "#ecfdf5", color: "#065f46" }}
              onClick={() => onConfirm(ids)}
            >
              확정
            </button>
          </>
        )}
      </div>
      <div style={{ marginTop: 12, fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>
        유형: {types.map((t) => (isIdeationDeliverableType(t) ? IDEATION_DELIVERABLE_LABELS[t] : t)).join(" · ")}
      </div>
    </div>
  );
}
