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

      <ProviderProfileForm initial={profile} saving={savingProfile} onSave={onSaveProfile} />

      <section className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-900">내 지식팩</h2>
          {profile ? (
            <Link
              href={ROUTES.providerPackNew}
              className="min-h-[36px] rounded-full bg-store-accent px-3 text-xs font-bold text-white leading-9"
            >
              + 새 지식팩
            </Link>
          ) : null}
        </div>
        {!profile ? (
          <p className="mt-2 text-sm text-store-muted">프로필을 등록하면 지식팩 초안을 만들 수 있습니다.</p>
        ) : loading ? (
          <p className="mt-2 text-sm text-store-muted">목록 불러오는 중…</p>
        ) : packs.length === 0 ? (
          <p className="mt-2 text-sm text-store-muted">아직 등록한 지식팩이 없습니다.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {packs.map((pack) => (
              <li key={pack.packId}>
                <Link
                  href={providerPackDetailPath(pack.packId)}
                  className="flex min-h-[44px] items-center gap-3 rounded-xl border border-store-border px-3 py-2 active:bg-slate-50"
                >
                  <span className="text-xl">{pack.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{pack.name}</p>
                    <p className="truncate text-xs text-store-muted">{pack.shortDescription}</p>
                  </div>
                  <ProviderPackStatusBadge status={pack.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
