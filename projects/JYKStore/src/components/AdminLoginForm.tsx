"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { isAdminAccountRole, postAuthLandingPath } from "@/lib/account-role";
import { loginStoreAccount, logoutStoreAccount, registerStoreAccount } from "@/lib/auth-api";
import {
  ADMIN_LOGIN_DESCRIPTION,
  ADMIN_LOGIN_TITLE,
} from "@/lib/role-based-ux-copy";
import { ROUTES } from "@/lib/routes";

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let result;
      try {
        result = await loginStoreAccount({ email, displayName, mode: "login" });
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        if (!message.includes("등록된 계정")) throw err;
        result = await registerStoreAccount({ email, displayName, intendedRole: "USER" });
      }
      if (!isAdminAccountRole(result.user.accountRole)) {
        await logoutStoreAccount();
        setError("관리자 권한이 없는 계정입니다. 관리자 이메일로 로그인해 주세요.");
        return;
      }
      router.replace(postAuthLandingPath("ADMIN"));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

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
