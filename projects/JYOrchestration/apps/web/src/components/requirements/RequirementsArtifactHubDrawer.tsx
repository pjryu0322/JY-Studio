"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  PROJECT_ARTIFACT_HUB_GENERATE_ORDER,
  PROJECT_ARTIFACT_LABELS,
  type ProjectArtifactType,
} from "@/lib/requirements/projectArtifactTypes";
import type { ProjectArtifactHubEntry } from "@/lib/requirements/projectArtifactHub";
import type { IdeationDeliverableAsset } from "@/lib/requirements/ideationDeliverables";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import {
  buildArtifactHubExportSections,
  downloadArtifactHubSelectionAsDoc,
  openArtifactHubSelectionAsPdf,
} from "@/lib/requirements/artifactHubExport";

const backdropStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1150,
  background: "rgba(15, 23, 42, 0.4)",
};

const panelStyle: CSSProperties = {
  position: "fixed",
  top: 0,
  right: 0,
  zIndex: 1160,
  width: "min(420px, 100vw)",
  height: "100%",
  background: "#fff",
  borderLeft: "1px solid #e2e8f0",
  boxShadow: "-8px 0 32px rgba(15, 23, 42, 0.12)",
  display: "flex",
  flexDirection: "column",
};

const itemRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const itemBtnStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  textAlign: "left",
  padding: "10px 12px",
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  background: "#f8fafc",
  cursor: "pointer",
  display: "block",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: 13,
  lineHeight: 1.4,
  color: "#0f172a",
};

const genBtnStyle: CSSProperties = {
  width: "100%",
  textAlign: "left",
  padding: "8px 12px",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  background: "#fff",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 700,
  color: "#0f172a",
};

const headerIconBtnStyle: CSSProperties = {
  border: "1px solid #e2e8f0",
  background: "#fff",
  borderRadius: 8,
  width: 34,
  height: 34,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  color: "#0f172a",
  padding: 0,
};

const sectionHintStyle: CSSProperties = {
  fontSize: 12,
  color: "#64748b",
  margin: "0 0 8px",
  lineHeight: 1.45,
};

export function RequirementsArtifactHubDrawer({
  open,
  items,
  projectName,
  projectArtifacts,
  deliverableAssets,
  generateDisabled,
  lifecycleSummary,
  onClose,
  onSelectEntry,
  onGenerate,
  onExportFeedback,
}: {
  readonly open: boolean;
  readonly items: readonly ProjectArtifactHubEntry[];
  readonly projectName?: string;
  readonly projectArtifacts?: readonly ProjectArtifact[];
  readonly deliverableAssets?: readonly IdeationDeliverableAsset[];
  readonly generateDisabled?: boolean;
  readonly lifecycleSummary?: readonly Readonly<{ readonly label: string; readonly hint: string }>[];
  readonly onClose: () => void;
  readonly onSelectEntry: (entry: ProjectArtifactHubEntry) => void;
  readonly onGenerate: (type: ProjectArtifactType) => void;
  readonly onExportFeedback?: (input: { readonly kind: "doc" | "pdf"; readonly count: number; readonly blocked?: string }) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    if (!open) return;
    setSelectedIds(new Set(items.map((item) => item.id)));
  }, [open, items]);

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

  const selectedEntries = useMemo(
    () => items.filter((item) => selectedIds.has(item.id)),
    [items, selectedIds],
  );

  const toggleSelected = useCallback((entryId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(entryId);
      else next.delete(entryId);
      return next;
    });
  }, []);

  const runExport = useCallback(
    (format: "doc" | "pdf") => {
      if (!selectedEntries.length) {
        onExportFeedback?.({ kind: format, count: 0, blocked: "다운로드할 산출물을 선택해 주세요." });
        return;
      }
      const sections = buildArtifactHubExportSections({
        entries: selectedEntries,
        projectArtifacts,
        deliverableAssets,
      });
      if (!sections.length) {
        onExportFeedback?.({ kind: format, count: 0, blocked: "선택한 산출물의 본문을 찾을 수 없습니다." });
        return;
      }
      const label = String(projectName ?? "").trim() || "프로젝트";
      if (format === "doc") {
        downloadArtifactHubSelectionAsDoc({ projectName: label, sections });
      } else {
        openArtifactHubSelectionAsPdf({ projectName: label, sections });
      }
      onExportFeedback?.({ kind: format, count: sections.length });
    },
    [deliverableAssets, onExportFeedback, projectArtifacts, projectName, selectedEntries],
  );

  if (!open) return null;

  const exportDisabled = selectedEntries.length === 0;

  return (
    <>
      <div style={backdropStyle} role="presentation" onClick={onClose} />
      <aside style={panelStyle} aria-label="Artifact Hub">
        <header
          style={{
            padding: "16px 18px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 16,
                fontWeight: 900,
                color: "#0f172a",
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <span>Artifact Hub</span>
              {items.length > 0 ? (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "#0d9488",
                    color: "#fff",
                  }}
                  aria-label={`완성 산출물 ${items.length}건`}
                >
                  {items.length > 99 ? "99+" : items.length}
                </span>
              ) : null}
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: 4 }}>
                <button
                  type="button"
                  title="선택한 산출물 Doc 다운로드"
                  aria-label="선택한 산출물 Doc 다운로드"
                  disabled={exportDisabled}
                  style={{
                    ...headerIconBtnStyle,
                    opacity: exportDisabled ? 0.45 : 1,
                    cursor: exportDisabled ? "not-allowed" : "pointer",
                  }}
                  onClick={() => runExport("doc")}
                >
                  <DocExportIcon />
                </button>
                <button
                  type="button"
                  title="선택한 산출물 PDF로 저장 (인쇄 대화상자)"
                  aria-label="선택한 산출물 PDF로 저장"
                  disabled={exportDisabled}
                  style={{
                    ...headerIconBtnStyle,
                    opacity: exportDisabled ? 0.45 : 1,
                    cursor: exportDisabled ? "not-allowed" : "pointer",
                  }}
                  onClick={() => runExport("pdf")}
                >
                  <PdfExportIcon />
                </button>
              </span>
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
              {items.length > 0
                ? `완성 산출물 ${items.length}건 · 체크한 항목만 Doc/PDF`
                : "산출물 생성·조회"}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" style={closeBtnStyle}>
            ×
          </button>
        </header>
        <ArtifactHubBody
          items={items}
          selectedIds={selectedIds}
          generateDisabled={generateDisabled}
          lifecycleSummary={lifecycleSummary}
          onToggleSelected={toggleSelected}
          onSelectEntry={onSelectEntry}
          onGenerate={onGenerate}
        />
      </aside>
    </>
  );
}

