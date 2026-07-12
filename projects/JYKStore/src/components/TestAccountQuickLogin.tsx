"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { postAuthLandingPath, type AccountRole } from "@/lib/account-role";
import { fetchTestAccounts, loginWithTestAccount } from "@/lib/test-account-api";
import type { TestAccountDto } from "@/lib/test-account-service";

const ROLE_SECTIONS: Array<{ role: AccountRole; title: string }> = [
  { role: "ADMIN", title: "관리자" },
  { role: "PROVIDER", title: "제공자" },
  { role: "USER", title: "일반 사용자" },
];

function ctaLabel(role: AccountRole): string {
  switch (role) {
    case "ADMIN":
      return "관리자로 로그인";
    case "PROVIDER":
      return "제공자로 로그인";
    default:
      return "일반 사용자로 로그인";
  }
}

/** Mount only when the server has confirmed the switcher is enabled. */
export function TestAccountQuickLogin() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<TestAccountDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTestAccounts();
      setAccounts(data.accounts);
    } catch {
      setError("테스트 계정을 불러오지 못했습니다.");
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onLogin = async (account: TestAccountDto) => {
    if (busyUserId) return;
    setBusyUserId(account.id);
    setLoginError(null);
    try {
      const result = await loginWithTestAccount(account.id);
      router.replace(postAuthLandingPath(result.accountRole));
      router.refresh();
    } catch {
      setLoginError("선택한 계정으로 로그인하지 못했습니다.");
    } finally {
      setBusyUserId(null);
    }
  };

  const sections = ROLE_SECTIONS.map((section) => ({
    ...section,
    items: accounts.filter((account) => account.accountRole === section.role),
  })).filter((section) => section.items.length > 0);

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-card">
      <h2 className="text-base font-bold text-slate-900">테스트 계정 빠른 로그인</h2>
      <p className="mt-1 text-xs text-amber-900">
        개발·테스트 전용 · 등록된 계정을 선택하면 비밀번호 없이 로그인됩니다. 운영환경에서는
        사용할 수 없습니다.
      </p>

      {loading ? (
        <p className="mt-4 text-sm text-store-muted">계정 불러오는 중…</p>
      ) : null}

      {error ? (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-store-border bg-white px-4 text-sm font-semibold text-slate-800"
          >
            다시 시도
          </button>
        </div>
      ) : null}

      {loginError ? (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {loginError}
        </p>
      ) : null}

      {!loading && !error && sections.length === 0 ? (
        <p className="mt-4 text-sm text-store-muted">등록된 테스트 계정이 없습니다.</p>
      ) : null}

      <div className="mt-4 space-y-4">
        {sections.map((section) => (
          <section key={section.role}>
            <h3 className="text-xs font-bold uppercase tracking-wide text-amber-950">
              {section.title}
            </h3>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {section.items.map((account) => {
                const busy = Boolean(busyUserId);
                const thisBusy = busyUserId === account.id;
                return (
                  <li key={account.id}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void onLogin(account)}
                      className="flex min-h-[44px] w-full flex-col items-start rounded-xl border border-amber-100 bg-white px-3 py-3 text-left active:bg-slate-50 disabled:opacity-50"
                    >
                      <span className="w-full truncate text-sm font-bold text-slate-900">
                        {account.displayName}
                      </span>
                      <span className="mt-0.5 w-full truncate text-xs text-store-muted">
                        {account.email}
                      </span>
                      <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                        {account.roleLabel}
                      </span>
                      <span className="mt-2 text-xs font-semibold text-store-accent">
                        {thisBusy ? "로그인 중…" : ctaLabel(account.accountRole)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
