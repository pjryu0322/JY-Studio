"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ROUTES } from "@/lib/routes";
import {
  clearAdminSession,
  confirmAdminSession,
  isAdminSessionVerified,
  loadAdminSession,
  saveAdminSession,
  verifyAdminOpsToken,
} from "@/lib/admin-ops-session";

export function AdminAccessGate({ children }: { readonly children: React.ReactNode }) {
  const [state, setState] = useState<"checking" | "allowed" | "blocked">("checking");

  const recheck = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!isAdminSessionVerified(sessionStorage)) {
      setState("blocked");
      return;
    }
    const ok = await confirmAdminSession(sessionStorage);
    setState(ok ? "allowed" : "blocked");
  }, []);

  useEffect(() => {
    void recheck();
  }, [recheck]);

  if (state === "checking") {
    return <p className="text-sm text-store-muted">운영자 권한 확인 중…</p>;
  }

  if (state === "blocked") {
    return (
      <div className="space-y-4 pb-8">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-card">
          <h1 className="text-lg font-bold text-slate-900">운영자 권한이 필요합니다</h1>
          <p className="mt-2 text-sm text-slate-700">
            관리자 콘솔은 운영자 권한 확인 후에만 이용할 수 있습니다. 계정 화면에서 운영자 권한을
            확인해 주세요.
          </p>
          <Link
            href={`${ROUTES.account}#account-role-admin`}
            className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-store-accent text-sm font-bold text-white"
          >
            계정에서 운영자 권한 확인
          </Link>
        </div>
        <Link href={ROUTES.account} className="inline-flex min-h-[44px] items-center text-sm font-semibold text-store-accent">
          ← 계정으로 돌아가기
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}

export function AdminRoleVerifier({
  verified,
  onVerified,
}: {
  readonly verified: boolean;
  readonly onVerified: () => void;
}) {
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const trimmed = token.trim();
      const ok = await verifyAdminOpsToken(trimmed || undefined);
      if (!ok) {
        setError("권한을 확인할 수 없습니다.");
        return;
      }
      saveAdminSession(sessionStorage, { token: trimmed || undefined });
      onVerified();
      setToken("");
    } catch {
      setError("권한을 확인할 수 없습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const onClear = () => {
    clearAdminSession(sessionStorage);
    onVerified();
  };

  if (verified) {
    const session = loadAdminSession(sessionStorage);
    return (
      <div className="mt-3 space-y-2">
        <p className="text-xs font-semibold text-emerald-800">운영자 권한 확인됨</p>
        {session?.verifiedAt ? (
          <p className="text-[10px] text-store-muted">
            확인 시각: {new Date(session.verifiedAt).toLocaleString("ko-KR")}
          </p>
        ) : null}
        <div className="flex flex-col gap-2">
          <Link
            href={ROUTES.admin}
            className="flex min-h-[40px] items-center justify-center rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800"
          >
            관리자 콘솔 열기
          </Link>
          <button
            type="button"
            onClick={onClear}
            className="min-h-[36px] text-xs font-semibold text-store-muted underline-offset-2 hover:underline"
          >
            운영자 권한 해제
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 space-y-2">
      <p className="text-xs text-store-muted">
        운영자 토큰을 입력해 권한을 확인합니다. (세션 동안만 보관, localStorage 미사용)
      </p>
      <input
        type="password"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        autoComplete="off"
        placeholder="Admin Ops Token (선택: 로컬 dev)"
        className="min-h-[40px] w-full rounded-lg border border-store-border px-3 text-sm"
      />
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      <button
        type="submit"
        disabled={submitting}
        className="min-h-[44px] w-full rounded-xl border border-slate-400 bg-white text-sm font-bold text-slate-800 disabled:opacity-50"
      >
        {submitting ? "확인 중…" : "운영자 권한 확인"}
      </button>
    </form>
  );
}
