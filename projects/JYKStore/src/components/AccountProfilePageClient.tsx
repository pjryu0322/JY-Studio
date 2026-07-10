"use client";

import { useCallback, useEffect, useState } from "react";
import { ProviderProfileForm } from "@/components/ProviderProfileForm";
import { StoreLoginForm } from "@/components/StoreLoginForm";
import { fetchAuthSession, logoutStoreAccount } from "@/lib/auth-api";
import type { ProviderProfileDto } from "@/lib/provider-profile-dto";
import { upsertProviderProfileApi } from "@/lib/provider-center-api";
import { ROUTES } from "@/lib/routes";

export function AccountProfilePageClient() {
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [providerProfile, setProviderProfile] = useState<ProviderProfileDto | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const session = await fetchAuthSession();
      if (!session.loggedIn || !session.user) {
        setLoggedIn(false);
        setUserEmail(null);
        setUserName(null);
        setProviderProfile(null);
        return;
      }
      setLoggedIn(true);
      setUserEmail(session.user.email);
      setUserName(session.user.name);
      setProviderProfile(session.providerProfile ?? null);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "세션을 불러오지 못했습니다.");
      setLoggedIn(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onLogout = async () => {
    setAuthBusy(true);
    try {
      await logoutStoreAccount();
      await refresh();
    } finally {
      setAuthBusy(false);
    }
  };

  const onSaveProviderProfile = async (input: {
    displayName: string;
    description: string;
    websiteUrl?: string;
    contactEmail?: string;
  }) => {
    setSavingProfile(true);
    setAuthError(null);
    try {
      const data = await upsertProviderProfileApi(input);
      setProviderProfile(data.profile);
      await refresh();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "프로필을 저장하지 못했습니다.");
    } finally {
      setSavingProfile(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-store-muted">불러오는 중…</p>;
  }

  if (!loggedIn) {
    return (
      <div className="space-y-4 pb-8">
        <StoreLoginForm redirectTo={ROUTES.accountProfile} />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      {authError ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">{authError}</div>
      ) : null}

      <section className="rounded-2xl border border-store-border bg-white p-5 shadow-card">
        <h2 className="text-sm font-bold text-slate-900">내 계정</h2>
        <p className="mt-2 text-sm text-slate-800">{userName}</p>
        <p className="text-xs text-store-muted">{userEmail}</p>
        <p className="mt-2 text-xs font-semibold text-emerald-800">로그인됨</p>
        <button
          type="button"
          onClick={() => void onLogout()}
          disabled={authBusy}
          className="mt-4 min-h-[44px] w-full rounded-xl border border-store-border text-sm font-semibold text-slate-800"
        >
          로그아웃
        </button>
      </section>

      <section id="provider-profile" className="scroll-mt-24">
        <h2 className="mb-2 px-1 text-sm font-bold text-slate-900">제공자 프로필</h2>
        {providerProfile ? (
          <p className="mb-2 px-1 text-xs text-store-muted">등록됨 · 수정할 수 있습니다.</p>
        ) : (
          <p className="mb-2 px-1 text-xs text-amber-800">아직 등록하지 않았습니다.</p>
        )}
        <ProviderProfileForm
          initial={providerProfile}
          saving={savingProfile}
          onSave={onSaveProviderProfile}
        />
      </section>
    </div>
  );
}
