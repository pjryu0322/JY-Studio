"use client";

import type { FormEvent } from "react";
import type { PackLanguageCode } from "@/lib/pack-language";
import { packLanguageDisplayLabel } from "@/lib/pack-language";
import {
  PROVIDER_PACK_DESCRIPTION_HINT,
  PROVIDER_PACK_SAVE_AND_GO_PAYLOAD,
  PROVIDER_PACK_SAVE_DRAFT,
  PROVIDER_PACK_SHORT_SUMMARY_DRAFT_HINT,
  PROVIDER_PACK_SHORT_SUMMARY_HINT,
  PROVIDER_PACK_SHORT_SUMMARY_LABEL,
  PROVIDER_PACK_VERSION_CHANGELOG_LABEL_PREFIX,
} from "@/lib/role-based-ux-copy";

export function ProviderPackBasicInfoTab({
  editable,
  lockHint,
  name,
  shortDescription,
  description,
  versionOverview,
  language,
  versionLabel,
  saving,
  saveSuccessMessage,
  fieldErrors,
  onNameChange,
  onShortDescriptionChange,
  onDescriptionChange,
  onVersionOverviewChange,
  onLanguageChange,
  onSaveDraft,
  onSaveAndContinue,
}: {
  readonly editable: boolean;
  readonly lockHint?: string | null;
  readonly name: string;
  readonly shortDescription: string;
  readonly description: string;
  readonly versionOverview: string;
  readonly language: PackLanguageCode | null;
  readonly versionLabel: string;
  readonly saving: boolean;
  readonly saveSuccessMessage: string | null;
  readonly fieldErrors: {
    readonly name?: string;
    readonly shortDescription?: string;
    readonly description?: string;
  };
  readonly onNameChange: (value: string) => void;
  readonly onShortDescriptionChange: (value: string) => void;
  readonly onDescriptionChange: (value: string) => void;
  readonly onVersionOverviewChange: (value: string) => void;
  readonly onLanguageChange: (value: PackLanguageCode | null) => void;
  readonly onSaveDraft: () => void;
  readonly onSaveAndContinue: () => void;
}) {
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editable || saving) return;
    onSaveAndContinue();
  };

  return (
    <section className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <form onSubmit={onSubmit} className="space-y-4">
        {!editable ? (
          <p className="text-xs text-store-muted">
            {lockHint ?? "초안(DRAFT)이 아니면 수정할 수 없습니다."}
          </p>
        ) : null}

        {saveSuccessMessage ? (
          <p
            className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
            role="status"
          >
            {saveSuccessMessage}
          </p>
        ) : null}

        <div>
          <label className="block text-xs font-semibold" htmlFor="edit-name">
            지식팩 이름
            <span className="sr-only"> (필수)</span>
            <span aria-hidden="true" className="text-red-600">
              {" "}
              *
            </span>
          </label>
          <input
            id="edit-name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            disabled={!editable || saving}
            required={editable}
            aria-required={editable}
            aria-invalid={Boolean(fieldErrors.name)}
            aria-describedby={fieldErrors.name ? "edit-name-error" : undefined}
            className="mt-1 min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm disabled:bg-slate-50"
          />
          {fieldErrors.name ? (
            <p id="edit-name-error" className="mt-1 text-xs text-red-700" role="alert">
              {fieldErrors.name}
            </p>
          ) : null}
        </div>

        <div>
          <label className="block text-xs font-semibold" htmlFor="edit-language">
            문서 언어
            <span className="sr-only"> (검수 요청 시 필수)</span>
            <span aria-hidden="true" className="text-red-600">
              {" "}
              *
            </span>
          </label>
          <p id="edit-language-hint" className="mt-1 text-[11px] text-store-muted">
            원본문서와 구조화 JSON의 주 언어를 선택하세요. 현재 한국어와 영어만 지원합니다.
          </p>
          <select
            id="edit-language"
            value={language ?? ""}
            onChange={(e) => {
              const next = e.target.value;
              onLanguageChange(next === "ko" || next === "en" ? next : null);
            }}
            disabled={!editable || saving}
            aria-describedby="edit-language-hint"
            className="mt-1 min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm disabled:bg-slate-50"
          >
            <option value="">선택하세요</option>
            <option value="ko">{packLanguageDisplayLabel("ko")}</option>
            <option value="en">{packLanguageDisplayLabel("en")}</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold" htmlFor="edit-short">
            {PROVIDER_PACK_SHORT_SUMMARY_LABEL}
            <span className="sr-only"> (필수)</span>
            <span aria-hidden="true" className="text-red-600">
              {" "}
              *
            </span>
          </label>
          <p id="edit-short-hint" className="mt-1 text-[11px] text-store-muted">
            {PROVIDER_PACK_SHORT_SUMMARY_HINT}
          </p>
          <textarea
            id="edit-short"
            value={shortDescription}
            onChange={(e) => onShortDescriptionChange(e.target.value)}
            disabled={!editable || saving}
            required={editable}
            aria-required={editable}
            aria-invalid={Boolean(fieldErrors.shortDescription)}
            aria-describedby={
              fieldErrors.shortDescription
                ? "edit-short-hint edit-short-draft-hint edit-short-error"
                : "edit-short-hint edit-short-draft-hint"
            }
            rows={2}
            className="mt-1 w-full rounded-xl border border-store-border px-3 py-2 text-sm disabled:bg-slate-50"
          />
          <p id="edit-short-draft-hint" className="mt-1 text-[11px] text-store-muted">
            {PROVIDER_PACK_SHORT_SUMMARY_DRAFT_HINT}
          </p>
          {fieldErrors.shortDescription ? (
            <p id="edit-short-error" className="mt-1 text-xs text-red-700" role="alert">
              {fieldErrors.shortDescription}
            </p>
          ) : null}
        </div>

        <div>
          <label className="block text-xs font-semibold" htmlFor="edit-desc">
            상세 설명
            <span className="sr-only"> (필수)</span>
            <span aria-hidden="true" className="text-red-600">
              {" "}
              *
            </span>
          </label>
          <p id="edit-desc-hint" className="mt-1 text-[11px] text-store-muted">
            {PROVIDER_PACK_DESCRIPTION_HINT}
          </p>
          <textarea
            id="edit-desc"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            disabled={!editable || saving}
            required={editable}
            aria-required={editable}
            aria-invalid={Boolean(fieldErrors.description)}
            aria-describedby={
              fieldErrors.description ? "edit-desc-hint edit-desc-error" : "edit-desc-hint"
            }
            rows={5}
            className="mt-1 w-full rounded-xl border border-store-border px-3 py-2 text-sm disabled:bg-slate-50"
          />
          {fieldErrors.description ? (
            <p id="edit-desc-error" className="mt-1 text-xs text-red-700" role="alert">
              {fieldErrors.description}
            </p>
          ) : null}
        </div>

        <div>
          <label className="block text-xs font-semibold" htmlFor="edit-overview">
            {PROVIDER_PACK_VERSION_CHANGELOG_LABEL_PREFIX} ({versionLabel})
          </label>
          <textarea
            id="edit-overview"
            value={versionOverview}
            onChange={(e) => onVersionOverviewChange(e.target.value)}
            disabled={!editable || saving}
            rows={3}
            className="mt-1 w-full rounded-xl border border-store-border px-3 py-2 text-sm disabled:bg-slate-50"
          />
        </div>

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={!editable || saving}
            onClick={onSaveDraft}
            className="min-h-[44px] w-full rounded-xl border border-store-border bg-white px-4 text-sm font-semibold text-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {saving ? "저장 중…" : PROVIDER_PACK_SAVE_DRAFT}
          </button>
          <button
            type="submit"
            disabled={!editable || saving}
            className="min-h-[44px] w-full rounded-xl bg-store-accent px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {saving ? "저장 중…" : PROVIDER_PACK_SAVE_AND_GO_PAYLOAD}
          </button>
        </div>
      </form>
    </section>
  );
}
