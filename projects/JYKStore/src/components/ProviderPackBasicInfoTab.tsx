"use client";

import type { FormEvent } from "react";
import {
  PROVIDER_PACK_ADVANCED_SUMMARY_EDIT,
  PROVIDER_PACK_AUTO_SUMMARY_LABEL,
  PROVIDER_PACK_ID_LABEL,
  PROVIDER_PACK_ID_READONLY_HINT,
} from "@/lib/role-based-ux-copy";

export function ProviderPackBasicInfoTab({
  packId,
  packName,
  editable,
  name,
  shortDescription,
  description,
  versionOverview,
  versionLabel,
  saving,
  onNameChange,
  onShortDescriptionChange,
  onDescriptionChange,
  onVersionOverviewChange,
  onSave,
}: {
  readonly packId: string;
  readonly packName: string;
  readonly editable: boolean;
  readonly name: string;
  readonly shortDescription: string;
  readonly description: string;
  readonly versionOverview: string;
  readonly versionLabel: string;
  readonly saving: boolean;
  readonly onNameChange: (value: string) => void;
  readonly onShortDescriptionChange: (value: string) => void;
  readonly onDescriptionChange: (value: string) => void;
  readonly onVersionOverviewChange: (value: string) => void;
  readonly onSave: (e: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <h2 className="text-sm font-bold text-slate-900">{packName}</h2>
      <p className="mt-2 text-xs text-store-muted">
        <span className="font-semibold text-slate-700">{PROVIDER_PACK_ID_LABEL}</span>{" "}
        <span className="font-mono text-slate-900">{packId}</span>
      </p>
      <p className="mt-1 text-[11px] text-store-muted">{PROVIDER_PACK_ID_READONLY_HINT}</p>

      <form onSubmit={onSave} className="mt-4 space-y-3">
        {!editable ? (
          <p className="text-xs text-store-muted">초안(DRAFT)이 아니면 수정할 수 없습니다.</p>
        ) : null}
        <label className="block text-xs font-semibold" htmlFor="edit-name">
          지식팩 이름
        </label>
        <input
          id="edit-name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          disabled={!editable}
          className="min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm disabled:bg-slate-50"
        />
        <label className="block text-xs font-semibold" htmlFor="edit-desc">
          상세 설명
        </label>
        <textarea
          id="edit-desc"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          disabled={!editable}
          rows={4}
          className="w-full rounded-xl border border-store-border px-3 py-2 text-sm disabled:bg-slate-50"
        />
        <div>
          <p className="text-xs font-semibold text-slate-700">{PROVIDER_PACK_AUTO_SUMMARY_LABEL}</p>
          <p className="mt-2 rounded-xl border border-store-border bg-slate-50 px-3 py-2 text-sm text-slate-800">
            {shortDescription || "—"}
          </p>
        </div>
        <details className="rounded-xl border border-store-border bg-slate-50 px-3 py-2">
          <summary className="cursor-pointer text-xs font-semibold text-slate-800">
            {PROVIDER_PACK_ADVANCED_SUMMARY_EDIT}
          </summary>
          <label className="mt-3 block text-xs font-semibold" htmlFor="edit-short">
            요약 문구
          </label>
          <textarea
            id="edit-short"
            value={shortDescription}
            onChange={(e) => onShortDescriptionChange(e.target.value)}
            disabled={!editable}
            rows={2}
            className="mt-1 w-full rounded-xl border border-store-border bg-white px-3 py-2 text-sm disabled:bg-slate-50"
          />
        </details>
        <label className="block text-xs font-semibold" htmlFor="edit-overview">
          버전 개요 ({versionLabel})
        </label>
        <textarea
          id="edit-overview"
          value={versionOverview}
          onChange={(e) => onVersionOverviewChange(e.target.value)}
          disabled={!editable}
          rows={3}
          className="w-full rounded-xl border border-store-border px-3 py-2 text-sm disabled:bg-slate-50"
        />
        {editable ? (
          <button
            type="submit"
            disabled={saving}
            className="min-h-[44px] w-full rounded-xl bg-store-accent text-sm font-bold text-white disabled:opacity-50"
          >
            {saving ? "저장 중…" : "변경 저장"}
          </button>
        ) : null}
      </form>
    </section>
  );
}
