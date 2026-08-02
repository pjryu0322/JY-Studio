"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import type { AdminWorkInboxItemViewModel } from "@/lib/admin-work-inbox-view-model";
import { adminWorkInboxDetailHref } from "@/lib/admin-work-inbox/admin-work-inbox-navigation";
import {
  formatInboxDate,
  qualityStatusLabel,
  sortWorkInboxItems,
  type WorkInboxSortKey,
  type WorkInboxSortState,
} from "@/lib/admin-work-inbox/admin-work-inbox-format";
import type { AdminWorkQueueKey } from "@/lib/routes";
import {
  DisplayStatusBadge,
  GenerationCreateIcon,
  PreflightInventoryIcon,
  QualityCheckIcon,
} from "@/components/admin-work-inbox/admin-work-inbox-shared";

/** ~5 data rows visible; overflow scrolls. Row ≈ 3.75rem, header ≈ 2.75rem. */
const WORK_INBOX_TABLE_SCROLL_CLASS = "max-h-[calc(2.75rem+5*3.75rem)] overflow-y-auto";

function SortableHeader({
  label,
  sortKey,
  sort,
  onSort,
  className = "",
  align = "left",
}: {
  readonly label: string;
  readonly sortKey: WorkInboxSortKey;
  readonly sort: WorkInboxSortState;
  readonly onSort: (key: WorkInboxSortKey) => void;
  readonly className?: string;
  readonly align?: "left" | "right" | "center";
}) {
  const active = sort.key === sortKey;
  const marker = active ? (sort.dir === "asc" ? " ▲" : " ▼") : "";
  return (
    <th
      className={`whitespace-nowrap px-3 py-2.5 ${className}`}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-0.5 font-bold uppercase tracking-wide ${
          align === "right" ? "ml-auto" : align === "center" ? "mx-auto" : ""
        } ${active ? "text-slate-900" : "text-slate-600 hover:text-slate-900"}`}
      >
        {label}
        {marker ? <span className="text-[10px] text-slate-500">{marker}</span> : null}
      </button>
    </th>
  );
}

export function AdminWorkInboxTable({
  items,
  activeQueue,
  metaByPack,
  selectedPackId,
  onSelectPack,
  selectedPreflightPackId,
  onSelectPreflight,
}: {
  readonly items: readonly AdminWorkInboxItemViewModel[];
  readonly activeQueue: AdminWorkQueueKey;
  readonly metaByPack?: ReadonlyMap<string, string>;
  readonly selectedPackId?: string | null;
  readonly onSelectPack?: (item: AdminWorkInboxItemViewModel) => void;
  readonly selectedPreflightPackId?: string | null;
  readonly onSelectPreflight?: (item: AdminWorkInboxItemViewModel) => void;
}) {
  const [sort, setSort] = useState<WorkInboxSortState>({ key: "requestedAt", dir: "desc" });
  const showPreflight = activeQueue === "generation" || activeQueue === "knowledge-scope";
  const inlineAction =
    (activeQueue === "generation" ||
      activeQueue === "knowledge-scope" ||
      activeQueue === "quality" ||
      activeQueue === "correction") &&
    typeof onSelectPack === "function";

  const sortedItems = useMemo(() => sortWorkInboxItems(items, sort), [items, sort]);

  const toggleSort = useCallback((key: WorkInboxSortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "requestedAt" || key === "acceptedAt" ? "desc" : "asc" },
    );
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-store-border bg-white">
      <div className={`overflow-x-auto ${WORK_INBOX_TABLE_SCROLL_CLASS}`}>
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-600 shadow-[inset_0_-1px_0_0_rgb(226_232_240)]">
            <tr>
              <SortableHeader
                label="번호"
                sortKey="index"
                sort={sort}
                onSort={toggleSort}
                className="w-14 text-center"
                align="center"
              />
              <SortableHeader label="지식팩" sortKey="packName" sort={sort} onSort={toggleSort} />
              <SortableHeader
                label="제공자"
                sortKey="providerName"
                sort={sort}
                onSort={toggleSort}
              />
              <SortableHeader
                label="접수요청일"
                sortKey="requestedAt"
                sort={sort}
                onSort={toggleSort}
              />
              <SortableHeader
                label="접수일"
                sortKey="acceptedAt"
                sort={sort}
                onSort={toggleSort}
              />
              {activeQueue === "quality" ? (
                <>
                  <th className="whitespace-nowrap px-3 py-2.5 text-center">품질점검일</th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-center">품질점검상태</th>
                </>
              ) : null}
              <SortableHeader
                label="현재상태"
                sortKey="displayStatus"
                sort={sort}
                onSort={toggleSort}
              />
              {showPreflight ? (
                <th className="whitespace-nowrap px-3 py-2.5 text-center">사전정리</th>
              ) : null}
              <th className="whitespace-nowrap px-3 py-2.5 text-right">작업</th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((item, index) => {
              const href = adminWorkInboxDetailHref(item, activeQueue);
              const meta = metaByPack?.get(item.packId);
              const selected = selectedPackId === item.packId;
              const preflightSelected = selectedPreflightPackId === item.packId;
              return (
                <tr
                  key={item.packId}
                  className={`border-t border-store-border hover:bg-slate-50/80 ${
                    selected || preflightSelected ? "bg-sky-50/80" : ""
                  }`}
                >
                  <td className="whitespace-nowrap px-3 py-2.5 text-center align-middle text-slate-600">
                    {index + 1}
                  </td>
                  <td className="max-w-[14rem] px-3 py-2.5 align-middle">
                    <p className="truncate font-semibold text-slate-900">{item.packName}</p>
                    <p className="mt-0.5 truncate text-[11px] text-store-muted">
                      {[item.categoryName, item.versionLabel, meta]
                        .filter(Boolean)
                        .join(" · ") || item.packId}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 align-middle text-slate-700">
                    {item.providerName?.trim() || "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 align-middle text-slate-700">
                    {formatInboxDate(item.requestedAt)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 align-middle text-slate-700">
                    {formatInboxDate(item.acceptedAt)}
                  </td>
                  {activeQueue === "quality" ? (
                    <>
                      <td className="whitespace-nowrap px-3 py-2.5 align-middle text-slate-700">
                        {formatInboxDate(item.qualityCheckedAt)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 align-middle text-slate-700">
                        {qualityStatusLabel(item.qualityStatus)}
                      </td>
                    </>
                  ) : null}
                  <td className="whitespace-nowrap px-3 py-2.5 align-middle">
                    <DisplayStatusBadge
                      displayStatus={item.displayStatus}
                      queueGroup={item.adminQueueGroup}
                    />
                  </td>
                  {showPreflight ? (
                    <td className="whitespace-nowrap px-3 py-2.5 text-center align-middle">
                      <button
                        type="button"
                        title="사전정리 · 원본 인벤토리 보기"
                        aria-label={`${item.packName} 사전정리 보기`}
                        aria-pressed={preflightSelected}
                        onClick={() => onSelectPreflight?.(item)}
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                          preflightSelected
                            ? "border-sky-300 bg-sky-100 text-sky-900"
                            : "border-store-border bg-white text-slate-600 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-800"
                        }`}
                      >
                        <PreflightInventoryIcon />
                      </button>
                    </td>
                  ) : null}
                  <td className="whitespace-nowrap px-3 py-2.5 align-middle text-right">
                    {inlineAction && activeQueue === "generation" ? (
                      <button
                        type="button"
                        title="지식데이터 생성"
                        aria-label={`${item.packName} 지식데이터 생성`}
                        aria-pressed={selected}
                        onClick={() => onSelectPack?.(item)}
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                          selected
                            ? "border-sky-300 bg-sky-100 text-sky-900"
                            : "border-store-border bg-white text-slate-600 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-800"
                        }`}
                      >
                        <GenerationCreateIcon />
                      </button>
                    ) : inlineAction && activeQueue === "quality" ? (
                      <button
                        type="button"
                        title="품질점검"
                        aria-label={`${item.packName} 품질점검`}
                        aria-pressed={selected}
                        onClick={() => onSelectPack?.(item)}
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                          selected
                            ? "border-sky-300 bg-sky-100 text-sky-900"
                            : "border-store-border bg-white text-slate-600 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-800"
                        }`}
                      >
                        <QualityCheckIcon />
                      </button>
                    ) : inlineAction && activeQueue === "correction" ? (
                      <button
                        type="button"
                        title="조치하기"
                        aria-label={`${item.packName} 조치하기`}
                        aria-pressed={selected}
                        onClick={() => onSelectPack?.(item)}
                        className={`inline-flex min-h-[32px] items-center rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${
                          selected
                            ? "bg-sky-700 text-white"
                            : "bg-store-accent text-white hover:opacity-90"
                        }`}
                      >
                        조치하기
                      </button>
                    ) : (
                      <Link
                        href={href}
                        className="inline-flex min-h-[32px] items-center rounded-lg bg-store-accent px-2.5 py-1.5 text-[11px] font-bold text-white"
                      >
                        {item.ctaLabel}
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
