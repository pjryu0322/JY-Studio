"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MyPackCard } from "@/components/MyPackCard";
import { MyPacksEmptyState } from "@/components/MyPacksEmptyState";
import { ProviderPackStatusBadge } from "@/components/ProviderPackStatusBadge";
import { useMyPacks } from "@/hooks/useMyPacks";
import { fetchAuthSession } from "@/lib/auth-api";
import { fetchProviderPacks } from "@/lib/provider-center-api";
import type { ProviderPackListItemDto } from "@/lib/provider-pack-dto";
import { providerPackDetailPath, ROUTES } from "@/lib/routes";

type OwnedStatusFilter = "all" | "DRAFT" | "REVIEWING" | "PUBLISHED" | "CHANGES_REQUESTED";

/**
 * Provider-owned packs on My Packs: workflow CTAs only (no consumer connect/download).
 * Prefer progress.actions from API when present.
 */
function providerOwnedActions(pack: ProviderPackListItemDto) {
  if (pack.progress?.actions?.length) {
    return pack.progress.actions.slice(0, 2);
  }
  const detail = providerPackDetailPath(pack.packId);
  if (pack.status === "REVIEWING") {
    return [{ label: "검수 상태 보기", href: `${detail}?tab=distributionReview` }];
  }
  if (pack.status === "DRAFT" && pack.progress?.currentStep === "CHANGES_REQUESTED") {
    return [
      { label: "보완사항 보기", href: `${detail}?tab=distributionReview` },
      { label: "수정 후 재요청", href: `${detail}?tab=payload` },
    ];
  }
  if (pack.status === "DRAFT") {
    return [
      { label: "계속 작성", href: detail },
      { label: "자료등록", href: `${detail}?tab=payload` },
    ];
  }
  if (pack.status === "PUBLISHED" || pack.status === "VERIFIED") {
    return [
      { label: "공개 정보 관리", href: `${detail}?tab=distributionReview` },
      { label: "사용 통계 보기", href: ROUTES.accountPlan },
    ];
  }
  return [{ label: "계속 작성", href: detail }];
}

function matchesOwnedStatus(pack: ProviderPackListItemDto, filter: OwnedStatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "CHANGES_REQUESTED") {
    return pack.status === "DRAFT" && pack.progress?.currentStep === "CHANGES_REQUESTED";
  }
  if (filter === "PUBLISHED") {
    return pack.status === "PUBLISHED" || pack.status === "VERIFIED";
  }
  if (filter === "DRAFT") {
    return (
      pack.status === "DRAFT" && pack.progress?.currentStep !== "CHANGES_REQUESTED"
    );
  }
  return pack.status === filter;
}

function OwnedPackRow({ pack }: { readonly pack: ProviderPackListItemDto }) {
  const detail = providerPackDetailPath(pack.packId);
  const actions = providerOwnedActions(pack);
  const meta = [
    pack.progress?.currentStepLabel,
    pack.progress?.nextActionLabel,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="rounded-xl border border-store-border bg-white px-3 py-2 shadow-sm">
      <div className="flex items-center gap-2">
        <Link href={detail} className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-base" aria-hidden>
              {pack.icon || "📦"}
            </span>
            <p className="min-w-0 truncate text-sm font-semibold text-slate-900">{pack.name}</p>
            <ProviderPackStatusBadge status={pack.status} />
          </div>
          {meta ? (
            <p className="mt-0.5 truncate pl-6 text-[11px] text-store-muted">{meta}</p>
          ) : null}
        </Link>
        <div className="flex shrink-0 flex-col items-end gap-0.5 sm:flex-row sm:items-center sm:gap-1">
          {actions.map((action) => (
            <Link
              key={`${action.label}:${action.href}`}
              href={action.href}
              className="inline-flex min-h-[28px] items-center rounded-md px-1.5 text-[11px] font-bold text-store-accent hover:bg-slate-50"
            >
              {action.label}
            </Link>
          ))}
        </div>
      </div>
    </li>
  );
}

