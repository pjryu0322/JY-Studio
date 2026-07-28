"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminCorrectionQueuePanel } from "@/components/AdminCorrectionQueuePanel";
import { AdminKnowledgeGenerationPanel } from "@/components/AdminKnowledgeGenerationPanel";
import { AdminZipPreflightInventoryPanel } from "@/components/AdminZipPreflightInventoryDialog";
import type { AdminReviewListItemDto } from "@/lib/admin-review-dto";
import { isAdminQualityReviewAcknowledged } from "@/lib/admin-quality-review-ack-session";
import {
  fetchAdminReviewItems,
  fetchAdminWorkerZipRequests,
  type AdminProviderReturnedPackListItem,
  type AdminWorkerZipRequestListItem,
} from "@/lib/admin-review-api";
import {
  buildAdminWorkInboxItemViewModel,
  countAdminWorkInboxWaiting,
  filterAdminCorrectionQueue,
  filterAdminWorkInboxByQueueGroup,
  filterAdminWorkQueue,
  mergeAdminWorkInboxViewModels,
  partitionAdminReviewRequiredByServicePhase,
  type AdminWorkInboxItemViewModel,
  type AdminWorkInboxQueueGroup,
} from "@/lib/admin-work-inbox-view-model";
import {
  ADMIN_WORK_EMPTY,
  ADMIN_WORK_FILTER_CATEGORY_ALL,
  ADMIN_WORK_FILTER_NO_MATCH,
  ADMIN_WORK_FILTER_STATUS_ACCEPT,
  ADMIN_WORK_FILTER_STATUS_ALL,
  ADMIN_WORK_FILTER_STATUS_GENERATE,
  ADMIN_WORK_FILTER_STATUS_PACK_REVIEW,
  ADMIN_WORK_FILTER_STATUS_PACK_REVIEW_IN_PROGRESS,
  ADMIN_WORK_FILTER_STATUS_PROVIDER_REVIEW,
  ADMIN_WORK_FILTER_STATUS_QUALITY,
  ADMIN_WORK_FILTER_STATUS_RETURNED,
  ADMIN_WORK_FILTER_STATUS_SERVICE_VALIDATION,
  ADMIN_WORK_CORRECTION_TARGETS_TITLE,
  ADMIN_WORK_GENERATION_TARGETS_TITLE,
  ADMIN_WORK_QUALITY_TARGETS_TITLE,
  ADMIN_WORK_SECTION_ACCEPT_BODY,
  ADMIN_WORK_SECTION_ACCEPT_TITLE,
  ADMIN_WORK_SECTION_GENERATE_BODY,
  ADMIN_WORK_SECTION_GENERATE_TITLE,
  ADMIN_WORK_SECTION_PACK_REVIEW_BODY,
  ADMIN_WORK_SECTION_PACK_REVIEW_IN_PROGRESS_BODY,
  ADMIN_WORK_SECTION_PACK_REVIEW_IN_PROGRESS_TITLE,
  ADMIN_WORK_SECTION_PACK_REVIEW_TITLE,
  ADMIN_WORK_SECTION_PROVIDER_REVIEW_BODY,
  ADMIN_WORK_SECTION_PROVIDER_REVIEW_TITLE,
  ADMIN_WORK_SECTION_PUBLISHED_BODY,
  ADMIN_WORK_SECTION_PUBLISHED_TITLE,
  ADMIN_WORK_SECTION_RETURNED_BODY,
  ADMIN_WORK_SECTION_RETURNED_TITLE,
  ADMIN_WORK_SECTION_SERVICE_VALIDATION_BODY,
  ADMIN_WORK_SECTION_SERVICE_VALIDATION_TITLE,
  ADMIN_WORK_SUMMARY_LABEL,
} from "@/lib/role-based-ux-copy";
import {
  adminReviewDetailPath,
  normalizeAdminWorkQueue,
  parseAdminWorkQueue,
  type AdminWorkQueueKey,
} from "@/lib/routes";

type WorkStatusFilter =
  | "all"
  | "accept"
  | "generate"
  | "quality"
  | "provider_review"
  | "service_validation"
  | "pack_review"
  | "pack_review_in_progress"
  | "returned";

