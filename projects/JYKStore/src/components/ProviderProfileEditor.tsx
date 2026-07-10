"use client";

import { FormEvent, useEffect, useState } from "react";
import type { ProviderProfileDto } from "@/lib/provider-profile-dto";
import { upsertProviderProfileApi } from "@/lib/provider-center-api";
import {
  PROVIDER_PROFILE_EDIT_TITLE,
  PROVIDER_PROFILE_SAVE_CTA,
  PROVIDER_PROFILE_SAVE_SUCCESS,
} from "@/lib/role-based-ux-copy";

export function ProviderProfileEditor({
  initial,
  onSaved,
  onCancel,
}: {
  readonly initial: ProviderProfileDto | null;
  readonly onSaved?: (profile: ProviderProfileDto) => void;
  readonly onCancel?: () => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(initial?.displayName ?? "");
    setDescription(initial?.description ?? "");
    setWebsiteUrl(initial?.websiteUrl ?? "");
    setContactEmail(initial?.contactEmail ?? "");
  }, [initial]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await upsertProviderProfileApi({
        displayName,
        description,
        websiteUrl: websiteUrl.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
      });
      setMessage(PROVIDER_PROFILE_SAVE_SUCCESS);
      onSaved?.(res.profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-3 p-4">
      <h3 className="text-sm font-bold text-slate-900">{PROVIDER_PROFILE_EDIT_TITLE}</h3>
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p>
      ) : null}
      {message ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-900">{message}</p>
      ) : null}
      <label className="block text-xs font-semibold text-slate-700" htmlFor="hdr-provider-name">
        표시명
      </label>
      <input
        id="hdr-provider-name"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        maxLength={80}
        required
        className="min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm"
      />
      <label className="block text-xs font-semibold text-slate-700" htmlFor="hdr-provider-desc">
        소개
      </label>
      <textarea
        id="hdr-provider-desc"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={500}
        rows={3}
        className="w-full rounded-xl border border-store-border px-3 py-2 text-sm"
      />
      <label className="block text-xs font-semibold text-slate-700" htmlFor="hdr-provider-web">
        웹사이트
      </label>
      <input
        id="hdr-provider-web"
        value={websiteUrl}
        onChange={(e) => setWebsiteUrl(e.target.value)}
        className="min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm"
        placeholder="https://"
      />
      <label className="block text-xs font-semibold text-slate-700" htmlFor="hdr-provider-email">
        연락 이메일
      </label>
      <input
        id="hdr-provider-email"
        type="email"
        value={contactEmail}
        onChange={(e) => setContactEmail(e.target.value)}
        className="min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm"
      />
      <div className="flex gap-2 pt-1">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] flex-1 rounded-xl border border-store-border text-sm font-semibold text-slate-700"
          >
            닫기
          </button>
        ) : null}
        <button
          type="submit"
          disabled={saving}
          className="min-h-[44px] flex-1 rounded-xl bg-store-accent text-sm font-bold text-white disabled:opacity-50"
        >
          {saving ? "저장 중…" : PROVIDER_PROFILE_SAVE_CTA}
        </button>
      </div>
    </form>
  );
}
