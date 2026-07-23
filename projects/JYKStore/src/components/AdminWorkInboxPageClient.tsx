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
  ADMIN_REVIEWS_OPEN_DETAIL,
  ADMIN_REVIEWS_STATUS_IN_REVIEW,
  ADMIN_REVIEWS_STATUS_PENDING,
  ADMIN_WORK_EMPTY,
  ADMIN_WORK_FILTER_CATEGORY_ALL,
  ADMIN_WORK_FILTER_NO_MATCH,
  ADMIN_WORK_FILTER_STATUS_ACCEPT,
  ADMIN_WORK_FILTER_STATUS_ALL,
  ADMIN_WORK_FILTER_STATUS_GENERATE,
  ADMIN_WORK_FILTER_STATUS_PACK_REVIEW,
  ADMIN_WORK_FILTER_STATUS_PROVIDER_REVIEW,
  ADMIN_WORK_SECTION_ACCEPT_BODY,
  ADMIN_WORK_SECTION_ACCEPT_CTA,
  ADMIN_WORK_SECTION_ACCEPT_TITLE,
  ADMIN_WORK_SECTION_GENERATE_BODY,
  ADMIN_WORK_SECTION_GENERATE_CTA,
  ADMIN_WORK_SECTION_GENERATE_TITLE,
  ADMIN_WORK_SECTION_PACK_REVIEW_BODY,
  ADMIN_WORK_SECTION_PACK_REVIEW_TITLE,
  ADMIN_WORK_SECTION_PROVIDER_REVIEW_BODY,
  ADMIN_WORK_SECTION_PROVIDER_REVIEW_CTA,
  ADMIN_WORK_SECTION_PROVIDER_REVIEW_TITLE,
  ADMIN_WORK_SUMMARY_LABEL,
} from "@/lib/role-based-ux-copy";
import { adminReviewDetailPath } from "@/lib/routes";

type WorkStatusFilter =
  | "all"
  | "accept"
  | "generate"
  | "provider_review"
  | "pack_review";

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

