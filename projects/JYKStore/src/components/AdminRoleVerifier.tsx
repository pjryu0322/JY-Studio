"use client";

import Link from "next/link";
import { useState } from "react";
import {
  clearAdminSession,
  loadAdminSession,
  saveAdminSession,
  verifyAdminOpsToken,
} from "@/lib/admin-ops-session";
import { ROUTES } from "@/lib/routes";

/** Transitional bootstrap: Admin Ops Token verifier on account page. */
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
        <p className="text-xs font-semibold text-emerald-800">운영자 권한 확인됨 (부트스트랩)</p>
        {session?.verifiedAt ? (
          <p className="text-[10px] text-store-muted">
            확인 시각: {new Date(session.verifiedAt).toLocaleString("ko-KR")}
          </p>
        ) : null}
        <div className="flex flex-col gap-2">
          <Link
            href={ROUTES.adminReviews}
            className="flex min-h-[40px] items-center justify-center rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800"
          >
            관리자 콘솔 열기
          </Link>
          <Link
            href={ROUTES.adminLogin}
            className="flex min-h-[40px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs font-semibold text-slate-700"
          >
            관리자 계정 로그인
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
        일반 검수는 관리자 계정 로그인을 사용하세요. Ops Token은 부트스트랩/비상용입니다.
      </p>
      <Link
        href={ROUTES.adminLogin}
        className="flex min-h-[40px] items-center justify-center rounded-lg bg-store-accent text-xs font-bold text-white"
      >
        관리자 계정 로그인
      </Link>
      <input
        type="password"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        autoComplete="off"
        placeholder="Admin Ops Token (선택: 로컬/비상)"
        className="min-h-[40px] w-full rounded-lg border border-store-border px-3 text-sm"
      />
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      <button
        type="submit"
        disabled={submitting}
        className="min-h-[44px] w-full rounded-xl border border-slate-400 bg-white text-sm font-bold text-slate-800 disabled:opacity-50"
      >
        {submitting ? "확인 중…" : "Ops Token으로 권한 확인"}
      </button>
    </form>
  );
}