const FILTER_TO_GROUPS: Record<WorkStatusFilter, AdminWorkInboxQueueGroup[] | null> = {
  all: null,
  accept: ["ACCEPT_REQUIRED"],
  generate: ["GENERATE_REQUIRED", "QUALITY_CHECK_REQUIRED"],
  quality: ["GENERATE_REQUIRED", "QUALITY_CHECK_REQUIRED"],
  provider_review: ["PROVIDER_REVIEW_IN_PROGRESS"],
  service_validation: ["ADMIN_REVIEW_REQUIRED"],
  pack_review: ["ADMIN_REVIEW_REQUIRED"],
  pack_review_in_progress: ["ADMIN_REVIEW_IN_PROGRESS"],
  returned: ["PROVIDER_SUPPLEMENT_REQUIRED", "RETURNED_OR_REJECTED"],
};

type WorkSectionProps = {
  readonly title: string;
  readonly body: string;
  readonly count: number;
  readonly accentClass: string;
  readonly children: ReactNode;
};

function WorkSection({ title, body, count, accentClass, children }: WorkSectionProps) {
  if (count === 0) return null;
  return (
    <section className="space-y-2">
      <div className="px-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-bold text-slate-900">{title}</h2>
          <span
            className={`inline-flex min-w-[1.5rem] items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-bold ${accentClass}`}
          >
            {count}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] text-store-muted">{body}</p>
      </div>
      {children}
    </section>
  );
}

