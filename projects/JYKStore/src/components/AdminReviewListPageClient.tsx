"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminReviewStatusBadge } from "@/components/AdminReviewStatusBadge";
import type { AdminReviewListItemDto } from "@/lib/admin-review-dto";
import { fetchAdminReviewItems } from "@/lib/admin-review-api";
import { adminReviewDetailPath } from "@/lib/routes";

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
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
        현재 Admin Console은 MVP 검증용 내부 도구입니다. 실제 운영 환경에서는 관리자 인증과 권한 제어가 필요합니다.
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
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.packId}>
              <Link
                href={adminReviewDetailPath(item.packId)}
                className="block rounded-2xl border border-store-border bg-white p-4 shadow-card active:bg-slate-50"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">{item.name}</p>
                  <AdminReviewStatusBadge status={item.status} />
                </div>
                <p className="mt-1 font-mono text-xs text-store-muted">{item.packId}</p>
                <p className="mt-2 line-clamp-2 text-sm text-slate-700">{item.shortDescription}</p>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-store-muted">
                  <div>제공자: {item.providerName}</div>
                  <div>카테고리: {item.categoryId}</div>
                  <div>버전: {item.versionCount}</div>
                  <div>문서: {item.sourceDocumentCount}</div>
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
