"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { postAuthLandingPath, type SelectableAccountRole } from "@/lib/account-role";
import { saveConsumerProfile } from "@/lib/account-role-storage";
import { loginStoreAccount, registerStoreAccount } from "@/lib/auth-api";
import {
  ACCOUNT_PROFILE_LOGIN_HINT,
  ACCOUNT_PROFILE_LOGIN_TITLE,
  ACCOUNT_REGISTER_ROLE_ADMIN,
  ACCOUNT_REGISTER_ROLE_ADMIN_HINT,
  ACCOUNT_REGISTER_ROLE_LABEL,
  ACCOUNT_REGISTER_ROLE_PROVIDER,
  ACCOUNT_REGISTER_ROLE_PROVIDER_HINT,
  ACCOUNT_REGISTER_ROLE_USER,
  ACCOUNT_REGISTER_ROLE_USER_HINT,
} from "@/lib/role-based-ux-copy";
import { ROUTES } from "@/lib/routes";

function resolveLandingPath(
  role: Parameters<typeof postAuthLandingPath>[0],
  redirectTo: string | undefined,
): string {
  if (redirectTo && redirectTo !== ROUTES.home) return redirectTo;
  return postAuthLandingPath(role);
}

export function StoreLoginForm({
  redirectTo = ROUTES.home,
  title = ACCOUNT_PROFILE_LOGIN_TITLE,
  hint = ACCOUNT_PROFILE_LOGIN_HINT,
}: {
  readonly redirectTo?: string;
  readonly title?: string;
  readonly hint?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [intendedRole, setIntendedRole] = useState<SelectableAccountRole>("USER");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"login" | "register" | null>(null);

  const finish = async (mode: "login" | "register") => {
    setBusy(mode);
    setError(null);
    try {
      const result =
        mode === "register"
          ? await registerStoreAccount({ email, displayName, intendedRole })
          : await loginStoreAccount({ email, displayName, mode: "login" });

      const role = result.user.accountRole ?? result.accountRole;
      if (mode === "register" && role === "USER" && typeof window !== "undefined") {
        saveConsumerProfile(localStorage, {
          displayName: displayName.trim(),
          purpose: "지식팩 검색 및 API 연결",
        });
      }

      router.replace(resolveLandingPath(role, redirectTo));
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : mode === "register"
            ? "계정 생성에 실패했습니다."
            : "로그인에 실패했습니다.",
      );
    } finally {
      setBusy(null);
    }
  };

  const onLogin = async (e: FormEvent) => {
    e.preventDefault();
    await finish("login");
  };

  const onRegister = async () => {
    if (!email.trim()) {
      setError("이메일을 입력해 주세요.");
      return;
    }
    if (displayName.trim().length < 2) {
      setError("계정 생성 시 표시 이름은 2자 이상 입력해 주세요.");
      return;
    }
    await finish("register");
  };

  return (
    <div className="rounded-2xl border border-store-border bg-white p-5 shadow-card">
      <h1 className="text-lg font-bold text-slate-900">{title}</h1>
      <p className="mt-2 text-sm text-store-muted">{hint}</p>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      <form onSubmit={onLogin} className="mt-4 space-y-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="이메일"
          required
          autoComplete="email"
          className="min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm"
        />
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="표시 이름 (계정 생성 시 필수)"
          minLength={2}
          maxLength={80}
          autoComplete="name"
          className="min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm"
        />

        <fieldset className="space-y-2 rounded-xl border border-store-border bg-slate-50 p-3">
          <legend className="px-1 text-xs font-bold text-slate-700">{ACCOUNT_REGISTER_ROLE_LABEL}</legend>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-white px-3 py-2.5 border border-transparent has-[:checked]:border-store-accent">
            <input
              type="radio"
              name="intendedRole"
              value="USER"
              checked={intendedRole === "USER"}
              onChange={() => setIntendedRole("USER")}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-900">{ACCOUNT_REGISTER_ROLE_USER}</span>
              <span className="block text-xs text-store-muted">{ACCOUNT_REGISTER_ROLE_USER_HINT}</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-white px-3 py-2.5 border border-transparent has-[:checked]:border-store-accent">
            <input
              type="radio"
              name="intendedRole"
              value="PROVIDER"
              checked={intendedRole === "PROVIDER"}
              onChange={() => setIntendedRole("PROVIDER")}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-900">
                {ACCOUNT_REGISTER_ROLE_PROVIDER}
              </span>
              <span className="block text-xs text-store-muted">{ACCOUNT_REGISTER_ROLE_PROVIDER_HINT}</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-white px-3 py-2.5 border border-transparent has-[:checked]:border-store-accent">
            <input
              type="radio"
              name="intendedRole"
              value="ADMIN"
              checked={intendedRole === "ADMIN"}
              onChange={() => setIntendedRole("ADMIN")}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-900">{ACCOUNT_REGISTER_ROLE_ADMIN}</span>
              <span className="block text-xs text-store-muted">{ACCOUNT_REGISTER_ROLE_ADMIN_HINT}</span>
            </span>
          </label>
        </fieldset>

        <button
          type="submit"
          disabled={busy !== null}
          className="min-h-[48px] w-full rounded-2xl bg-store-accent text-sm font-bold text-white disabled:opacity-50"
        >
          {busy === "login" ? "로그인 중…" : "로그인"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void onRegister()}
          className="min-h-[48px] w-full rounded-2xl border border-store-border bg-white text-sm font-bold text-slate-800 disabled:opacity-50"
        >
          {busy === "register" ? "계정 생성 중…" : "계정 생성"}
        </button>
      </form>
    </div>
  );
}