function ArtifactHubBody({
  items,
  selectedIds,
  generateDisabled,
  lifecycleSummary,
  onToggleSelected,
  onSelectEntry,
  onGenerate,
}: {
  readonly items: readonly ProjectArtifactHubEntry[];
  readonly selectedIds: ReadonlySet<string>;
  readonly generateDisabled?: boolean;
  readonly lifecycleSummary?: readonly Readonly<{ readonly label: string; readonly hint: string }>[];
  readonly onToggleSelected: (entryId: string, checked: boolean) => void;
  readonly onSelectEntry: (entry: ProjectArtifactHubEntry) => void;
  readonly onGenerate: (type: ProjectArtifactType) => void;
}) {
  return (
    <div style={{ flex: 1, overflow: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 16 }}>
      {lifecycleSummary?.length ? (
        <section>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", marginBottom: 8 }}>산출물 상태</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {lifecycleSummary.map((row) => (
              <span
                key={row.hint}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "4px 8px",
                  borderRadius: 6,
                  background: row.label.includes("재생성") || row.label.includes("구버전") ? "#fffbeb" : "#ecfdf5",
                  color: row.label.includes("재생성") || row.label.includes("구버전") ? "#92400e" : "#065f46",
                  border: "1px solid #e2e8f0",
                }}
              >
                {row.hint}
              </span>
            ))}
          </div>
        </section>
      ) : null}
      <section>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", marginBottom: 4 }}>새로 생성</div>
        <p style={sectionHintStyle}>
          현재 프로젝트·슬롯 상태를 바탕으로 <strong>아직 없는 문서 유형</strong>을 새로 만듭니다. 생성되면 아래
          「저장된 산출물」에 추가됩니다.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {PROJECT_ARTIFACT_HUB_GENERATE_ORDER.map((type) => (
            <button
              key={type}
              type="button"
              disabled={generateDisabled}
              style={{
                ...genBtnStyle,
                opacity: generateDisabled ? 0.5 : 1,
                cursor: generateDisabled ? "not-allowed" : "pointer",
              }}
              onClick={() => {
                if (generateDisabled) return;
                onGenerate(type);
              }}
            >
              {PROJECT_ARTIFACT_LABELS[type]}
            </button>
          ))}
        </div>
      </section>
      <section>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", marginBottom: 4 }}>
          저장된 산출물 ({items.length})
        </div>
        <p style={sectionHintStyle}>
          이미 만들어져 프로젝트에 <strong>저장된</strong> 문서입니다. 항목을 누르면 뷰어에서 열고, 체크한 항목만 상단
          Doc/PDF 아이콘으로보냅니다.
        </p>
        {items.length === 0 ? (
          <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>생성된 산출물이 없습니다.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map((item) => (
              <li key={item.id} style={itemRowStyle}>
                <label
                  style={{ display: "flex", alignItems: "center", flexShrink: 0, cursor: "pointer" }}
                  title="다운로드 대상에 포함"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.id)}
                    aria-label={`${item.title} 다운로드 대상`}
                    onChange={(e) => onToggleSelected(item.id, e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </label>
                <button
                  type="button"
                  style={itemBtnStyle}
                  title={`${item.title} · ${item.sourceStage} · ${item.kind === "deliverable" ? "기획 산출물" : "문서"}`}
                  onClick={() => onSelectEntry(item)}
                >
                  <span style={{ fontWeight: 800 }}>{item.title}</span>
                  <span style={{ fontWeight: 500, color: "#64748b" }}>
                    {" "}
                    · {item.sourceStage} · {item.kind === "deliverable" ? "기획 산출물" : "문서"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function DocExportIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h2" />
      <path d="M8 17h8" />
      <path d="M14 13h2" />
    </svg>
  );
}

function PdfExportIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M7 14h3v4H7z" />
      <path d="M13 14h4v4h-4z" />
      <path d="M7 10h10" />
    </svg>
  );
}

const closeBtnStyle: CSSProperties = {
  border: "1px solid #e2e8f0",
  background: "#fff",
  borderRadius: 8,
  width: 32,
  height: 32,
  fontSize: 18,
  cursor: "pointer",
  lineHeight: 1,
  flexShrink: 0,
};