export function MyPacksPageClient() {
  const { mounted, loading, myPacks, error } = useMyPacks();
  const [providerPacks, setProviderPacks] = useState<ProviderPackListItemDto[] | null>(null);
  const [providerLoading, setProviderLoading] = useState(true);
  const [isProvider, setIsProvider] = useState(false);
  const [nameQuery, setNameQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<OwnedStatusFilter>("all");

  const loadProviderPacks = useCallback(async () => {
    setProviderLoading(true);
    try {
      const session = await fetchAuthSession();
      const hasProvider = Boolean(session.providerProfile);
      setIsProvider(hasProvider);
      if (!hasProvider) {
        setProviderPacks([]);
        return;
      }
      const res = await fetchProviderPacks();
      setProviderPacks(res.items);
    } catch {
      setProviderPacks([]);
    } finally {
      setProviderLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProviderPacks();
  }, [loadProviderPacks]);

  const filteredOwned = useMemo(() => {
    const owned = providerPacks ?? [];
    const q = nameQuery.trim().toLowerCase();
    return owned.filter((pack) => {
      if (!matchesOwnedStatus(pack, statusFilter)) return false;
      if (!q) return true;
      return (
        pack.name.toLowerCase().includes(q) ||
        pack.packId.toLowerCase().includes(q)
      );
    });
  }, [providerPacks, nameQuery, statusFilter]);

  if (!mounted || loading || providerLoading) {
    return <div className="min-h-[200px] rounded-2xl bg-slate-50" aria-hidden />;
  }

  const owned = providerPacks ?? [];
  const hasOwned = owned.length > 0;
  const hasInstalled = myPacks.length > 0;

  // Provider workspace: owned packs only — never mix consumer saved-catalog packs.
  if (isProvider) {
    if (!hasOwned) {
      return (
        <div className="rounded-2xl border border-store-border bg-white px-6 py-8 text-center shadow-card">
          <h2 className="text-base font-bold text-slate-900">등록한 지식팩이 없습니다.</h2>
          <p className="mt-2 text-sm text-store-muted">
            제공자 센터에서 지식팩을 등록하고 검수 요청을 진행하세요.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <Link
              href={ROUTES.provider}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-store-accent px-6 text-sm font-bold text-white"
            >
              제공자 센터 열기
            </Link>
            <Link
              href={ROUTES.providerPackNew}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-store-border px-4 text-sm font-semibold text-slate-800"
            >
              지식팩 등록
            </Link>
          </div>
        </div>
      );
    }

    return (
      <section className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="search"
            value={nameQuery}
            onChange={(e) => setNameQuery(e.target.value)}
            placeholder="지식팩명 검색"
            aria-label="지식팩명 검색"
            className="min-h-[40px] flex-1 rounded-xl border border-store-border bg-white px-3 text-sm shadow-sm"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as OwnedStatusFilter)}
            aria-label="상태 필터"
            className="min-h-[40px] rounded-xl border border-store-border bg-white px-3 text-sm shadow-sm sm:w-40"
          >
            <option value="all">전체 상태</option>
            <option value="DRAFT">초안</option>
            <option value="CHANGES_REQUESTED">보완 요청</option>
            <option value="REVIEWING">검수 중</option>
            <option value="PUBLISHED">공개</option>
          </select>
        </div>

        {filteredOwned.length === 0 ? (
          <p className="rounded-xl border border-dashed border-store-border bg-slate-50 px-3 py-4 text-center text-sm text-store-muted">
            검색 조건에 맞는 지식팩이 없습니다.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {filteredOwned.map((pack) => (
              <OwnedPackRow key={pack.packId} pack={pack} />
            ))}
          </ul>
        )}
      </section>
    );
  }

  // Consumer: saved catalog packs only.
  if (!hasInstalled) {
    if (error) {
      return (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-6 text-center text-sm text-red-800">
          {error}
        </div>
      );
    }
    return <MyPacksEmptyState />;
  }

  return (
    <div className="space-y-3">
      {myPacks.map((pack) => (
        <MyPackCard key={pack.packId} pack={pack} />
      ))}
    </div>
  );
}
