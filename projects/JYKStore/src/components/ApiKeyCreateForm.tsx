"use client";

import { FormEvent, useState } from "react";

export function ApiKeyCreateForm({
  onCreate,
  creating,
}: {
  readonly onCreate: (input: { name: string; expiresAt: string | null }) => Promise<void>;
  readonly creating: boolean;
}) {
  const [name, setName] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    await onCreate({
      name: trimmed,
      expiresAt: expiresAt.trim()
        ? new Date(`${expiresAt.trim()}T23:59:59.000Z`).toISOString()
        : null,
    });
    setName("");
    setExpiresAt("");
  };

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <h2 className="text-sm font-bold text-slate-900">새 API Key 발급</h2>
      <p className="mt-1 text-xs text-store-muted">
        외부 AI 도구·MCP·서비스 연동용 Key입니다. raw key는 발급 직후 1회만 표시됩니다. 기본 scope는{" "}
        <span className="font-semibold">context:read</span>입니다.
      </p>
      <label htmlFor="api-key-name" className="mt-4 block text-xs font-semibold text-slate-700">
        Key 이름
      </label>
      <input
        id="api-key-name"
        name="name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="예: Local MCP key"
        maxLength={80}
        className="mt-2 min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm"
      />
      <label htmlFor="api-key-expires" className="mt-4 block text-xs font-semibold text-slate-700">
        만료일 (선택)
      </label>
      <input
        id="api-key-expires"
        name="expiresAt"
        type="date"
        value={expiresAt}
        onChange={(e) => setExpiresAt(e.target.value)}
        className="mt-2 min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm"
      />
      <button
        type="submit"
        disabled={creating || !name.trim()}
        className="mt-4 min-h-[44px] w-full rounded-xl bg-store-accent px-4 text-sm font-bold text-white active:opacity-90 disabled:opacity-50"
      >
        {creating ? "발급 중…" : "API Key 발급"}
      </button>
    </form>
  );
}
