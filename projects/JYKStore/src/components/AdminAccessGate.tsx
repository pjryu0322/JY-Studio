"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  isAdminAccountRole,
  parseAccountRole,
  type AccountRole,
} from "@/lib/account-role";
import { accountRoleDisplayLabel } from "@/lib/account-menu";
import { fetchAuthSession } from "@/lib/auth-api";
import { useStoreLogout } from "@/hooks/useStoreLogout";
import {
  ADMIN_ACCESS_REQUIRED_TITLE,
} from "@/lib/role-based-ux-copy";
import { ROUTES } from "@/lib/routes";

type AdminGateState =
  | { status: "checking" }
  | { status: "allowed" }
  | { status: "not_logged_in" }
  | {
      status: "non_admin";
      user: {
        name: string | null;
        email: string | null;
        accountRole: AccountRole;
      };
    }
  | { status: "error"; message: string };

export function AdminAccessGate({ children }: { readonly children: React.ReactNode }) {
  const { logoutAndRedirect, busy, error: logoutError, clearError } = useStoreLogout();
  const [state, setState] = useState<AdminGateState>({ status: "checking" });
  const [action, setAction] = useState<"switch" | "logout" | null>(null);

  const recheck = useCallback(async () => {
    if (typeof window === "undefined") return;

    try {
      const session = await fetchAuthSession();
      if (!session.loggedIn || !session.user) {
        setState({ status: "not_logged_in" });
        return;
      }
      const role = parseAccountRole(session.accountRole ?? session.user.accountRole);
      if (isAdminAccountRole(role)) {
        setState({ status: "allowed" });
        return;
      }
      setState({
        status: "non_admin",
        user: {
          name: session.user.name,
          email: session.user.email,
          accountRole: role,
        },
      });
    } catch {
      setState({
        status: "error",
        message: "관리자 권한을 확인하지 못했습니다. 다시 시도해 주세요.",
      });
    }
  }, []);

  useEffect(() => {
    void recheck();
  }, [recheck]);

  if (state.status === "checking") {
    return <p className="text-sm text-store-muted">관리자 권한 확인 중…</p>;
  }

  if (state.status === "allowed") {
    return <>{children}</>;
  }

  if (state.status === "error") {
    return (
      <div className="space-y-4 pb-8">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-card">
          <h1 className="text-lg font-bold text-slate-900">{ADMIN_ACCESS_REQUIRED_TITLE}</h1>
          <p className="mt-2 text-sm text-slate-700">{state.message}</p>
          <button
            type="button"
            onClick={() => void recheck()}
            className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-store-accent text-sm font-bold text-white"
          >
            다시 확인
          </button>
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

  if (state.status === "not_logged_in") {
    return (
      <div className="space-y-4 pb-8">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-card">
          <h1 className="text-lg font-bold text-slate-900">관리자 로그인이 필요합니다.</h1>
          <p className="mt-2 text-sm text-slate-700">
            관리자 계정으로 로그인해 주세요. 로그인 후 역할에 따라 관리자 콘솔을 이용할 수 있습니다.
          </p>
          <Link
            href={ROUTES.login}
            className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-store-accent text-sm font-bold text-white"
          >
            로그인
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

  const busyLabel =
    action === "switch" ? "계정 전환 중…" : action === "logout" ? "로그아웃 중…" : null;

  const onSwitchToAdmin = async () => {
    clearError();
    setAction("switch");
    try {
      const result = await logoutAndRedirect("login");
      if (!result.ok) return;
    } finally {
      setAction(null);
    }
  };

  const onLogoutCurrent = async () => {
    clearError();
    setAction("logout");
    try {
      const result = await logoutAndRedirect("login");
      if (!result.ok) return;
    } finally {
      setAction(null);
    }
  };

  return (
    <div className="space-y-4 pb-8">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-card">
        <h1 className="text-lg font-bold text-slate-900">{ADMIN_ACCESS_REQUIRED_TITLE}</h1>
        <div className="mt-3 rounded-xl border border-amber-100 bg-white/70 px-3 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-900">
            현재 로그인 계정
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {state.user.email || state.user.name || "알 수 없는 계정"}
          </p>
          <p className="mt-0.5 text-xs text-slate-700">
            {accountRoleDisplayLabel(state.user.accountRole)}
          </p>
        </div>
        <p className="mt-3 text-sm text-slate-700">
          관리자 기능을 사용하려면 현재 계정에서 로그아웃한 뒤 관리자 계정으로 다시
          로그인해야 합니다.
        </p>

        {logoutError ? (
          <p className="mt-3 text-sm text-red-700" role="alert">
            계정 전환에 실패했습니다. 다시 시도해 주세요.
          </p>
        ) : null}
        {busyLabel ? (
          <p className="mt-2 text-sm font-semibold text-slate-700">{busyLabel}</p>
        ) : null}

        <button
          type="button"
          disabled={busy}
          onClick={() => void onSwitchToAdmin()}
          className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-store-accent text-sm font-bold text-white disabled:opacity-50"
        >
          관리자 계정으로 다시 로그인
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onLogoutCurrent()}
          className="mt-2 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-store-border bg-white text-sm font-bold text-slate-800 disabled:opacity-50"
        >
          현재 계정 로그아웃
        </button>
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
