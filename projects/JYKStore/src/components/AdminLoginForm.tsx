"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  isAdminAccountRole,
  parseAccountRole,
  postAuthLandingPath,
  type AccountRole,
} from "@/lib/account-role";
import { accountRoleDisplayLabel } from "@/lib/account-menu";
import { fetchAuthSession, loginStoreAccount, logoutStoreAccount } from "@/lib/auth-api";
import { useStoreLogout } from "@/hooks/useStoreLogout";
import { performStoreLogout } from "@/lib/store-logout";
import {
  ADMIN_LOGIN_DESCRIPTION,
  ADMIN_LOGIN_TITLE,
} from "@/lib/role-based-ux-copy";
import { ROUTES } from "@/lib/routes";

type PageState =
  | { status: "checking" }
  | { status: "form" }
  | {
      status: "non_admin_session";
      user: { name: string | null; email: string | null; accountRole: AccountRole };
    };

export function AdminLoginForm() {
  const router = useRouter();
  const { logoutAndRedirect, busy: switchBusy, error: switchError, clearError } =
    useStoreLogout();
  const [pageState, setPageState] = useState<PageState>({ status: "checking" });
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const inspectSession = useCallback(async () => {
    try {
      const session = await fetchAuthSession();
      if (!session.loggedIn || !session.user) {
        setPageState({ status: "form" });
        return;
      }
      const role = parseAccountRole(session.accountRole ?? session.user.accountRole);
      if (isAdminAccountRole(role)) {
        router.replace(postAuthLandingPath("ADMIN"));
        router.refresh();
        return;
      }
      setPageState({
        status: "non_admin_session",
        user: {
          name: session.user.name,
          email: session.user.email,
          accountRole: role,
        },
      });
    } catch {
      setPageState({ status: "form" });
    }
  }, [router]);

  useEffect(() => {
    void inspectSession();
  }, [inspectSession]);

  const onSwitchToAdminLogin = async () => {
    clearError();
    const result = await logoutAndRedirect("admin-login");
    if (result.ok) {
      setPageState({ status: "form" });
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await loginStoreAccount({ email, displayName, mode: "login" });
      if (!isAdminAccountRole(result.user.accountRole)) {
        const cleared = await performStoreLogout({
          logout: logoutStoreAccount,
          redirect: () => undefined,
          destination: "login",
          navigate: false,
        });
        if (!cleared.ok) {
          setError(
            "관리자 권한이 없는 계정이며 현재 세션을 종료하지 못했습니다. 프로필 메뉴에서 다시 로그아웃해 주세요.",
          );
          return;
        }
        setError("관리자 권한이 없는 계정입니다. 관리자 이메일로 로그인해 주세요.");
        return;
      }
      router.replace(postAuthLandingPath("ADMIN"));
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "로그인에 실패했습니다.";
      if (message.includes("등록된 계정")) {
        setError("등록된 관리자 계정이 아닙니다.");
        return;
      }
      setError("로그인에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  if (pageState.status === "checking") {
    return (
      <div className="rounded-2xl border border-store-border bg-white p-5 shadow-card">
        <p className="text-sm text-store-muted">세션 확인 중…</p>
      </div>
    );
  }

  if (pageState.status === "non_admin_session") {
    return (
      <div className="rounded-2xl border border-store-border bg-white p-5 shadow-card">
        <h1 className="text-lg font-bold text-slate-900">{ADMIN_LOGIN_TITLE}</h1>
        <p className="mt-2 text-sm text-store-muted">
          현재 비관리자 계정으로 로그인되어 있습니다. 관리자 계정으로 전환하려면 먼저
          로그아웃해 주세요.
        </p>
        <div className="mt-3 rounded-xl border border-store-border bg-slate-50 px-3 py-3">
          <p className="text-xs font-bold text-slate-600">현재 로그인 계정</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {pageState.user.email || pageState.user.name || "알 수 없는 계정"}
          </p>
          <p className="mt-0.5 text-xs text-slate-700">
            {accountRoleDisplayLabel(pageState.user.accountRole)}
          </p>
        </div>
        {switchError ? (
          <p className="mt-3 text-sm text-red-700" role="alert">
            계정 전환에 실패했습니다. 다시 시도해 주세요.
          </p>
        ) : null}
        <button
          type="button"
          disabled={switchBusy}
          onClick={() => void onSwitchToAdminLogin()}
          className="mt-4 min-h-[44px] w-full rounded-xl bg-store-accent text-sm font-bold text-white disabled:opacity-50"
        >
          {switchBusy ? "계정 전환 중…" : "로그아웃 후 관리자 로그인"}
        </button>
        <Link
          href={ROUTES.home}
          className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center text-sm font-semibold text-store-accent"
        >
          스토어 홈으로 이동
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-store-border bg-white p-5 shadow-card">
      <h1 className="text-lg font-bold text-slate-900">{ADMIN_LOGIN_TITLE}</h1>
      <p className="mt-2 text-sm text-store-muted">{ADMIN_LOGIN_DESCRIPTION}</p>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="관리자 이메일"
          required
          className="min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm"
        />
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="표시 이름"
          required
          minLength={2}
          maxLength={80}
          className="min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm"
        />
        <button
          type="submit"
          disabled={busy}
          className="min-h-[44px] w-full rounded-xl bg-store-accent text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? "로그인 중…" : "관리자 로그인"}
        </button>
      </form>
      <Link
        href={ROUTES.home}
        className="mt-4 inline-flex min-h-[44px] items-center text-sm font-semibold text-store-accent"
      >
        스토어 홈으로 이동
      </Link>
    </div>
  );
}
