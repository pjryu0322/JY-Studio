"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { IdeationDeliverableAsset } from "@/lib/requirements/ideationDeliverables";
import { IDEATION_DELIVERABLE_LABELS, isIdeationDeliverableType } from "@/lib/requirements/ideationDeliverables";
import { RequirementsAiMessageMarkdown } from "@/components/requirements/RequirementsAiMessageMarkdown";
import { downloadDeliverableMarkdownAsDocFile } from "@/lib/requirements/deliverableDocDownload";

function formatCreatedAt(ts: string): string {
  const d = new Date(ts);
  if (!Number.isFinite(d.getTime())) return ts;
  try {
    return d.toLocaleString("ko-KR");
  } catch {
    return d.toISOString();
  }
}

function sortAssetsForPicker(assets: readonly IdeationDeliverableAsset[]): IdeationDeliverableAsset[] {
  return [...assets].sort((a, b) => {
    const at = String(a.type).localeCompare(String(b.type));
    if (at !== 0) return at;
    return String(b.createdAt).localeCompare(String(a.createdAt));
  });
}

function buildAssetPickerLabel(
  asset: IdeationDeliverableAsset,
  input: {
    readonly onlyFullPlanAssets: boolean;
    readonly isLatest: boolean;
    readonly isConfirmed: boolean;
  },
): string {
  const parts: string[] = [asset.title || "산출물"];
  if (!input.onlyFullPlanAssets) {
    const typeLabel = isIdeationDeliverableType(asset.type) ? IDEATION_DELIVERABLE_LABELS[asset.type] : String(asset.type);
    parts.push(typeLabel);
  }
  if (typeof asset.version === "number") parts.push(`v${asset.version}`);
  parts.push(formatCreatedAt(asset.createdAt));
  parts.push(input.isLatest ? "최신" : "과거");
  parts.push(input.isConfirmed ? "확정" : "미확정");
  return parts.join(" · ");
}

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
  const ordered = useMemo(
    () => [...assets].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))),
    [assets],
  );
  const pickerItems = useMemo(() => sortAssetsForPicker(ordered), [ordered]);
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

  const active = ordered.find((a) => a.id === activeId) ?? ordered[0] ?? null;

  const handleDownloadDoc = useCallback(() => {
    if (!active) return;
    downloadDeliverableMarkdownAsDocFile({
      title: active.title,
      markdown: active.content,
      version: active.version,
    });
  }, [active]);

  if (!open) return null;

  const onlyFullPlanAssets = ordered.length > 0 && ordered.every((a) => a.type === "full_plan");
  const pickerLabel = onlyFullPlanAssets ? "기획안 버전" : "문서";
  const showPicker = pickerItems.length > 1;

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
          left: "max(12px, 50% - min(94vw, 960px) / 2)",
          top: "max(12px, 6vh)",
          width: "min(94vw, 960px)",
          maxHeight: "min(88vh, 920px)",
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
            padding: "12px 16px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 12,
            flexShrink: 0,
            flexWrap: "wrap",
          }}
        >
          {showPicker ? (
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12.5,
                fontWeight: 800,
                color: "#475569",
                marginRight: "auto",
              }}
            >
              <span style={{ whiteSpace: "nowrap" }}>{pickerLabel}</span>
              <select
                value={activeId}
                onChange={(e) => setActiveId(e.target.value)}
                aria-label={pickerLabel}
                style={{
                  minWidth: "min(320px, 52vw)",
                  maxWidth: "min(420px, 58vw)",
                  border: "1px solid #cbd5e1",
                  borderRadius: 10,
                  padding: "8px 10px",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#0f172a",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                {pickerItems.map((a) => {
                  const maxVer = latestVersionByType.get(a.type) ?? a.version;
                  const isLatest =
                    typeof a.version === "number" && typeof maxVer === "number" ? a.version === maxVer : false;
                  const isConfirmed = Boolean(a.confirmedAt);
                  return (
                    <option key={a.id} value={a.id}>
                      {buildAssetPickerLabel(a, { onlyFullPlanAssets, isLatest, isConfirmed })}
                    </option>
                  );
                })}
              </select>
            </label>
          ) : active ? (
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 800,
                color: "#64748b",
                whiteSpace: "nowrap",
                marginRight: "auto",
              }}
            >
              {typeof active.version === "number" ? `v${active.version}` : null}
              {active.version != null ? " · " : ""}
              {formatCreatedAt(active.createdAt)}
            </span>
          ) : (
            <span style={{ marginRight: "auto" }} />
          )}
          <button
            type="button"
            onClick={handleDownloadDoc}
            disabled={!active}
            style={{
              border: "1px solid #0f766e",
              background: "#ecfdf5",
              borderRadius: 10,
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 800,
              color: "#0f766e",
              cursor: active ? "pointer" : "not-allowed",
              opacity: active ? 1 : 0.5,
              flexShrink: 0,
            }}
          >
            DOC 다운로드
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 20px 22px" }}>
          {active ? (
            <RequirementsAiMessageMarkdown text={active.content} variant="default" />
          ) : (
            <div style={{ color: "#64748b" }}>문서가 없습니다.</div>
          )}
        </div>
      </div>
    </>
  );
}
