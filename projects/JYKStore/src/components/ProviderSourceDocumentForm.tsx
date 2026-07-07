"use client";

import { FormEvent, useState } from "react";
import { addSourceDocumentApi } from "@/lib/provider-center-api";

export function ProviderSourceDocumentForm({
  packId,
  disabled,
  onAdded,
}: {
  readonly packId: string;
  readonly disabled: boolean;
  readonly onAdded: () => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [sourceType, setSourceType] = useState("MANUAL");
  const [sourceUrl, setSourceUrl] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (disabled) return;
    setSaving(true);
    setError(null);
    try {
      await addSourceDocumentApi(packId, {
        title,
        sourceType,
        sourceUrl: sourceUrl.trim() || undefined,
        content: content.trim() || undefined,
      });
      setTitle("");
      setSourceUrl("");
      setContent("");
      await onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "원천 문서를 추가하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-dashed border-store-border bg-slate-50 p-4">
      <h3 className="text-sm font-bold text-slate-900">원천 문서 추가</h3>
      <p className="mt-1 text-xs text-store-muted">텍스트 메타데이터만 등록합니다. 파일 업로드는 이후 단계에서 제공됩니다.</p>
      {error ? (
        <p className="mt-2 text-sm text-red-700">{error}</p>
      ) : null}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="제목"
        disabled={disabled}
        className="mt-3 min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm disabled:opacity-60"
        required
      />
      <input
        value={sourceType}
        onChange={(e) => setSourceType(e.target.value)}
        placeholder="sourceType (예: MANUAL)"
        disabled={disabled}
        className="mt-2 min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm disabled:opacity-60"
        required
      />
      <input
        value={sourceUrl}
        onChange={(e) => setSourceUrl(e.target.value)}
        placeholder="sourceUrl (선택)"
        disabled={disabled}
        className="mt-2 min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm disabled:opacity-60"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="문서 원문 또는 요약"
        rows={3}
        disabled={disabled}
        className="mt-2 w-full rounded-xl border border-store-border px-3 py-2 text-sm disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={disabled || saving}
        className="mt-3 min-h-[44px] w-full rounded-xl border border-store-border bg-white text-sm font-semibold disabled:opacity-50"
      >
        {saving ? "추가 중…" : "문서 등록"}
      </button>
    </form>
  );
}