function PhaseBadge({ phase }: { readonly phase: AdminWorkerZipRequestListItem["phase"] }) {
  if (phase === "COMPLETED") {
    return (
      <span className="inline-flex shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-900">
        생성 완료
      </span>
    );
  }
  if (phase === "ACCEPTED") {
    return (
      <span className="inline-flex shrink-0 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-900">
        접수완료
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-900">
      접수 대기
    </span>
  );
}

function ZipWorkCard({
  item,
  ctaLabel,
}: {
  readonly item: AdminWorkerZipRequestListItem;
  readonly ctaLabel: string;
}) {
  return (
    <li>
      <Link
        href={adminReviewDetailPath(item.packId)}
        className="flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/40 px-3 py-2.5 transition hover:bg-indigo-50"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-slate-900">{item.packName}</p>
            <PhaseBadge phase={item.phase} />
          </div>
          <p className="mt-0.5 truncate text-[11px] text-store-muted">
            {[item.categoryName, item.providerName, item.versionLabel]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <span className="shrink-0 rounded-lg bg-store-accent px-2.5 py-1.5 text-[11px] font-bold text-white">
          {ctaLabel}
        </span>
      </Link>
    </li>
  );
}

function ReviewWorkCard({ item }: { readonly item: AdminReviewListItemDto }) {
  const reviewLabel =
    item.reviewStatus === "IN_REVIEW"
      ? ADMIN_REVIEWS_STATUS_IN_REVIEW
      : item.reviewStatus === "PENDING"
        ? ADMIN_REVIEWS_STATUS_PENDING
        : null;

  return (
    <li>
      <Link
        href={adminReviewDetailPath(item.packId)}
        className="flex items-center gap-2 rounded-xl border border-store-border bg-white px-3 py-2.5 transition hover:bg-slate-50"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
            {reviewLabel ? (
              <span className="inline-flex shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                {reviewLabel}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-[11px] text-store-muted">
            {[item.categoryName, item.providerName].filter(Boolean).join(" · ")}
          </p>
        </div>
        <span className="shrink-0 rounded-lg bg-store-accent px-2.5 py-1.5 text-[11px] font-bold text-white">
          {ADMIN_REVIEWS_OPEN_DETAIL}
        </span>
      </Link>
    </li>
  );
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

  const categoryOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of zipItems) {
      if (item.categoryId) {
        map.set(item.categoryId, item.categoryName?.trim() || item.categoryId);
      }
    }
    for (const item of reviewItems) {
      if (item.categoryId) {
        map.set(item.categoryId, item.categoryName?.trim() || item.categoryId);
      }
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [zipItems, reviewItems]);

  const matchesCategory = useCallback(
    (categoryId: string | null | undefined) => {
      if (categoryFilter === "all") return true;
      return categoryId === categoryFilter;
    },
    [categoryFilter],
  );

  const acceptItems = useMemo(
    () =>
      zipItems.filter(
        (item) =>
          item.phase === "REQUESTED" &&
          matchesCategory(item.categoryId) &&
          (statusFilter === "all" || statusFilter === "accept"),
      ),
    [zipItems, matchesCategory, statusFilter],
  );
  const generateItems = useMemo(
    () =>
      zipItems.filter(
        (item) =>
          item.phase === "ACCEPTED" &&
          matchesCategory(item.categoryId) &&
          (statusFilter === "all" || statusFilter === "generate"),
      ),
    [zipItems, matchesCategory, statusFilter],
  );
  const providerReviewItems = useMemo(
    () =>
      zipItems.filter(
        (item) =>
          item.phase === "COMPLETED" &&
          matchesCategory(item.categoryId) &&
          (statusFilter === "all" || statusFilter === "provider_review"),
      ),
    [zipItems, matchesCategory, statusFilter],
  );
  const filteredReviewItems = useMemo(
    () =>
      reviewItems.filter(
        (item) =>
          matchesCategory(item.categoryId) &&
          (statusFilter === "all" || statusFilter === "pack_review"),
      ),
    [reviewItems, matchesCategory, statusFilter],
  );

  const totalWaiting =
    acceptItems.length +
    generateItems.length +
    providerReviewItems.length +
    filteredReviewItems.length;

  const rawTotal = zipItems.length + reviewItems.length;

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
            <option value="provider_review">{ADMIN_WORK_FILTER_STATUS_PROVIDER_REVIEW}</option>
            <option value="pack_review">{ADMIN_WORK_FILTER_STATUS_PACK_REVIEW}</option>
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
      ) : totalWaiting === 0 ? (
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
                <ZipWorkCard
                  key={item.packId}
                  item={item}
                  ctaLabel={ADMIN_WORK_SECTION_ACCEPT_CTA}
                />
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
                <ZipWorkCard
                  key={item.packId}
                  item={item}
                  ctaLabel={ADMIN_WORK_SECTION_GENERATE_CTA}
                />
              ))}
            </ul>
          </WorkSection>

          <WorkSection
            title={ADMIN_WORK_SECTION_PROVIDER_REVIEW_TITLE}
            body={ADMIN_WORK_SECTION_PROVIDER_REVIEW_BODY}
            count={providerReviewItems.length}
            accentClass="bg-emerald-100 text-emerald-900"
          >
            <ul className="space-y-1.5">
              {providerReviewItems.map((item) => (
                <ZipWorkCard
                  key={item.packId}
                  item={item}
                  ctaLabel={ADMIN_WORK_SECTION_PROVIDER_REVIEW_CTA}
                />
              ))}
            </ul>
          </WorkSection>

          <WorkSection
            title={ADMIN_WORK_SECTION_PACK_REVIEW_TITLE}
            body={ADMIN_WORK_SECTION_PACK_REVIEW_BODY}
            count={filteredReviewItems.length}
            accentClass="bg-amber-100 text-amber-900"
          >
            <ul className="space-y-1.5">
              {filteredReviewItems.map((item) => (
                <ReviewWorkCard key={item.packId} item={item} />
              ))}
            </ul>
          </WorkSection>
        </>
      )}
    </div>
  );
}
