"use client";

import { FormEvent, useState } from "react";

export function ApiKeyCreateForm({
  onCreate,
  creating,
}: {
  readonly onCreate: (name: string) => Promise<void>;
  readonly creating: boolean;
}) {
  const [name, setName] = useState("");

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    await onCreate(trimmed);
    setName("");
  };

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <h2 className="text-sm font-bold text-slate-900">새 API Key 발급</h2>
      <p className="mt-1 text-xs text-store-muted">외부 AI 도구나 서비스 연동에 사용할 Key를 발급합니다.</p>
      <label htmlFor="api-key-name" className="mt-4 block text-xs font-semibold text-slate-700">
        Key 이름
      </label>
      <input
        id="api-key-name"
        name="name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="예: Local development"
        maxLength={80}
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
