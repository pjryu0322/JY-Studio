"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminReviewStatusBadge } from "@/components/AdminReviewStatusBadge";
import type { AdminReviewListItemDto } from "@/lib/admin-review-dto";
import { fetchAdminReviewItems } from "@/lib/admin-review-api";
import {
  ADMIN_REVIEWS_LIST_TITLE,
  ADMIN_REVIEWS_OPEN_DETAIL,
} from "@/lib/role-based-ux-copy";
import { adminReviewDetailPath } from "@/lib/routes";

function formatRequestedAt(iso: string | undefined): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("ko-KR");
  } catch {
    return iso;
  }
}

export function AdminReviewListPageClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AdminReviewListItemDto[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminReviewItems();
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "검수 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="space-y-4 pb-6">
      <div className="px-1">
        <h2 className="text-sm font-bold text-slate-900">{ADMIN_REVIEWS_LIST_TITLE}</h2>
        <p className="mt-1 text-xs text-store-muted">REVIEWING 상태 지식팩만 표시됩니다.</p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      {loading ? (
        <p className="text-sm text-store-muted">불러오는 중…</p>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-store-border bg-white p-4 text-sm text-store-muted">
          검수 대기(REVIEWING) 지식팩이 없습니다.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.packId}>
              <div className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">{item.name}</p>
                  <AdminReviewStatusBadge status={item.status} />
                </div>
                <p className="mt-1 text-xs text-slate-700">제공자: {item.providerName}</p>
                <p className="mt-1 font-mono text-xs text-store-muted">지식팩 ID: {item.packId}</p>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-store-muted">
                  <div>원천 문서: {item.sourceDocumentCount}개</div>
                  <div>버전: {item.versionCount}</div>
                  <div className="col-span-2">
                    요청일시: {formatRequestedAt(item.updatedAt)}
                  </div>
                </dl>
                <Link
                  href={adminReviewDetailPath(item.packId)}
                  className="mt-3 flex min-h-[44px] items-center justify-center rounded-xl bg-store-accent text-sm font-bold text-white"
                >
                  {ADMIN_REVIEWS_OPEN_DETAIL}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
