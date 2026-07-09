"use client";

import { FormEvent, useState } from "react";

export type AdminOpsTokenFormProps = {
  applied: boolean;
  onApply: (token: string) => void | Promise<void>;
};

export function AdminOpsTokenForm({ applied, onApply }: AdminOpsTokenFormProps) {
  const [tokenDraft, setTokenDraft] = useState("");

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = tokenDraft.trim();
    if (!trimmed) return;
    setTokenDraft("");
    void onApply(trimmed);
  };

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-store-border bg-white p-4 shadow-card"
    >
      <label htmlFor="admin-quota-token" className="block text-xs font-semibold text-slate-700">
        Admin Ops Token
      </label>
      <p className="mt-1 text-xs text-store-muted">
        React state에만 보관합니다. localStorage/sessionStorage에는 저장하지 않습니다.
      </p>
      <input
        id="admin-quota-token"
        type="password"
        autoComplete="off"
        value={tokenDraft}
        onChange={(e) => setTokenDraft(e.target.value)}
        placeholder={applied ? "토큰이 적용됨 — 변경 시 다시 입력" : "Admin Ops Token"}
        className="mt-3 min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm"
      />
      <button
        type="submit"
        className="mt-3 min-h-[44px] w-full rounded-xl bg-store-accent px-4 text-sm font-bold text-white"
      >
        적용
      </button>
    </form>
  );
}
