"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { PROJECT_ARTIFACT_LABELS, type ProjectArtifactType } from "@/lib/requirements/projectArtifactTypes";
import {
  ARTIFACT_HUB_STAGE_FILTER_LABELS,
  ARTIFACT_HUB_VISIBLE_STAGE_FILTERS,
  type ArtifactHubStageFilter,
} from "@/lib/prototype/artifactHubStage";
import {
  groupArtifactHubEntriesForDisplay,
  type ArtifactHubView,
} from "@/lib/prototype/artifactHubView";
import {
  listArtifactHubMissingGenerateTypes,
  type ProjectArtifactHubEntry,
} from "@/lib/requirements/projectArtifactHub";
import type { IdeationDeliverableAsset } from "@/lib/requirements/ideationDeliverables";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import {
  buildArtifactHubExportSections,
  downloadArtifactHubSelectionAsDoc,
  openArtifactHubSelectionAsPdf,
} from "@/lib/requirements/artifactHubExport";
import {
  artifactExportIconButtonStyle,
  DocExportIcon,
  PdfExportIcon,
} from "@/components/requirements/artifactExportIcons";
import {
  buildDeliverableAssetPickerLabel,
  buildMergedDeliverablePickerAssets,
  computeLatestVersionByDeliverableType,
  pickDefaultDeliverableAssetId,
  resolveDeliverablePickerLabel,
} from "@/lib/requirements/deliverableAssetPicker";

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
  projectId,
  projectArtifacts,
  deliverableAssets,
  generateDisabled,
  lifecycleSummary,
  onClose,
  onSelectEntry,
  onGenerate,
  onExportFeedback,
  closeOnEscape = true,
  artifactHubView,
}: {
  readonly open: boolean;
  readonly items: readonly ProjectArtifactHubEntry[];
  readonly artifactHubView?: ArtifactHubView | null;
  readonly projectName?: string;
  readonly projectId?: string;
  readonly projectArtifacts?: readonly ProjectArtifact[];
  readonly deliverableAssets?: readonly IdeationDeliverableAsset[];
  readonly generateDisabled?: boolean;
  readonly lifecycleSummary?: readonly Readonly<{ readonly label: string; readonly hint: string }>[];
  readonly onClose: () => void;
  readonly onSelectEntry: (entry: ProjectArtifactHubEntry) => void;
  readonly onGenerate: (type: ProjectArtifactType) => void;
  readonly onExportFeedback?: (input: { readonly kind: "doc" | "pdf"; readonly count: number; readonly blocked?: string }) => void;
  /** 산출물 뷰어 등 상위 레이어가 열려 있을 때 Hub만 Esc로 닫히지 않게 */
  readonly closeOnEscape?: boolean;
}) {
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [versionAssetId, setVersionAssetId] = useState("");
  const [stageFilter, setStageFilter] = useState<ArtifactHubStageFilter>(
    () => artifactHubView?.defaultStageFilter ?? "all",
  );

  const pickerAssets = useMemo(
    () =>
      buildMergedDeliverablePickerAssets({
        deliverableAssets: deliverableAssets ?? [],
        projectArtifacts,
        projectId: String(projectId ?? deliverableAssets?.[0]?.projectId ?? "").trim(),
      }),
    [deliverableAssets, projectArtifacts, projectId],
  );
  const showVersionPicker = pickerAssets.length > 1;
  const pickerLabel = resolveDeliverablePickerLabel(pickerAssets);
  const latestVersionByType = useMemo(
    () => computeLatestVersionByDeliverableType(pickerAssets),
    [pickerAssets],
  );
  const onlyFullPlanAssets = pickerAssets.length > 0 && pickerAssets.every((a) => a.type === "full_plan");

  useEffect(() => {
    if (!open) return;
    setStageFilter(artifactHubView?.defaultStageFilter ?? "all");
    setSelectedIds(new Set(items.map((item) => item.id)));
    setVersionAssetId(pickDefaultDeliverableAssetId(pickerAssets));
  }, [open, items, pickerAssets, artifactHubView?.defaultStageFilter]);

  const displaySections = useMemo(() => {
    if (artifactHubView) return groupArtifactHubEntriesForDisplay(artifactHubView, stageFilter).sections;
    return [{ title: "저장된 산출물", entries: items }];
  }, [artifactHubView, stageFilter, items]);

  useEffect(() => {
    if (!open || !showVersionPicker) return;
    const entry = items.find((item) => item.assetId === versionAssetId);
    if (entry) {
      setSelectedIds((prev) => {
        if (prev.has(entry.id)) return prev;
        const next = new Set(prev);
        next.add(entry.id);
        return next;
      });
    }
  }, [open, showVersionPicker, versionAssetId, items]);

  useEffect(() => {
    if (!open || !closeOnEscape) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeOnEscape, onClose]);

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
                    ...artifactExportIconButtonStyle,
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
                    ...artifactExportIconButtonStyle,
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
                ? artifactHubView
                  ? `전체 ${artifactHubView.badgeCount}건 · 구현 ${artifactHubView.implementationPrimary.length} · 기획 ${artifactHubView.planningPrimary.length}`
                  : `완성 산출물 ${items.length}건 · 체크한 항목만 Doc/PDF`
                : "산출물 생성·조회"}
            </div>
            {artifactHubView?.showStageFilters ? (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  marginTop: 10,
                }}
                role="tablist"
                aria-label="산출물 단계 필터"
              >
                {ARTIFACT_HUB_VISIBLE_STAGE_FILTERS.map((key) => {
                  const count =
                    key === "all"
                      ? artifactHubView.badgeCount
                      : key === "planning"
                        ? artifactHubView.planningPrimary.length
                        : artifactHubView.implementationPrimary.length;
                  const active = stageFilter === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setStageFilter(key)}
                      style={{
                        border: `1px solid ${active ? "#0d9488" : "#e2e8f0"}`,
                        background: active ? "#ecfdf5" : "#fff",
                        color: active ? "#065f46" : "#334155",
                        borderRadius: 999,
                        padding: "5px 10px",
                        fontSize: 11.5,
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      {ARTIFACT_HUB_STAGE_FILTER_LABELS[key]} {count > 0 ? count : ""}
                    </button>
                  );
                })}
              </div>
            ) : null}
            {showVersionPicker ? (
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  marginTop: 10,
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#475569",
                }}
              >
                <span>{pickerLabel}</span>
                <select
                  value={versionAssetId}
                  onChange={(e) => setVersionAssetId(e.target.value)}
                  aria-label={pickerLabel}
                  style={{
                    width: "100%",
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
                  {pickerAssets.map((a) => {
                    const maxVer = latestVersionByType.get(a.type) ?? a.version;
                    const isLatest =
                      typeof a.version === "number" && typeof maxVer === "number" ? a.version === maxVer : false;
                    return (
                      <option key={a.id} value={a.id}>
                        {buildDeliverableAssetPickerLabel(a, {
                          onlyFullPlanAssets,
                          isLatest,
                          isConfirmed: Boolean(a.confirmedAt),
                        })}
                      </option>
                    );
                  })}
                </select>
              </label>
            ) : null}
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" style={closeBtnStyle}>
            ×
          </button>
        </header>
        <ArtifactHubBody
          sections={displaySections}
          selectedIds={selectedIds}
          highlightedAssetId={versionAssetId}
          generateDisabled={generateDisabled || artifactHubView?.mode === "implementation"}
          hideGenerate={artifactHubView?.mode === "implementation"}
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
  sections,
  selectedIds,
  highlightedAssetId,
  generateDisabled,
  hideGenerate,
  lifecycleSummary,
  onToggleSelected,
  onSelectEntry,
  onGenerate,
}: {
  readonly sections: readonly Readonly<{
    readonly title: string;
    readonly entries: readonly ProjectArtifactHubEntry[];
  }>[];
  readonly selectedIds: ReadonlySet<string>;
  readonly highlightedAssetId?: string;
  readonly generateDisabled?: boolean;
  readonly hideGenerate?: boolean;
  readonly lifecycleSummary?: readonly Readonly<{ readonly label: string; readonly hint: string }>[];
  readonly onToggleSelected: (entryId: string, checked: boolean) => void;
  readonly onSelectEntry: (entry: ProjectArtifactHubEntry) => void;
  readonly onGenerate: (type: ProjectArtifactType) => void;
}) {
  const allItems = useMemo(() => sections.flatMap((s) => s.entries), [sections]);
  const missingGenerateTypes = useMemo(
    () => listArtifactHubMissingGenerateTypes({ catalog: allItems }),
    [allItems],
  );

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
      {!hideGenerate ? (
      <section>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", marginBottom: 4 }}>새로 생성</div>
        <p style={sectionHintStyle}>
          현재 프로젝트·슬롯 상태를 바탕으로 <strong>아직 없는 문서 유형</strong>을 새로 만듭니다. 생성되면 아래
          「저장된 산출물」에 추가됩니다.
        </p>
        {missingGenerateTypes.length === 0 ? (
          <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
            표준 문서 유형이 모두 저장되어 있습니다. 내용을 바꾸려면 아래 항목을 열어 확인하거나, 해당 유형을 삭제한 뒤 다시
            생성할 수 있습니다.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {missingGenerateTypes.map((type) => (
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
        )}
      </section>
      ) : null}
      {sections.map((section) => (
        <section key={section.title}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", marginBottom: 4 }}>
            {section.title} ({section.entries.length})
          </div>
          {section.title.includes("참조") ? (
            <p style={sectionHintStyle}>구현 시 참고하는 기획 단계 산출물입니다.</p>
          ) : section.title.includes("구현") ? (
            <p style={sectionHintStyle}>
              task plan·Code Agent·WIP·검토 상태에서 <strong>동적으로 생성</strong>된 구현 산출물입니다.
            </p>
          ) : (
            <p style={sectionHintStyle}>
              프로젝트에 저장된 문서입니다. 항목을 누르면 뷰어에서 열고, 체크한 항목만 Doc/PDF로보냅니다.
            </p>
          )}
          {section.entries.length === 0 ? (
            <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>표시할 산출물이 없습니다.</p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {section.entries.map((item) => (
                <ArtifactHubEntryRow
                  key={item.id}
                  item={item}
                  selected={selectedIds.has(item.id)}
                  highlighted={Boolean(highlightedAssetId && item.assetId === highlightedAssetId)}
                  onToggleSelected={onToggleSelected}
                  onSelectEntry={onSelectEntry}
                />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

function ArtifactHubEntryRow({
  item,
  selected,
  highlighted,
  onToggleSelected,
  onSelectEntry,
}: {
  readonly item: ProjectArtifactHubEntry;
  readonly selected: boolean;
  readonly highlighted: boolean;
  readonly onToggleSelected: (entryId: string, checked: boolean) => void;
  readonly onSelectEntry: (entry: ProjectArtifactHubEntry) => void;
}) {
  const stageLabel =
    item.hubSection === "implementation-primary"
      ? "구현 산출물"
      : item.hubSection === "planning-reference"
        ? "참조 기획"
        : item.kind === "deliverable"
          ? "기획 산출물"
          : "문서";
  return (
    <li style={itemRowStyle}>
      <label
        style={{ display: "flex", alignItems: "center", flexShrink: 0, cursor: "pointer" }}
        title="다운로드 대상에 포함"
      >
        <input
          type="checkbox"
          checked={selected}
          aria-label={`${item.title} 다운로드 대상`}
          onChange={(e) => onToggleSelected(item.id, e.target.checked)}
          onClick={(e) => e.stopPropagation()}
        />
      </label>
      <button
        type="button"
        style={{
          ...itemBtnStyle,
          whiteSpace: "normal",
          overflow: "visible",
          textOverflow: "clip",
          ...(highlighted
            ? {
                borderColor: "#0d9488",
                background: "#ecfdf5",
                boxShadow: "0 0 0 1px #0d9488",
              }
            : {}),
        }}
        title={item.hubReason ? `${item.title}\n${item.hubReason}` : `${item.title} · ${item.sourceStage}`}
        onClick={() => onSelectEntry(item)}
      >
        <span style={{ fontWeight: 800, display: "block" }}>{item.title}</span>
        <span style={{ fontWeight: 500, color: "#64748b", display: "block", fontSize: 12 }}>
          {stageLabel}
          {item.hubReadinessLabel ? ` · ${item.hubReadinessLabel}` : ""}
          {item.hubRequired === false ? " · 추천" : item.hubRequired ? " · 필수" : ""}
        </span>
        {item.hubReason ? (
          <span
            style={{
              display: "block",
              marginTop: 4,
              fontSize: 11,
              color: "#475569",
              lineHeight: 1.4,
              whiteSpace: "normal",
            }}
          >
            {item.hubReason}
          </span>
        ) : null}
      </button>
    </li>
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
