"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MyPackCard } from "@/components/MyPackCard";
import { MyPacksEmptyState } from "@/components/MyPacksEmptyState";
import { ProviderPackStatusBadge } from "@/components/ProviderPackStatusBadge";
import { useMyPacks } from "@/hooks/useMyPacks";
import { fetchAuthSession } from "@/lib/auth-api";
import { fetchProviderPacks } from "@/lib/provider-center-api";
import type { ProviderPackListItemDto } from "@/lib/provider-pack-dto";
import { providerPackDetailPath, ROUTES } from "@/lib/routes";

function providerPackActions(pack: ProviderPackListItemDto) {
  const detail = providerPackDetailPath(pack.packId);
  if (pack.status === "REVIEWING") {
    return [{ label: "검수 상태 보기", href: `${detail}?tab=review` }];
  }
  if (pack.status === "DRAFT") {
    return [
      { label: "편집", href: detail },
      { label: "검수 요청", href: `${detail}?tab=review` },
    ];
  }
  return [{ label: "상세 보기", href: detail }];
}

export function MyPacksPageClient() {
  const { mounted, loading, myPacks, error } = useMyPacks();
  const [providerPacks, setProviderPacks] = useState<ProviderPackListItemDto[] | null>(null);
  const [providerLoading, setProviderLoading] = useState(true);
  const [isProvider, setIsProvider] = useState(false);

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

  if (!mounted || loading || providerLoading) {
    return <div className="min-h-[200px] rounded-2xl bg-slate-50" aria-hidden />;
  }

  const owned = providerPacks ?? [];
  const hasOwned = owned.length > 0;
  const hasInstalled = myPacks.length > 0;

  if (!hasOwned && !hasInstalled) {
    if (error) {
      return (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-6 text-center text-sm text-red-800">
          {error}
        </div>
      );
    }
    return (
      <div className="space-y-4">
        {isProvider ? (
          <div className="rounded-2xl border border-store-border bg-white px-6 py-8 text-center shadow-card">
            <h2 className="text-base font-bold text-slate-900">등록한 지식팩이 없습니다.</h2>
            <p className="mt-2 text-sm text-store-muted">
              제공자 센터에서 지식팩을 만들고 검수 요청할 수 있습니다.
            </p>
            <Link
              href={ROUTES.provider}
              className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-store-accent px-6 text-sm font-bold text-white"
            >
              제공자 센터 열기
            </Link>
          </div>
        ) : (
          <MyPacksEmptyState />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isProvider ? (
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-2 px-1">
            <div>
              <h2 className="text-sm font-bold text-slate-900">내가 등록한 지식팩</h2>
              <p className="mt-0.5 text-xs text-store-muted">
                초안·검수 요청·공개 상태를 확인할 수 있습니다.
              </p>
            </div>
            <Link
              href={ROUTES.provider}
              className="shrink-0 text-xs font-semibold text-store-accent underline-offset-2 hover:underline"
            >
              제공자 센터
            </Link>
          </div>
          {hasOwned ? (
            <ul className="space-y-2">
              {owned.map((pack) => (
                <li key={pack.packId} className="rounded-2xl border border-store-border bg-white shadow-card">
                  <Link
                    href={providerPackDetailPath(pack.packId)}
                    className="flex min-h-[52px] items-center gap-3 px-4 py-3 active:bg-slate-50"
                  >
                    <span className="text-xl">{pack.icon || "📦"}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{pack.name}</p>
                      <p className="truncate font-mono text-[11px] text-store-muted">{pack.packId}</p>
                    </div>
                    <ProviderPackStatusBadge status={pack.status} />
                  </Link>
                  <div className="flex flex-wrap gap-3 border-t border-store-border px-4 py-2">
                    {providerPackActions(pack).map((action) => (
                      <Link
                        key={action.label}
                        href={action.href}
                        className="text-xs font-semibold text-store-accent underline-offset-2 hover:underline"
                      >
                        {action.label}
                      </Link>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-2xl border border-dashed border-store-border bg-slate-50 px-4 py-5 text-center">
              <p className="text-sm text-store-muted">아직 등록한 지식팩이 없습니다.</p>
              <Link
                href={ROUTES.providerPackNew}
                className="mt-2 inline-block text-sm font-semibold text-store-accent underline-offset-2 hover:underline"
              >
                새 지식팩 만들기
              </Link>
            </div>
          )}
        </section>
      ) : null}

      <section className="space-y-3">
        {isProvider ? (
          <div className="px-1">
            <h2 className="text-sm font-bold text-slate-900">보관한 지식팩</h2>
            <p className="mt-0.5 text-xs text-store-muted">
              카탈로그에서 추가한 지식팩과 연동 정보입니다.
            </p>
          </div>
        ) : null}
        {error && !hasInstalled ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-6 text-center text-sm text-red-800">
            {error}
          </div>
        ) : null}
        {hasInstalled ? (
          <div className="space-y-3">
            {myPacks.map((pack) => (
              <MyPackCard key={pack.packId} pack={pack} />
            ))}
          </div>
        ) : isProvider ? (
          <div className="rounded-2xl border border-dashed border-store-border bg-slate-50 px-4 py-5 text-center text-sm text-store-muted">
            보관한 지식팩이 없습니다.
          </div>
        ) : (
          <MyPacksEmptyState />
        )}
      </section>
    </div>
  );
}