function DisplayStatusBadge({
  displayStatus,
  queueGroup,
}: {
  readonly displayStatus: string;
  readonly queueGroup: AdminWorkInboxQueueGroup;
}) {
  const className =
    queueGroup === "PUBLISHED"
      ? "bg-emerald-100 text-emerald-900"
      : queueGroup === "PROVIDER_REVIEW_IN_PROGRESS"
        ? "bg-violet-100 text-violet-900"
        : queueGroup === "QUALITY_CHECK_REQUIRED"
          ? "bg-amber-100 text-amber-900"
          : queueGroup === "PROVIDER_SUPPLEMENT_REQUIRED" ||
              queueGroup === "RETURNED_OR_REJECTED"
            ? "bg-rose-100 text-rose-900"
            : queueGroup === "ADMIN_REVIEW_REQUIRED" || queueGroup === "ADMIN_REVIEW_IN_PROGRESS"
              ? "bg-orange-100 text-orange-900"
              : queueGroup === "GENERATE_REQUIRED"
                ? "bg-sky-100 text-sky-900"
                : "bg-indigo-100 text-indigo-900";
  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${className}`}
    >
      {displayStatus}
    </span>
  );
}

function adminWorkInboxDetailHref(
  item: AdminWorkInboxItemViewModel,
  queueScope: AdminWorkQueueKey | "all" = "all",
): string {
  const base = adminReviewDetailPath(item.packId);
  const scope =
    queueScope === "all" || queueScope === "ops"
      ? queueScope
      : normalizeAdminWorkQueue(queueScope);
  switch (scope) {
    case "receipt":
      return `${base}?step=receipt`;
    case "knowledge-scope":
      return `${base}?step=knowledgeScope`;
    case "generation":
      return `${base}?step=generation`;
    case "correction":
      return `${base}?step=correction`;
    case "service-validation":
      return `${base}?step=serviceValidation`;
    case "publish":
      return `${base}?step=publish`;
    default:
      break;
  }
  switch (item.adminQueueGroup) {
    case "ACCEPT_REQUIRED":
      return `${base}?step=receipt`;
    case "GENERATE_REQUIRED":
      return item.workerZipPhase === "ACCEPTED"
        ? `${base}?step=knowledgeScope`
        : `${base}?step=generation`;
    case "QUALITY_CHECK_REQUIRED":
      return `${base}?step=generation`;
    case "PROVIDER_REVIEW_IN_PROGRESS":
    case "RETURNED_OR_REJECTED":
      return `${base}?step=publish`;
    case "PROVIDER_SUPPLEMENT_REQUIRED":
      return `${base}?step=correction`;
    case "ADMIN_REVIEW_REQUIRED":
      return item.serviceValidationPhase === "PASSED"
        ? `${base}?step=publish`
        : `${base}?step=serviceValidation`;
    case "ADMIN_REVIEW_IN_PROGRESS":
      return `${base}?step=publish`;
    default:
      return base;
  }
}

function formatInboxDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
}

/** Table columns — date only (no time). */
function formatInboxDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("ko-KR", { dateStyle: "medium" });
}

function qualityStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "PASS":
      return "통과";
    case "WARNING":
      return "주의";
    case "FAIL":
      return "차단(FAIL)";
    case "IN_PROGRESS":
      return "진행 중";
    case "NOT_CHECKED":
    default:
      return "미점검";
  }
}

type WorkInboxSortKey =
  | "index"
  | "packName"
  | "providerName"
  | "requestedAt"
  | "acceptedAt"
  | "displayStatus";

type WorkInboxSortState = {
  key: WorkInboxSortKey;
  dir: "asc" | "desc";
};

function compareNullableText(a: string | null | undefined, b: string | null | undefined): number {
  return (a?.trim() || "").localeCompare(b?.trim() || "", "ko", { sensitivity: "base" });
}

function compareNullableDate(a: string | null | undefined, b: string | null | undefined): number {
  const ta = a ? Date.parse(a) : Number.NaN;
  const tb = b ? Date.parse(b) : Number.NaN;
  const aOk = Number.isFinite(ta);
  const bOk = Number.isFinite(tb);
  if (!aOk && !bOk) return 0;
  if (!aOk) return 1;
  if (!bOk) return -1;
  return ta - tb;
}

function sortWorkInboxItems(
  items: readonly AdminWorkInboxItemViewModel[],
  sort: WorkInboxSortState,
): AdminWorkInboxItemViewModel[] {
  const sorted = [...items];
  sorted.sort((a, b) => {
    let cmp = 0;
    switch (sort.key) {
      case "index":
        cmp = a.packId.localeCompare(b.packId);
        break;
      case "packName":
        cmp = compareNullableText(a.packName, b.packName);
        break;
      case "providerName":
        cmp = compareNullableText(a.providerName, b.providerName);
        break;
      case "requestedAt":
        cmp = compareNullableDate(a.requestedAt, b.requestedAt);
        break;
      case "acceptedAt":
        cmp = compareNullableDate(a.acceptedAt, b.acceptedAt);
        break;
      case "displayStatus":
        cmp = compareNullableText(a.displayStatus, b.displayStatus);
        break;
      default:
        cmp = 0;
    }
    if (cmp === 0) cmp = a.packName.localeCompare(b.packName, "ko");
    return sort.dir === "asc" ? cmp : -cmp;
  });
  return sorted;
}

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

/** Play / create icon for 지식데이터 생성 실행. */
function GenerationCreateIcon({ className = "h-4 w-4" }: { readonly className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M10 8.5v7l6-3.5-6-3.5z" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Inventory / crate icon for 사전정리. */
function PreflightInventoryIcon({ className = "h-4 w-4" }: { readonly className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 8H3l2-4h14l2 4z" />
      <path d="M3 8v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8" />
      <path d="M10 12h4" />
      <path d="M12 12v5" />
    </svg>
  );
}

/** Checkmark icon for 품질점검. */
function QualityCheckIcon({ className = "h-4 w-4" }: { readonly className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 12l2.5 2.5L16 9" />
    </svg>
  );
}

/** ~5 data rows visible; overflow scrolls. Row ≈ 3.75rem, header ≈ 2.75rem. */
const WORK_INBOX_TABLE_SCROLL_CLASS = "max-h-[calc(2.75rem+5*3.75rem)] overflow-y-auto";

function WorkInboxTable({
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

function WorkInboxCard({
  item,
  metaLine,
  href,
}: {
  readonly item: AdminWorkInboxItemViewModel;
  readonly metaLine?: string | null;
  readonly href?: string;
}) {
  return (
    <li>
      <Link
        href={href ?? adminWorkInboxDetailHref(item)}
        className="flex items-center gap-2 rounded-xl border border-store-border bg-white px-3 py-2.5 transition hover:bg-slate-50"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-slate-900">{item.packName}</p>
            <DisplayStatusBadge
              displayStatus={item.displayStatus}
              queueGroup={item.adminQueueGroup}
            />
          </div>
          <p className="mt-0.5 truncate text-[11px] text-store-muted">
            {metaLine?.trim() ||
              [item.categoryName, item.providerName, item.versionLabel]
                .filter(Boolean)
                .join(" · ")}
          </p>
          {(item.requestedAt || item.acceptedAt) && (
            <p className="mt-0.5 truncate text-[11px] text-store-muted">
              접수요청 {formatInboxDateTime(item.requestedAt)}
              {item.acceptedAt
                ? ` · 접수 ${formatInboxDateTime(item.acceptedAt)}`
                : ""}
            </p>
          )}
        </div>
        <span className="shrink-0 rounded-lg bg-store-accent px-2.5 py-1.5 text-[11px] font-bold text-white">
          {item.ctaLabel}
        </span>
      </Link>
    </li>
  );
}

function zipItemToViewModel(item: AdminWorkerZipRequestListItem): AdminWorkInboxItemViewModel {
  if (item.displayStatus && item.adminQueueGroup && item.ctaLabel) {
    return {
      packId: item.packId,
      packName: item.packName,
      sourceKind: "WORKER_ZIP",
      packStatus: item.packStatus ?? "DRAFT",
      workflowStatus: (item.workflowStatus as AdminWorkInboxItemViewModel["workflowStatus"]) || "DRAFT",
      workerZipPhase: item.phase,
      providerReviewPhase: item.providerReviewPhase ?? "NONE",
      serviceValidationPhase: item.serviceValidationPhase ?? "NONE",
      packReviewStatus: null,
      adminQueueGroup: item.adminQueueGroup as AdminWorkInboxQueueGroup,
      displayStatus: item.displayStatus,
      ctaLabel: item.ctaLabel,
      isWaitingForAdmin: Boolean(item.isWaitingForAdmin),
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      providerName: item.providerName,
      versionLabel: item.versionLabel,
      providerSupplementPhase: "NONE",
      requestedAt: item.requestedAt ?? null,
      acceptedAt: item.acceptedAt ?? null,
      qualityCheckedAt: item.qualityCheckedAt ?? null,
      qualityStatus: item.qualityStatus ?? null,
    };
  }
  return buildAdminWorkInboxItemViewModel({
    packId: item.packId,
    packName: item.packName,
    packStatus: item.packStatus ?? "DRAFT",
    sourceKind: "WORKER_ZIP",
    workerZipPhase: item.phase,
    providerReviewPhase: item.providerReviewPhase ?? "NONE",
    serviceValidationPhase: item.serviceValidationPhase ?? "NONE",
    categoryId: item.categoryId,
    categoryName: item.categoryName,
    providerName: item.providerName,
    versionLabel: item.versionLabel,
    requestedAt: item.requestedAt,
    acceptedAt: item.acceptedAt,
    qualityCheckedAt: item.qualityCheckedAt,
    qualityStatus: item.qualityStatus,
  });
}

function reviewItemToViewModel(item: AdminReviewListItemDto): AdminWorkInboxItemViewModel {
  return buildAdminWorkInboxItemViewModel({
    packId: item.packId,
    packName: item.name,
    packStatus: item.status,
    sourceKind: "REVIEW",
    packReviewStatus: item.reviewStatus,
    providerReviewPhase: item.providerReviewPhase ?? "NONE",
    serviceValidationPhase: item.serviceValidationPhase ?? "NONE",
    categoryId: item.categoryId,
    categoryName: item.categoryName,
    providerName: item.providerName,
  });
}

function returnedItemToViewModel(
  item: AdminProviderReturnedPackListItem,
): AdminWorkInboxItemViewModel & { metaLine?: string } {
  const submitted = item.withdrawnAt
    ? new Date(item.withdrawnAt).toLocaleString("ko-KR", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  const metaLine = [
    item.providerName,
    item.changeTypeLabel,
    (item.targetCount ?? 0) > 0 ? `대상 ${item.targetCount}건` : null,
    item.changesRequest?.details
      ? item.changesRequest.details.length > 40
        ? `${item.changesRequest.details.slice(0, 40)}…`
        : item.changesRequest.details
      : null,
    submitted ? `제출 ${submitted}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const base = buildAdminWorkInboxItemViewModel({
    packId: item.packId,
    packName: item.packName,
    packStatus: item.packStatus ?? "DRAFT",
    sourceKind: "OTHER",
    providerReviewPhase: "WITHDRAWN",
    providerSupplementPhase: (item.providerSupplementPhase ??
      "PENDING") as import("@/lib/provider-supplement-request").ProviderSupplementAdminPhase,
    serviceValidationPhase: item.serviceValidationPhase ?? "NONE",
    categoryId: item.categoryId,
    categoryName: item.categoryName,
    providerName: item.providerName,
    versionLabel: item.versionLabel,
  });

  return {
    ...base,
    displayStatus: item.displayStatus || base.displayStatus,
    ctaLabel: item.ctaLabel || base.ctaLabel,
    adminQueueGroup:
      (item.adminQueueGroup as AdminWorkInboxQueueGroup) || base.adminQueueGroup,
    isWaitingForAdmin:
      item.isWaitingForAdmin !== undefined
        ? Boolean(item.isWaitingForAdmin)
        : base.isWaitingForAdmin,
    metaLine,
  };
}

