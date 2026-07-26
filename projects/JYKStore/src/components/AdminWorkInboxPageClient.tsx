"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AdminReviewListItemDto } from "@/lib/admin-review-dto";
import {
  fetchAdminReviewItems,
  fetchAdminWorkerZipRequests,
  type AdminWorkerZipRequestListItem,
} from "@/lib/admin-review-api";
import {
  buildAdminWorkInboxItemViewModel,
  countAdminWorkInboxWaiting,
  filterAdminWorkInboxByQueueGroup,
  mergeAdminWorkInboxViewModels,
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
  ADMIN_WORK_SECTION_QUALITY_BODY,
  ADMIN_WORK_SECTION_QUALITY_TITLE,
  ADMIN_WORK_SUMMARY_LABEL,
} from "@/lib/role-based-ux-copy";
import { adminReviewDetailPath } from "@/lib/routes";

type WorkStatusFilter =
  | "all"
  | "accept"
  | "generate"
  | "quality"
  | "provider_review"
  | "pack_review"
  | "pack_review_in_progress";

const FILTER_TO_GROUPS: Record<WorkStatusFilter, AdminWorkInboxQueueGroup[] | null> = {
  all: null,
  accept: ["ACCEPT_REQUIRED"],
  generate: ["GENERATE_REQUIRED"],
  quality: ["QUALITY_CHECK_REQUIRED"],
  provider_review: ["PROVIDER_REVIEW_IN_PROGRESS"],
  pack_review: ["ADMIN_REVIEW_REQUIRED"],
  pack_review_in_progress: ["ADMIN_REVIEW_IN_PROGRESS"],
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

function WorkInboxCard({ item }: { readonly item: AdminWorkInboxItemViewModel }) {
  return (
    <li>
      <Link
        href={adminReviewDetailPath(item.packId)}
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
            {[item.categoryName, item.providerName, item.versionLabel]
              .filter(Boolean)
              .join(" · ")}
          </p>
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
  });
}

function reviewItemToViewModel(item: AdminReviewListItemDto): AdminWorkInboxItemViewModel {
  return buildAdminWorkInboxItemViewModel({
    packId: item.packId,
    packName: item.name,
    packStatus: item.status,
    sourceKind: "REVIEW",
    packReviewStatus: item.reviewStatus,
    categoryId: item.categoryId,
    categoryName: item.categoryName,
    providerName: item.providerName,
  });
}

/**
 * Admin first screen — work inbox ordered by what the admin must do next.
 */
export function AdminWorkInboxPageClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zipItems, setZipItems] = useState<AdminWorkerZipRequestListItem[]>([]);
  const [reviewItems, setReviewItems] = useState<AdminReviewListItemDto[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<WorkStatusFilter>("all");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [zip, reviews] = await Promise.all([
        fetchAdminWorkerZipRequests(),
        fetchAdminReviewItems(),
      ]);
      setZipItems(zip.items);
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
        ...reviewItems.map(reviewItemToViewModel),
      ]),
    [zipItems, reviewItems],
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
    const groups = FILTER_TO_GROUPS[statusFilter];
    return allViewItems.filter((item) => {
      if (categoryFilter !== "all" && item.categoryId !== categoryFilter) return false;
      if (groups && !groups.includes(item.adminQueueGroup)) return false;
      return true;
    });
  }, [allViewItems, categoryFilter, statusFilter]);

  const acceptItems = filterAdminWorkInboxByQueueGroup(filteredViewItems, "ACCEPT_REQUIRED");
  const generateItems = filterAdminWorkInboxByQueueGroup(filteredViewItems, "GENERATE_REQUIRED");
  const qualityItems = filterAdminWorkInboxByQueueGroup(
    filteredViewItems,
    "QUALITY_CHECK_REQUIRED",
  );
  const providerReviewInProgressItems = filterAdminWorkInboxByQueueGroup(
    filteredViewItems,
    "PROVIDER_REVIEW_IN_PROGRESS",
  );
  const packReviewRequiredItems = filterAdminWorkInboxByQueueGroup(
    filteredViewItems,
    "ADMIN_REVIEW_REQUIRED",
  );
  const packReviewInProgressItems = filterAdminWorkInboxByQueueGroup(
    filteredViewItems,
    "ADMIN_REVIEW_IN_PROGRESS",
  );
  const publishedItems = filterAdminWorkInboxByQueueGroup(filteredViewItems, "PUBLISHED");

  const totalWaiting = countAdminWorkInboxWaiting(filteredViewItems);
  const rawTotal = allViewItems.length;
  const visibleCount =
    acceptItems.length +
    generateItems.length +
    qualityItems.length +
    providerReviewInProgressItems.length +
    packReviewRequiredItems.length +
    packReviewInProgressItems.length +
    publishedItems.length;

  return (
    <div className="space-y-5 pb-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {!loading ? (
          <p className="px-1 text-xs font-semibold text-slate-700">
            {ADMIN_WORK_SUMMARY_LABEL} {totalWaiting}건
            {categoryFilter !== "all" || statusFilter !== "all"
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
            className="min-h-[36px] rounded-lg border border-store-border bg-white px-2.5 text-xs text-slate-800"
          >
            <option value="all">{ADMIN_WORK_FILTER_STATUS_ALL}</option>
            <option value="accept">{ADMIN_WORK_FILTER_STATUS_ACCEPT}</option>
            <option value="generate">{ADMIN_WORK_FILTER_STATUS_GENERATE}</option>
            <option value="quality">{ADMIN_WORK_FILTER_STATUS_QUALITY}</option>
            <option value="provider_review">{ADMIN_WORK_FILTER_STATUS_PROVIDER_REVIEW}</option>
            <option value="pack_review">{ADMIN_WORK_FILTER_STATUS_PACK_REVIEW}</option>
            <option value="pack_review_in_progress">
              {ADMIN_WORK_FILTER_STATUS_PACK_REVIEW_IN_PROGRESS}
            </option>
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
                <WorkInboxCard key={item.packId} item={item} />
              ))}
            </ul>
          </WorkSection>

          <WorkSection
            title={ADMIN_WORK_SECTION_QUALITY_TITLE}
            body={ADMIN_WORK_SECTION_QUALITY_BODY}
            count={qualityItems.length}
            accentClass="bg-amber-100 text-amber-900"
          >
            <ul className="space-y-1.5">
              {qualityItems.map((item) => (
                <WorkInboxCard key={item.packId} item={item} />
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
