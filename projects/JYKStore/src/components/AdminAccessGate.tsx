"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { isAdminAccountRole } from "@/lib/account-role";
import { fetchAuthSession } from "@/lib/auth-api";
import {
  ADMIN_ACCESS_REQUIRED_BODY,
  ADMIN_ACCESS_REQUIRED_TITLE,
} from "@/lib/role-based-ux-copy";
import { ROUTES } from "@/lib/routes";

export function AdminAccessGate({ children }: { readonly children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPath = pathname === ROUTES.adminLogin;
  const [state, setState] = useState<"checking" | "allowed" | "blocked">(
    isLoginPath ? "allowed" : "checking",
  );

  const recheck = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (pathname === ROUTES.adminLogin) {
      setState("allowed");
      return;
    }

    try {
      const session = await fetchAuthSession();
      if (session.loggedIn && isAdminAccountRole(session.accountRole ?? session.user?.accountRole)) {
        setState("allowed");
        return;
      }
    } catch {
      // blocked below
    }

    setState("blocked");
  }, [pathname]);

  useEffect(() => {
    void recheck();
  }, [recheck]);

  if (isLoginPath) {
    return <>{children}</>;
  }

  if (state === "checking") {
    return <p className="text-sm text-store-muted">관리자 권한 확인 중…</p>;
  }

  if (state === "blocked") {
    return (
      <div className="space-y-4 pb-8">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-card">
          <h1 className="text-lg font-bold text-slate-900">{ADMIN_ACCESS_REQUIRED_TITLE}</h1>
          <p className="mt-2 text-sm text-slate-700">{ADMIN_ACCESS_REQUIRED_BODY}</p>
          <Link
            href={ROUTES.adminLogin}
            className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-store-accent text-sm font-bold text-white"
          >
            관리자 로그인
          </Link>
          <Link
            href={ROUTES.home}
            className="mt-2 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-store-border bg-white text-sm font-bold text-slate-800"
          >
            스토어 홈으로 이동
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
