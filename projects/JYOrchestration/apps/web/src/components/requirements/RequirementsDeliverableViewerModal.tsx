"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { IdeationDeliverableAsset } from "@/lib/requirements/ideationDeliverables";
import {
  buildDeliverableAssetPickerLabel,
  computeLatestVersionByDeliverableType,
  formatDeliverableCreatedAt,
  resolveDeliverablePickerLabel,
  sortDeliverableAssetsForPicker,
} from "@/lib/requirements/deliverableAssetPicker";
import { RequirementsAiMessageMarkdown } from "@/components/requirements/RequirementsAiMessageMarkdown";
import {
  artifactExportIconButtonStyle,
  DocExportIcon,
  PdfExportIcon,
} from "@/components/requirements/artifactExportIcons";
import { downloadDeliverableMarkdownAsDocFile } from "@/lib/requirements/deliverableDocDownload";
import { openArtifactHubSelectionAsPdf } from "@/lib/requirements/artifactHubExport";

/** Artifact Hub(1160) 위에 산출물 뷰어가 겹치도록 */
const VIEWER_BACKDROP_Z = 1170;
const VIEWER_DIALOG_Z = 1180;

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
  const pickerItems = useMemo(() => sortDeliverableAssetsForPicker(ordered), [ordered]);
  const [activeId, setActiveId] = useState<string>("");
  const latestVersionByType = useMemo(() => computeLatestVersionByDeliverableType(ordered), [ordered]);

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

  const handleDownloadPdf = useCallback(() => {
    if (!active) return;
    openArtifactHubSelectionAsPdf({
      projectName: active.title,
      sections: [{ title: active.title, markdown: active.content }],
    });
  }, [active]);

  if (!open) return null;

  const onlyFullPlanAssets = ordered.length > 0 && ordered.every((a) => a.type === "full_plan");
  const pickerLabel = resolveDeliverablePickerLabel(ordered);
  const showPicker = pickerItems.length > 1;

  return (
    <>
      <button
        type="button"
        aria-label="닫기"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: VIEWER_BACKDROP_Z,
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
          zIndex: VIEWER_DIALOG_Z,
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
                      {buildDeliverableAssetPickerLabel(a, { onlyFullPlanAssets, isLatest, isConfirmed })}
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
              {formatDeliverableCreatedAt(active.createdAt)}
            </span>
          ) : (
            <span style={{ marginRight: "auto" }} />
          )}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <button
              type="button"
              title="Doc 다운로드"
              aria-label="Doc 다운로드"
              onClick={handleDownloadDoc}
              disabled={!active}
              style={{
                ...artifactExportIconButtonStyle,
                opacity: active ? 1 : 0.45,
                cursor: active ? "pointer" : "not-allowed",
              }}
            >
              <DocExportIcon />
            </button>
            <button
              type="button"
              title="PDF로 저장 (인쇄 대화상자)"
              aria-label="PDF로 저장"
              onClick={handleDownloadPdf}
              disabled={!active}
              style={{
                ...artifactExportIconButtonStyle,
                opacity: active ? 1 : 0.45,
                cursor: active ? "pointer" : "not-allowed",
              }}
            >
              <PdfExportIcon />
            </button>
          </span>
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
