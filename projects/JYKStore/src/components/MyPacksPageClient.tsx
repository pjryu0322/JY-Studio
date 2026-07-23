"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MyPackCard } from "@/components/MyPackCard";
import { MyPacksEmptyState } from "@/components/MyPacksEmptyState";
import { useMyPacks } from "@/hooks/useMyPacks";
import { isProviderAccountRole, parseAccountRole } from "@/lib/account-role";
import { fetchAuthSession } from "@/lib/auth-api";
import {
  MY_PACKS_PROVIDER_REDIRECT_BODY,
  MY_PACKS_PROVIDER_REDIRECT_TITLE,
} from "@/lib/role-based-ux-copy";
import { ROUTES } from "@/lib/routes";

/**
 * Consumer-only "내 지식팩" (saved/installed packs).
 * Provider accounts are redirected to the provider center — one account = one role.
 */
export function MyPacksPageClient() {
  const { mounted, loading, myPacks, error } = useMyPacks();
  const [roleCheckLoading, setRoleCheckLoading] = useState(true);
  const [isProviderAccount, setIsProviderAccount] = useState(false);

  const checkRole = useCallback(async () => {
    setRoleCheckLoading(true);
    try {
      const session = await fetchAuthSession();
      if (!session.loggedIn) {
        setIsProviderAccount(false);
        return;
      }
      const role = parseAccountRole(session.accountRole ?? session.user?.accountRole);
      setIsProviderAccount(isProviderAccountRole(role));
    } catch {
      setIsProviderAccount(false);
    } finally {
      setRoleCheckLoading(false);
    }
  }, []);

  useEffect(() => {
    void checkRole();
  }, [checkRole]);

  if (!mounted || loading || roleCheckLoading) {
    return <div className="min-h-[200px] rounded-2xl bg-slate-50" aria-hidden />;
  }

  if (isProviderAccount) {
    return (
      <div className="rounded-2xl border border-store-border bg-white px-6 py-8 text-center shadow-card">
        <h2 className="text-base font-bold text-slate-900">{MY_PACKS_PROVIDER_REDIRECT_TITLE}</h2>
        <p className="mt-2 text-sm text-store-muted">{MY_PACKS_PROVIDER_REDIRECT_BODY}</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Link
            href={ROUTES.provider}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-store-accent px-6 text-sm font-bold text-white"
          >
            제공자 센터 열기
          </Link>
          <Link
            href={ROUTES.login}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-store-border px-4 text-sm font-semibold text-slate-800"
          >
            사용자 계정으로 로그인
          </Link>
        </div>
      </div>
    );
  }

  if (myPacks.length === 0) {
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
