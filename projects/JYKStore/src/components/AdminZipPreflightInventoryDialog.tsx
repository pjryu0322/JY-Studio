"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchAdminWorkerZipPreflight,
  saveAdminWorkerZipPreflightExclusions,
  type AdminWorkerZipPreflightEntry,
  type AdminWorkerZipPreflightInventory,
} from "@/lib/admin-review-api";
import {
  AdminPanelCollapseIcon,
  AdminPanelDownloadIcon,
  AdminPanelIconButton,
  AdminPanelRefreshIcon,
  AdminPanelSaveIcon,
} from "@/components/AdminPanelToolbarIcons";
import { zipExclusionReasonLabel } from "@/lib/python-worker/zip-exclusion-policy";
import {
  buildPreflightInventoryXlsx,
  collectSubtreePaths,
  downloadUint8ArrayFile,
} from "@/lib/python-worker/zip-preflight-export";

function formatBytes(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function entryKey(entry: AdminWorkerZipPreflightEntry): string {
  return `${entry.kind}:${entry.path}`;
}

function policyReasonText(entry: AdminWorkerZipPreflightEntry): string {
  if (!entry.exclusionCandidate || !entry.exclusionReason) return "";
  const label = zipExclusionReasonLabel(entry.exclusionReason);
  return entry.exclusionDetail ? `${label} (${entry.exclusionDetail})` : label;
}

/**
 * Inline card — 원본 ZIP 사전정리 인벤토리 (파일/폴더/확장자/크기 + 제외 선택 저장).
 */
export function AdminZipPreflightInventoryPanel({
  packId,
  packName,
  collapsed = false,
  onCollapsedChange,
}: {
  readonly packId: string;
  readonly packName?: string | null;
  /** When true, only the header bar is shown (body folded). */
  readonly collapsed?: boolean;
  readonly onCollapsedChange?: (collapsed: boolean) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [inventory, setInventory] = useState<AdminWorkerZipPreflightInventory | null>(null);
  const [excludedPaths, setExcludedPaths] = useState<Set<string>>(() => new Set());
  const [reasonsByPath, setReasonsByPath] = useState<Record<string, string>>({});
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const applyInventory = useCallback((data: AdminWorkerZipPreflightInventory) => {
    setInventory(data);
    const savedPaths = data.savedExcludedPaths ?? [];
    const savedReasons = data.savedExcludedReasons ?? {};
    if (savedPaths.length > 0) {
      setExcludedPaths(new Set(savedPaths));
      const nextReasons: Record<string, string> = {};
      for (const path of savedPaths) {
        nextReasons[path] = savedReasons[path]?.trim() || "";
      }
      setReasonsByPath(nextReasons);
      setSavedAt(data.savedExcludedAt ?? null);
      return;
    }
    const candidates = data.entries.filter((entry) => entry.exclusionCandidate);
    setExcludedPaths(new Set(candidates.map((entry) => entry.path)));
    const nextReasons: Record<string, string> = {};
    for (const entry of candidates) {
      nextReasons[entry.path] = policyReasonText(entry);
    }
    setReasonsByPath(nextReasons);
    setSavedAt(null);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSaveMessage(null);
    try {
      const data = await fetchAdminWorkerZipPreflight(packId);
      applyInventory(data);
    } catch (err) {
      setInventory(null);
      setExcludedPaths(new Set());
      setReasonsByPath({});
      setSavedAt(null);
      setError(err instanceof Error ? err.message : "사전정리 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [applyInventory, packId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedCount = excludedPaths.size;
  const allPaths = useMemo(
    () => (inventory?.entries ?? []).map((entry) => entry.path),
    [inventory],
  );
  const allSelected = allPaths.length > 0 && allPaths.every((path) => excludedPaths.has(path));
  const someSelected = selectedCount > 0 && !allSelected;

  const entryByPath = useMemo(() => {
    const map = new Map<string, AdminWorkerZipPreflightEntry>();
    for (const entry of inventory?.entries ?? []) map.set(entry.path, entry);
    return map;
  }, [inventory]);

  const setSubtreeExcluded = useCallback(
    (rootPath: string, select: boolean) => {
      if (!inventory) return;
      const subtree = collectSubtreePaths(inventory.entries, rootPath);
      setExcludedPaths((prev) => {
        const next = new Set(prev);
        for (const path of subtree) {
          if (select) next.add(path);
          else next.delete(path);
        }
        return next;
      });
      setReasonsByPath((prev) => {
        const next = { ...prev };
        for (const path of subtree) {
          if (select) {
            if (!next[path]?.trim()) {
              const entry = entryByPath.get(path);
              next[path] = entry ? policyReasonText(entry) : "";
            }
          } else {
            delete next[path];
          }
        }
        return next;
      });
      setSaveMessage(null);
    },
    [entryByPath, inventory],
  );

  const toggleOne = useCallback(
    (entry: AdminWorkerZipPreflightEntry) => {
      if (!inventory) return;
      if (entry.kind === "folder") {
        const subtree = collectSubtreePaths(inventory.entries, entry.path);
        const fullySelected = subtree.every((path) => excludedPaths.has(path));
        setSubtreeExcluded(entry.path, !fullySelected);
        return;
      }
      const selecting = !excludedPaths.has(entry.path);
      setSubtreeExcluded(entry.path, selecting);
    },
    [excludedPaths, inventory, setSubtreeExcluded],
  );

  const toggleAll = useCallback(() => {
    if (!inventory || allPaths.length === 0) return;
    if (allSelected) {
      setExcludedPaths(new Set());
      setReasonsByPath({});
    } else {
      setExcludedPaths(new Set(allPaths));
      setReasonsByPath((prev) => {
        const next = { ...prev };
        for (const entry of inventory.entries) {
          if (!next[entry.path]?.trim()) {
            next[entry.path] = policyReasonText(entry);
          }
        }
        return next;
      });
    }
    setSaveMessage(null);
  }, [allPaths, allSelected, inventory]);

  const onReasonChange = useCallback(
    (path: string, reason: string) => {
      const entry = entryByPath.get(path);
      if (entry?.kind === "folder" && inventory) {
        const subtree = collectSubtreePaths(inventory.entries, path);
        setReasonsByPath((prev) => {
          const next = { ...prev };
          for (const childPath of subtree) {
            if (excludedPaths.has(childPath)) next[childPath] = reason;
          }
          return next;
        });
      } else {
        setReasonsByPath((prev) => ({ ...prev, [path]: reason }));
      }
      setSaveMessage(null);
    },
    [entryByPath, excludedPaths, inventory],
  );

  const folderCheckboxState = useCallback(
    (folderPath: string): { checked: boolean; indeterminate: boolean } => {
      if (!inventory) return { checked: false, indeterminate: false };
      const subtree = collectSubtreePaths(inventory.entries, folderPath);
      if (subtree.length === 0) return { checked: false, indeterminate: false };
      const selected = subtree.filter((path) => excludedPaths.has(path)).length;
      return {
        checked: selected === subtree.length,
        indeterminate: selected > 0 && selected < subtree.length,
      };
    },
    [excludedPaths, inventory],
  );

  const onSave = useCallback(async () => {
    if (!inventory || saving) return;
    const items = inventory.entries
      .filter((entry) => excludedPaths.has(entry.path))
      .map((entry) => ({
        path: entry.path,
        reason: (reasonsByPath[entry.path] ?? "").trim(),
      }));
    const missing = items.filter((item) => !item.reason);
    if (missing.length > 0) {
      setError(`제외사유를 입력해 주세요 (${missing.length}건). 예: ${missing[0]!.path}`);
      setSaveMessage(null);
      return;
    }
    setSaving(true);
    setError(null);
    setSaveMessage(null);
    try {
      const saved = await saveAdminWorkerZipPreflightExclusions(packId, items);
      setSavedAt(saved.savedExcludedAt);
      setExcludedPaths(new Set(saved.savedExcludedPaths));
      setReasonsByPath(saved.savedExcludedReasons ?? {});
      setSaveMessage(`제외 선택 ${saved.savedExcludedPaths.length}건을 저장했습니다.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "제외 선택을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }, [excludedPaths, inventory, packId, reasonsByPath, saving]);

  const onDownloadExcel = useCallback(async () => {
    if (!inventory || downloading) return;
    setDownloading(true);
    setError(null);
    try {
      const rows = inventory.entries.map((entry) => ({
        path: entry.path,
        kind: entry.kind,
        extension: entry.extension,
        sizeBytes: entry.sizeBytes,
        excluded: excludedPaths.has(entry.path),
        exclusionReason: reasonsByPath[entry.path] ?? "",
        exclusionTargetLabel: policyReasonText(entry),
      }));
      const bytes = await buildPreflightInventoryXlsx(rows, { sheetName: "원본인벤토리" });
      const base =
        inventory.originalFileName?.replace(/\.zip$/i, "") ||
        packName?.trim() ||
        packId;
      downloadUint8ArrayFile(
        bytes,
        `${base}_사전정리.xlsx`,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "엑셀 다운로드에 실패했습니다.");
    } finally {
      setDownloading(false);
    }
  }, [downloading, excludedPaths, inventory, packId, packName, reasonsByPath]);

  return (
    <section className="overflow-hidden rounded-2xl border border-store-border bg-white">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-store-border px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-slate-900">사전정리 · 원본 인벤토리</h2>
          <p className="mt-0.5 truncate text-xs text-store-muted">
            {packName?.trim() || inventory?.packName || packId}
            {inventory?.originalFileName ? ` · ${inventory.originalFileName}` : ""}
            {collapsed && !loading && inventory ? ` · 제외 선택 ${selectedCount}건` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {onCollapsedChange ? (
            <AdminPanelIconButton
              title={collapsed ? "펼치기" : "접기"}
              onClick={() => onCollapsedChange(!collapsed)}
              aria-expanded={!collapsed}
            >
              <AdminPanelCollapseIcon collapsed={collapsed} />
            </AdminPanelIconButton>
          ) : null}
          {!collapsed ? (
            <>
              <AdminPanelIconButton title="새로고침" onClick={() => void load()} disabled={loading}>
                <AdminPanelRefreshIcon spinning={loading} />
              </AdminPanelIconButton>
              <AdminPanelIconButton
                title="엑셀 다운로드"
                onClick={() => void onDownloadExcel()}
                disabled={loading || !inventory || downloading}
              >
                <AdminPanelDownloadIcon />
              </AdminPanelIconButton>
              <AdminPanelIconButton
                title={saving ? "저장 중…" : "제외 선택 저장"}
                onClick={() => void onSave()}
                disabled={loading || saving || !inventory}
                accent
              >
                <AdminPanelSaveIcon />
              </AdminPanelIconButton>
            </>
          ) : null}
        </div>
      </div>

      {collapsed ? null : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-store-border bg-slate-50 px-4 py-2 text-[11px] text-slate-600">
            <span>
              {loading ? (
                "불러오는 중…"
              ) : inventory ? (
                <>
                  파일 {inventory.fileCount} · 폴더 {inventory.folderCount} · 정책 제외 후보{" "}
                  {inventory.exclusionCandidateCount} · ZIP {formatBytes(inventory.zipSizeBytes)}
                  {savedAt
                    ? ` · 저장 ${new Date(savedAt).toLocaleString("ko-KR", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}`
                    : ""}
                </>
              ) : (
                "—"
              )}
            </span>
            {!loading && inventory ? (
              <span className="font-semibold text-slate-800">제외 선택 {selectedCount}건</span>
            ) : null}
          </div>

          {saveMessage ? (
            <p className="border-b border-emerald-100 bg-emerald-50 px-4 py-2 text-xs text-emerald-900">
              {saveMessage}
            </p>
          ) : null}

          <div className="max-h-[min(28rem,50vh)] overflow-auto px-2 py-2 sm:px-3">
            {error ? (
              <p className="mb-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">
                {error}
              </p>
            ) : null}
            {loading ? (
              <p className="px-2 py-6 text-center text-sm text-store-muted">인벤토리를 준비하는 중…</p>
            ) : !inventory || inventory.entries.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-store-muted">표시할 항목이 없습니다.</p>
            ) : (
              <table className="min-w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 z-[1] bg-white text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="w-10 px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = someSelected;
                        }}
                        onChange={toggleAll}
                        aria-label="전체 제외 선택"
                        className="h-3.5 w-3.5 accent-store-accent"
                      />
                    </th>
                    <th className="px-2 py-2">경로</th>
                    <th className="whitespace-nowrap px-2 py-2">종류</th>
                    <th className="whitespace-nowrap px-2 py-2">확장자</th>
                    <th className="whitespace-nowrap px-2 py-2 text-right">크기</th>
                    <th className="whitespace-nowrap px-2 py-2">제외 대상</th>
                    <th className="min-w-[10rem] px-2 py-2">제외사유</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.entries.map((entry) => {
                    const checked = excludedPaths.has(entry.path);
                    const folderState =
                      entry.kind === "folder" ? folderCheckboxState(entry.path) : null;
                    const inputChecked = folderState ? folderState.checked : checked;
                    return (
                      <tr
                        key={entryKey(entry)}
                        className={`border-t border-store-border ${
                          checked || folderState?.indeterminate ? "bg-rose-50/60" : ""
                        }`}
                      >
                        <td className="px-2 py-1.5 text-center align-middle">
                          <input
                            type="checkbox"
                            checked={inputChecked}
                            ref={(el) => {
                              if (el && folderState) el.indeterminate = folderState.indeterminate;
                            }}
                            onChange={() => toggleOne(entry)}
                            aria-label={`${entry.path} 제외 선택`}
                            className="h-3.5 w-3.5 accent-store-accent"
                          />
                        </td>
                        <td className="max-w-[18rem] truncate px-2 py-1.5 font-mono text-[11px] text-slate-800">
                          {entry.path}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-slate-700">
                          {entry.kind === "folder" ? "폴더" : "파일"}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-slate-700">
                          {entry.extension || "—"}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-right text-slate-700">
                          {formatBytes(entry.sizeBytes)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5">
                          {entry.exclusionCandidate && entry.exclusionReason ? (
                            <span className="font-semibold text-rose-800">
                              {zipExclusionReasonLabel(entry.exclusionReason)}
                              {entry.exclusionDetail ? ` (${entry.exclusionDetail})` : ""}
                            </span>
                          ) : checked ? (
                            <span className="font-semibold text-slate-700">수동 선택</span>
                          ) : (
                            <span className="text-store-muted">—</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 align-middle">
                          {checked ? (
                            <input
                              type="text"
                              value={reasonsByPath[entry.path] ?? ""}
                              onChange={(e) => onReasonChange(entry.path, e.target.value)}
                              placeholder={
                                entry.kind === "folder"
                                  ? "폴더 제외사유 (하위 일괄 적용)"
                                  : "제외사유 입력"
                              }
                              className="w-full min-w-[9rem] rounded-md border border-store-border bg-white px-2 py-1 text-[11px] text-slate-800 placeholder:text-slate-400"
                            />
                          ) : (
                            <span className="text-store-muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </section>
  );
}

/** @deprecated Prefer AdminZipPreflightInventoryPanel (inline card). */
export const AdminZipPreflightInventoryDialog = AdminZipPreflightInventoryPanel;
