"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  fetchAdminWorkerZipRequests,
  type AdminWorkerZipRequestListItem,
} from "@/lib/admin-review-api";
import { adminReviewDetailPath } from "@/lib/routes";

/**
 * Admin 접수함 — DRAFT packs with an open or completed ZIP generation request.
 *
 * Provider requests keep the pack DRAFT, so they never appear in the REVIEWING
 * review list. This queue surfaces them so an Admin can 접수 / 생성 실행 / 품질
 * 점검 continue from the detail screen — including after generation completes
 * (marker retired to PASS) while the pack is still DRAFT.
 */
export function AdminWorkerZipRequestQueue() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AdminWorkerZipRequestListItem[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminWorkerZipRequests();
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "생성 요청 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <section className="space-y-3">
      <div className="px-1">
        <h2 className="text-sm font-bold text-slate-900">지식데이터 생성 요청</h2>
        <p className="mt-1 text-xs text-store-muted">
          제공자가 ZIP 자료로 생성을 요청한 DRAFT 지식팩입니다. 접수·생성·품질 점검까지 이
          목록에서 이어서 열 수 있습니다.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-store-muted">불러오는 중…</p>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-store-border bg-white p-4 text-sm text-store-muted">
          표시할 생성 요청이 없습니다.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.packId}>
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">{item.packName}</p>
                  <PhaseBadge phase={item.phase} />
                </div>
                {item.providerName ? (
                  <p className="mt-1 text-xs text-slate-700">제공자: {item.providerName}</p>
                ) : null}
                <p className="mt-1 font-mono text-xs text-store-muted">지식팩 ID: {item.packId}</p>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-store-muted">
                  <div>버전: {item.versionLabel ?? "-"}</div>
                  <div>첨부: {item.originalFileName ?? "-"}</div>
                  <div className="col-span-2">
                    요청일시: {formatDateTime(item.requestedAt)}
                  </div>
                </dl>
                <Link
                  href={adminReviewDetailPath(item.packId)}
                  className="mt-3 flex min-h-[44px] items-center justify-center rounded-xl bg-store-accent text-sm font-bold text-white"
                >
                  {ctaLabel(item.phase)}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PhaseBadge({ phase }: { readonly phase: AdminWorkerZipRequestListItem["phase"] }) {
  if (phase === "COMPLETED") {
    return (
      <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-900">
        생성 완료
      </span>
    );
  }
  if (phase === "ACCEPTED") {
    return (
      <span className="inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-900">
        접수완료
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-900">
      접수 대기
    </span>
  );
}

function ctaLabel(phase: AdminWorkerZipRequestListItem["phase"]): string {
  switch (phase) {
    case "COMPLETED":
      return "품질 점검·계속하기";
    case "ACCEPTED":
      return "생성 실행하기";
    default:
      return "접수하고 생성 실행";
  }
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
}
