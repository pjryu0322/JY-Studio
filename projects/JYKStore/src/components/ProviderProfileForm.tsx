"use client";

import { FormEvent, useEffect, useState } from "react";
import type { ProviderProfileDto } from "@/lib/provider-profile-dto";
import { PROVIDER_PROFILE_FOOTER_HINT } from "@/lib/role-based-ux-copy";

export function ProviderProfileForm({
  initial,
  saving,
  onSave,
  embedded = false,
}: {
  readonly initial: ProviderProfileDto | null;
  readonly saving: boolean;
  readonly embedded?: boolean;
  readonly onSave: (input: {
    displayName: string;
    description: string;
    websiteUrl?: string;
    contactEmail?: string;
  }) => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  useEffect(() => {
    if (initial) {
      setDisplayName(initial.displayName);
      setDescription(initial.description);
      setWebsiteUrl(initial.websiteUrl ?? "");
      setContactEmail(initial.contactEmail ?? "");
    }
  }, [initial]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await onSave({
      displayName,
      description,
      websiteUrl: websiteUrl.trim() || undefined,
      contactEmail: contactEmail.trim() || undefined,
    });
  };

  return (
    <form
      onSubmit={onSubmit}
      className={
        embedded
          ? "space-y-3"
          : "rounded-2xl border border-store-border bg-white p-4 shadow-card"
      }
    >
      {!embedded ? (
        <>
          <h2 className="text-sm font-bold text-slate-900">제공자 프로필</h2>
          <p className="mt-1 text-xs text-store-muted">
            지식팩을 등록하려면 제공자 프로필이 필요합니다. (현재는 기기별 clientId로 식별합니다.)
          </p>
        </>
      ) : null}
      <label className={`block text-xs font-semibold text-slate-700 ${embedded ? "" : "mt-4"}`} htmlFor="provider-display-name">
        표시 이름
      </label>
      <input
        id="provider-display-name"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        maxLength={80}
        className="mt-2 min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm"
        required
      />
      <label className="mt-3 block text-xs font-semibold text-slate-700" htmlFor="provider-description">
        소개
      </label>
      <textarea
        id="provider-description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={500}
        rows={4}
        className="mt-2 w-full rounded-xl border border-store-border px-3 py-2 text-sm"
        required
      />
      <label className="mt-3 block text-xs font-semibold text-slate-700" htmlFor="provider-website">
        웹사이트 (선택)
      </label>
      <input
        id="provider-website"
        type="url"
        value={websiteUrl}
        onChange={(e) => setWebsiteUrl(e.target.value)}
        className="mt-2 min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm"
      />
      <label className="mt-3 block text-xs font-semibold text-slate-700" htmlFor="provider-email">
        연락 이메일 (선택)
      </label>
      <input
        id="provider-email"
        type="email"
        value={contactEmail}
        onChange={(e) => setContactEmail(e.target.value)}
        className="mt-2 min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm"
      />
      <button
        type="submit"
        disabled={saving}
        className="mt-4 min-h-[44px] w-full rounded-xl bg-store-accent px-4 text-sm font-bold text-white disabled:opacity-50"
      >
        {saving ? "저장 중…" : initial ? "프로필 수정" : "프로필 등록"}
      </button>
      {!initial ? (
        <p className="mt-2 text-center text-xs text-store-muted">{PROVIDER_PROFILE_FOOTER_HINT}</p>
      ) : null}
    </form>
  );
}