/**
 * Admin first screen — work inbox ordered by what the admin must do next.
 * Stage rails pass `?queue=` (or legacy queueScope prop) to filter the list.
 */
export function AdminWorkInboxPageClient({
  initialStatusFilter = "all",
  lockStatusFilter = false,
  queueScope,
}: {
  readonly initialStatusFilter?: WorkStatusFilter;
  /** When true, status filter stays fixed at initialStatusFilter (stage rail pages). */
  readonly lockStatusFilter?: boolean;
  /** @deprecated Prefer `?queue=` on `/admin`. */
  readonly queueScope?: AdminWorkQueueKey | "generation";
} = {}) {
  const searchParams = useSearchParams();
  const activeQueue: AdminWorkQueueKey =
    queueScope === "generation"
      ? "generation"
      : queueScope && queueScope !== "all"
        ? queueScope
        : parseAdminWorkQueue(searchParams.get("queue"));
  const stageFiltered = activeQueue !== "all";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zipItems, setZipItems] = useState<AdminWorkerZipRequestListItem[]>([]);
  const [returnedItems, setReturnedItems] = useState<AdminProviderReturnedPackListItem[]>(
    [],
  );
  const [reviewItems, setReviewItems] = useState<AdminReviewListItemDto[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<WorkStatusFilter>(initialStatusFilter);
  const [selectedGenerationPackId, setSelectedGenerationPackId] = useState<string | null>(null);
  const [selectedQualityPackId, setSelectedQualityPackId] = useState<string | null>(null);
  const [selectedCorrectionPack, setSelectedCorrectionPack] = useState<{
    packId: string;
    packName: string;
  } | null>(null);
  const [qualityAckEpoch, setQualityAckEpoch] = useState(0);
  const [selectedPreflightPack, setSelectedPreflightPack] = useState<{
    packId: string;
    packName: string;
  } | null>(null);
  const [preflightCollapsed, setPreflightCollapsed] = useState(false);
  const statusFilterLocked = lockStatusFilter || stageFiltered;

  useEffect(() => {
    if (activeQueue !== "correction") return;
    const bump = () => setQualityAckEpoch((n) => n + 1);
    bump();
    window.addEventListener("focus", bump);
    return () => window.removeEventListener("focus", bump);
  }, [activeQueue]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [zip, reviews] = await Promise.all([
        fetchAdminWorkerZipRequests(),
        fetchAdminReviewItems(),
      ]);
      setZipItems(zip.items);
      setReturnedItems(zip.returnedItems ?? []);
      setReviewItems(reviews.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "작업 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const allViewItems = useMemo(
    () =>
      mergeAdminWorkInboxViewModels([
        ...zipItems.map(zipItemToViewModel),
        ...returnedItems.map(returnedItemToViewModel),
        ...reviewItems.map(reviewItemToViewModel),
      ]),
    [zipItems, returnedItems, reviewItems],
  );

  const categoryOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of allViewItems) {
      if (item.categoryId) {
        map.set(item.categoryId, item.categoryName?.trim() || item.categoryId);
      }
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [allViewItems]);

  const filteredViewItems = useMemo(() => {
    const byCategory = allViewItems.filter((item) => {
      if (categoryFilter !== "all" && item.categoryId !== categoryFilter) return false;
      return true;
    });

    if (stageFiltered && activeQueue !== "ops") {
      if (activeQueue === "correction") {
        return filterAdminCorrectionQueue(byCategory, isAdminQualityReviewAcknowledged);
      }
      return filterAdminWorkQueue(byCategory, activeQueue);
    }

    const groups = FILTER_TO_GROUPS[statusFilter];
    return byCategory.filter((item) => {
      if (groups && !groups.includes(item.adminQueueGroup)) return false;
      if (statusFilter === "service_validation") {
        return (
          item.adminQueueGroup === "ADMIN_REVIEW_REQUIRED" &&
          item.serviceValidationPhase !== "PASSED"
        );
      }
      if (statusFilter === "pack_review") {
        return (
          item.adminQueueGroup === "ADMIN_REVIEW_REQUIRED" &&
          item.serviceValidationPhase === "PASSED"
        );
      }
      return true;
    });
  }, [allViewItems, categoryFilter, statusFilter, stageFiltered, activeQueue, qualityAckEpoch]);

  useEffect(() => {
    if (activeQueue !== "generation") {
      setSelectedGenerationPackId(null);
      setSelectedPreflightPack(null);
      setPreflightCollapsed(false);
    }
    if (activeQueue !== "quality") {
      setSelectedQualityPackId(null);
    }
    if (activeQueue !== "correction") {
      setSelectedCorrectionPack(null);
    }
    if (
      selectedGenerationPackId &&
      !filteredViewItems.some((item) => item.packId === selectedGenerationPackId)
    ) {
      setSelectedGenerationPackId(null);
    }
    if (
      selectedQualityPackId &&
      !filteredViewItems.some((item) => item.packId === selectedQualityPackId)
    ) {
      setSelectedQualityPackId(null);
    }
    if (
      selectedCorrectionPack &&
      !filteredViewItems.some((item) => item.packId === selectedCorrectionPack.packId)
    ) {
      setSelectedCorrectionPack(null);
    }
    if (
      selectedPreflightPack &&
      !filteredViewItems.some((item) => item.packId === selectedPreflightPack.packId)
    ) {
      setSelectedPreflightPack(null);
      setPreflightCollapsed(false);
    }
  }, [
    activeQueue,
    filteredViewItems,
    selectedGenerationPackId,
    selectedQualityPackId,
    selectedCorrectionPack,
    selectedPreflightPack,
  ]);

  const acceptItems =
    stageFiltered
      ? activeQueue === "receipt" || activeQueue === "accept"
        ? filteredViewItems
        : []
      : filterAdminWorkInboxByQueueGroup(filteredViewItems, "ACCEPT_REQUIRED");
  const generateItems = stageFiltered
    ? activeQueue === "receipt" || activeQueue === "accept"
      ? []
      : filteredViewItems
    : [
        ...filterAdminWorkInboxByQueueGroup(filteredViewItems, "GENERATE_REQUIRED"),
        ...filterAdminWorkInboxByQueueGroup(filteredViewItems, "QUALITY_CHECK_REQUIRED"),
      ];
  const providerReviewInProgressItems = stageFiltered
    ? []
    : filterAdminWorkInboxByQueueGroup(filteredViewItems, "PROVIDER_REVIEW_IN_PROGRESS");
  const adminReviewRequiredItems = stageFiltered
    ? []
    : filterAdminWorkInboxByQueueGroup(filteredViewItems, "ADMIN_REVIEW_REQUIRED");
  const { serviceValidationWaiting: serviceValidationItems, approvalWaiting: packReviewRequiredItems } =
    partitionAdminReviewRequiredByServicePhase(adminReviewRequiredItems);
  const packReviewInProgressItems = stageFiltered
    ? []
    : filterAdminWorkInboxByQueueGroup(filteredViewItems, "ADMIN_REVIEW_IN_PROGRESS");
  const returnedOrRejectedItems = stageFiltered
    ? []
    : filterAdminWorkInboxByQueueGroup(filteredViewItems, "PROVIDER_SUPPLEMENT_REQUIRED");
  const legacyReturnedItems = stageFiltered
    ? []
    : filterAdminWorkInboxByQueueGroup(filteredViewItems, "RETURNED_OR_REJECTED");
  const publishedItems = stageFiltered
    ? []
    : filterAdminWorkInboxByQueueGroup(filteredViewItems, "PUBLISHED");

  const returnedMetaByPack = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of returnedItems) {
      const vm = returnedItemToViewModel(item);
      if (vm.metaLine) map.set(item.packId, vm.metaLine);
    }
    return map;
  }, [returnedItems]);

  const totalWaiting = countAdminWorkInboxWaiting(filteredViewItems);
  const rawTotal = allViewItems.length;
  const visibleCount = stageFiltered
    ? filteredViewItems.length
    : acceptItems.length +
      generateItems.length +
      providerReviewInProgressItems.length +
      serviceValidationItems.length +
      packReviewRequiredItems.length +
      packReviewInProgressItems.length +
      returnedOrRejectedItems.length +
      legacyReturnedItems.length +
      publishedItems.length;

  return (
    <div className="space-y-5 pb-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {!loading ? (
          <p className="px-1 text-xs font-semibold text-slate-700">
            {activeQueue === "generation"
              ? ADMIN_WORK_GENERATION_TARGETS_TITLE
              : activeQueue === "quality"
                ? ADMIN_WORK_QUALITY_TARGETS_TITLE
                : activeQueue === "correction"
                  ? ADMIN_WORK_CORRECTION_TARGETS_TITLE
                  : `${ADMIN_WORK_SUMMARY_LABEL} ${totalWaiting}건`}
            {activeQueue !== "generation" &&
            activeQueue !== "quality" &&
            activeQueue !== "correction" &&
            (categoryFilter !== "all" || statusFilter !== "all")
              ? ` (전체 ${rawTotal}건)`
              : ""}
          </p>
        ) : (
          <span />
        )}
        <div className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="admin-work-category">
            카테고리
          </label>
          <select
            id="admin-work-category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="min-h-[36px] rounded-lg border border-store-border bg-white px-2.5 text-xs text-slate-800"
          >
            <option value="all">{ADMIN_WORK_FILTER_CATEGORY_ALL}</option>
            {categoryOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.name}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="admin-work-status">
            상태
          </label>
          <select
            id="admin-work-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as WorkStatusFilter)}
            disabled={statusFilterLocked}
            className="min-h-[36px] rounded-lg border border-store-border bg-white px-2.5 text-xs text-slate-800 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-600"
          >
            <option value="all">{ADMIN_WORK_FILTER_STATUS_ALL}</option>
            <option value="accept">{ADMIN_WORK_FILTER_STATUS_ACCEPT}</option>
            <option value="generate">{ADMIN_WORK_FILTER_STATUS_GENERATE}</option>
            <option value="quality">{ADMIN_WORK_FILTER_STATUS_QUALITY}</option>
            <option value="provider_review">{ADMIN_WORK_FILTER_STATUS_PROVIDER_REVIEW}</option>
            <option value="service_validation">
              {ADMIN_WORK_FILTER_STATUS_SERVICE_VALIDATION}
            </option>
            <option value="pack_review">{ADMIN_WORK_FILTER_STATUS_PACK_REVIEW}</option>
            <option value="pack_review_in_progress">
              {ADMIN_WORK_FILTER_STATUS_PACK_REVIEW_IN_PROGRESS}
            </option>
            <option value="returned">{ADMIN_WORK_FILTER_STATUS_RETURNED}</option>
          </select>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-store-muted">불러오는 중…</p>
      ) : rawTotal === 0 ? (
        <p className="rounded-2xl border border-store-border bg-white p-4 text-sm text-store-muted">
          {ADMIN_WORK_EMPTY}
        </p>
      ) : visibleCount === 0 ? (
        <p className="rounded-2xl border border-dashed border-store-border bg-white px-4 py-3 text-sm text-store-muted">
          {ADMIN_WORK_FILTER_NO_MATCH}
        </p>
      ) : stageFiltered ? (
        <div className="space-y-4">
          <WorkInboxTable
            items={filteredViewItems}
            activeQueue={activeQueue}
            metaByPack={returnedMetaByPack}
            selectedPackId={
              activeQueue === "generation"
                ? selectedGenerationPackId
                : activeQueue === "quality"
                  ? selectedQualityPackId
                  : activeQueue === "correction"
                    ? (selectedCorrectionPack?.packId ?? null)
                    : null
            }
            onSelectPack={
              activeQueue === "generation"
                ? (item) => {
                    // Show generation card only — do not auto-start. Collapse preflight if open.
                    setPreflightCollapsed(true);
                    setSelectedGenerationPackId(item.packId);
                  }
                : activeQueue === "quality"
                  ? (item) => {
                      setSelectedQualityPackId(item.packId);
                    }
                  : activeQueue === "correction"
                    ? (item) => {
                        setSelectedCorrectionPack((prev) =>
                          prev?.packId === item.packId
                            ? null
                            : { packId: item.packId, packName: item.packName },
                        );
                      }
                    : undefined
            }
            selectedPreflightPackId={
              activeQueue === "generation" ? (selectedPreflightPack?.packId ?? null) : null
            }
            onSelectPreflight={
              activeQueue === "generation"
                ? (item) =>
                    setSelectedPreflightPack((prev) => {
                      if (prev?.packId === item.packId) {
                        setPreflightCollapsed(false);
                        return null;
                      }
                      setPreflightCollapsed(false);
                      return { packId: item.packId, packName: item.packName };
                    })
                : undefined
            }
          />
          {activeQueue === "generation" && selectedPreflightPack ? (
            <AdminZipPreflightInventoryPanel
              key={`preflight-${selectedPreflightPack.packId}`}
              packId={selectedPreflightPack.packId}
              packName={selectedPreflightPack.packName}
              collapsed={preflightCollapsed}
              onCollapsedChange={setPreflightCollapsed}
            />
          ) : null}
          {activeQueue === "generation" && selectedGenerationPackId ? (
            <AdminKnowledgeGenerationPanel
              key={`gen-${selectedGenerationPackId}`}
              packId={selectedGenerationPackId}
              workbenchMode="generation"
              onReviewDetailRefresh={refresh}
            />
          ) : null}
          {activeQueue === "quality" && selectedQualityPackId ? (
            <AdminKnowledgeGenerationPanel
              key={`quality-${selectedQualityPackId}`}
              packId={selectedQualityPackId}
              workbenchMode="quality"
              preferQualitySection
              onReviewDetailRefresh={refresh}
            />
          ) : null}
          {activeQueue === "correction" && selectedCorrectionPack ? (
            <AdminCorrectionQueuePanel
              key={`correction-${selectedCorrectionPack.packId}`}
              packId={selectedCorrectionPack.packId}
              packName={selectedCorrectionPack.packName}
              onChanged={refresh}
            />
          ) : null}
        </div>
      ) : (
        <>
          <WorkSection
            title={ADMIN_WORK_SECTION_ACCEPT_TITLE}
            body={ADMIN_WORK_SECTION_ACCEPT_BODY}
            count={acceptItems.length}
            accentClass="bg-indigo-100 text-indigo-900"
          >
            <ul className="space-y-1.5">
              {acceptItems.map((item) => (
                <WorkInboxCard key={item.packId} item={item} />
              ))}
            </ul>
          </WorkSection>

          <WorkSection
            title={ADMIN_WORK_SECTION_GENERATE_TITLE}
            body={ADMIN_WORK_SECTION_GENERATE_BODY}
            count={generateItems.length}
            accentClass="bg-sky-100 text-sky-900"
          >
            <ul className="space-y-1.5">
              {generateItems.map((item) => (
                <WorkInboxCard
                  key={item.packId}
                  item={item}
                  href={adminWorkInboxDetailHref(item, activeQueue)}
                  metaLine={returnedMetaByPack.get(item.packId)}
                />
              ))}
            </ul>
          </WorkSection>

          <WorkSection
            title={ADMIN_WORK_SECTION_PROVIDER_REVIEW_TITLE}
            body={ADMIN_WORK_SECTION_PROVIDER_REVIEW_BODY}
            count={providerReviewInProgressItems.length}
            accentClass="bg-violet-100 text-violet-900"
          >
            <ul className="space-y-1.5">
              {providerReviewInProgressItems.map((item) => (
                <WorkInboxCard key={item.packId} item={item} />
              ))}
            </ul>
          </WorkSection>

          <WorkSection
            title={ADMIN_WORK_SECTION_SERVICE_VALIDATION_TITLE}
            body={ADMIN_WORK_SECTION_SERVICE_VALIDATION_BODY}
            count={serviceValidationItems.length}
            accentClass="bg-teal-100 text-teal-900"
          >
            <ul className="space-y-1.5">
              {serviceValidationItems.map((item) => (
                <WorkInboxCard key={item.packId} item={item} />
              ))}
            </ul>
          </WorkSection>

          <WorkSection
            title={ADMIN_WORK_SECTION_PACK_REVIEW_TITLE}
            body={ADMIN_WORK_SECTION_PACK_REVIEW_BODY}
            count={packReviewRequiredItems.length}
            accentClass="bg-orange-100 text-orange-900"
          >
            <ul className="space-y-1.5">
              {packReviewRequiredItems.map((item) => (
                <WorkInboxCard key={item.packId} item={item} />
              ))}
            </ul>
          </WorkSection>

          <WorkSection
            title={ADMIN_WORK_SECTION_PACK_REVIEW_IN_PROGRESS_TITLE}
            body={ADMIN_WORK_SECTION_PACK_REVIEW_IN_PROGRESS_BODY}
            count={packReviewInProgressItems.length}
            accentClass="bg-orange-100 text-orange-900"
          >
            <ul className="space-y-1.5">
              {packReviewInProgressItems.map((item) => (
                <WorkInboxCard key={item.packId} item={item} />
              ))}
            </ul>
          </WorkSection>

          <WorkSection
            title={ADMIN_WORK_SECTION_RETURNED_TITLE}
            body={ADMIN_WORK_SECTION_RETURNED_BODY}
            count={returnedOrRejectedItems.length + legacyReturnedItems.length}
            accentClass="bg-rose-100 text-rose-900"
          >
            <ul className="space-y-1.5">
              {[...returnedOrRejectedItems, ...legacyReturnedItems].map((item) => (
                <WorkInboxCard
                  key={item.packId}
                  item={item}
                  metaLine={returnedMetaByPack.get(item.packId)}
                />
              ))}
            </ul>
          </WorkSection>

          <WorkSection
            title={ADMIN_WORK_SECTION_PUBLISHED_TITLE}
            body={ADMIN_WORK_SECTION_PUBLISHED_BODY}
            count={publishedItems.length}
            accentClass="bg-emerald-100 text-emerald-900"
          >
            <ul className="space-y-1.5">
              {publishedItems.map((item) => (
                <WorkInboxCard key={item.packId} item={item} />
              ))}
            </ul>
          </WorkSection>
        </>
      )}
    </div>
  );
}
