"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ProviderPackStatusBadge } from "@/components/ProviderPackStatusBadge";
import { ProviderProfileForm } from "@/components/ProviderProfileForm";
import type { ProviderPackListItemDto } from "@/lib/provider-pack-dto";
import type { ProviderProfileDto } from "@/lib/provider-profile-dto";
import {
  fetchProviderPacks,
  fetchProviderProfile,
  upsertProviderProfileApi,
} from "@/lib/provider-center-api";
import { providerPackDetailPath, ROUTES } from "@/lib/routes";

function packDetailActions(pack: ProviderPackListItemDto) {
  const detail = providerPackDetailPath(pack.packId);
  const actions: { label: string; href: string }[] = [{ label: "편집", href: detail }];
  if (pack.status === "DRAFT") {
    actions.push({ label: "GitHub 자동수집", href: `${detail}#github-auto-collect` });
    actions.push({ label: "검수 요청", href: `${detail}#pack-review` });
  }
  return actions;
}

export function ProviderCenterPageClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProviderProfileDto | null>(null);
  const [packs, setPacks] = useState<ProviderPackListItemDto[]>([]);
  const [savingProfile, setSavingProfile] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profileRes, packsRes] = await Promise.all([fetchProviderProfile(), fetchProviderPacks()]);
      setProfile(profileRes.profile);
      setPacks(packsRes.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Provider Center를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onSaveProfile = async (input: {
    displayName: string;
    description: string;
    websiteUrl?: string;
    contactEmail?: string;
  }) => {
    setSavingProfile(true);
    setError(null);
    try {
      const data = await upsertProviderProfileApi(input);
      setProfile(data.profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "프로필을 저장하지 못했습니다.");
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="space-y-4 pb-6">
      {error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      {profile ? (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4">
          <p className="text-xs font-bold text-emerald-900">제공자 등록 완료</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{profile.displayName}</p>
          <p className="mt-1 line-clamp-2 text-xs text-store-muted">{profile.description}</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Link
              href={ROUTES.providerPackNew}
              className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-store-accent text-sm font-bold text-white"
            >
              새 지식팩 만들기
            </Link>
            <a
              href="#provider-packs"
              className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-store-border bg-white text-sm font-semibold text-slate-800"
            >
              내 지식팩 보기
            </a>
          </div>
        </div>
      ) : (
        <p className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-950">
          제공자 프로필을 등록하면 지식팩 초안을 만들 수 있습니다.
        </p>
      )}

      <div id="provider-profile">
        <ProviderProfileForm initial={profile} saving={savingProfile} onSave={onSaveProfile} />
      </div>

      <section id="provider-packs" className="scroll-mt-24 rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-900">내 지식팩</h2>
        </div>
        <p className="mt-1 text-[11px] text-store-muted">
          DRAFT · 초안 작성 중 · REVIEWING · 검토 요청됨 · PUBLISHED · 공개됨 · VERIFIED · 검증됨
        </p>
        {!profile ? (
          <p className="mt-3 text-sm text-store-muted">프로필을 등록하면 지식팩 초안을 만들 수 있습니다.</p>
        ) : loading ? (
          <p className="mt-3 text-sm text-store-muted">목록 불러오는 중…</p>
        ) : packs.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-store-border bg-slate-50 px-4 py-5 text-center">
            <p className="text-sm font-semibold text-slate-900">아직 등록한 지식팩이 없습니다.</p>
            <p className="mt-1 text-xs text-store-muted">
              새 지식팩을 만들고 GitHub 문서 자동수집으로 초안을 생성하세요.
            </p>
            <Link
              href={ROUTES.providerPackNew}
              className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-store-accent px-5 text-sm font-bold text-white"
            >
              새 지식팩 만들기
            </Link>
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {packs.map((pack) => (
              <li key={pack.packId} className="rounded-xl border border-store-border">
                <Link
                  href={providerPackDetailPath(pack.packId)}
                  className="flex min-h-[44px] items-center gap-3 px-3 py-2 active:bg-slate-50"
                >
                  <span className="text-xl">{pack.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{pack.name}</p>
                    <p className="truncate text-xs text-store-muted">{pack.shortDescription}</p>
                  </div>
                  <ProviderPackStatusBadge status={pack.status} />
                </Link>
                <div className="flex flex-wrap gap-2 border-t border-store-border px-3 py-2">
                  {packDetailActions(pack).map((action) => (
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
        )}
      </section>
    </div>
  );
}
