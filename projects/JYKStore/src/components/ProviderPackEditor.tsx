"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ProviderPackReadinessCard } from "@/components/ProviderPackReadinessCard";
import { ProviderPackStatusBadge } from "@/components/ProviderPackStatusBadge";
import { ProviderSourceDocumentForm } from "@/components/ProviderSourceDocumentForm";
import type { ProviderPackDetailDto } from "@/lib/provider-pack-dto";
import {
  fetchProviderPack,
  submitProviderPackApi,
  updateProviderPackApi,
} from "@/lib/provider-center-api";

export function ProviderPackEditor({ packId }: { readonly packId: string }) {
  const [pack, setPack] = useState<ProviderPackDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [versionOverview, setVersionOverview] = useState("");

  const editable = pack?.status === "DRAFT";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProviderPack(packId);
      setPack(data.pack);
      setName(data.pack.name);
      setShortDescription(data.pack.shortDescription);
      setDescription(data.pack.description);
      setVersionOverview(data.pack.versions[0]?.overview ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "지식팩을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [packId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editable) return;
    setSaving(true);
    setError(null);
    try {
      const data = await updateProviderPackApi(packId, {
        name,
        shortDescription,
        description,
        versionOverview,
      });
      setPack(data.pack);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const onSubmitReview = async () => {
    if (!editable) return;
    const ok = window.confirm("검수 요청을 제출할까요? 제출 후에는 초안 수정이 제한됩니다.");
    if (!ok) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = await submitProviderPackApi(packId);
      setPack(data.pack);
    } catch (err) {
      setError(err instanceof Error ? err.message : "검수 요청에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-store-muted">불러오는 중…</p>;
  }

  if (!pack) {
    return <p className="text-sm text-red-700">{error ?? "지식팩을 찾을 수 없습니다."}</p>;
  }

  const latestVersion = pack.versions[0];
  const allDocs = pack.versions.flatMap((v) => v.sourceDocuments);

  return (
    <div className="space-y-4 pb-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-2xl">{pack.icon}</span>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold text-slate-900">{pack.name}</h1>
          <p className="font-mono text-xs text-store-muted">{pack.packId}</p>
        </div>
        <ProviderPackStatusBadge status={pack.status} />
      </div>

      <ProviderPackReadinessCard pack={pack} />

      {pack.status === "REVIEWING" ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          검수 요청이 접수되었습니다. Admin 승인/반려는 다음 Phase에서 제공됩니다.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      <form onSubmit={onSave} className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <h2 className="text-sm font-bold text-slate-900">기본 정보</h2>
        {!editable ? (
          <p className="mt-1 text-xs text-store-muted">초안(DRAFT)이 아니면 수정할 수 없습니다.</p>
        ) : null}
        <label className="mt-3 block text-xs font-semibold" htmlFor="edit-name">
          이름
        </label>
        <input
          id="edit-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={!editable}
          className="mt-1 min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm disabled:bg-slate-50"
        />
        <label className="mt-3 block text-xs font-semibold" htmlFor="edit-short">
          짧은 설명
        </label>
        <textarea
          id="edit-short"
          value={shortDescription}
          onChange={(e) => setShortDescription(e.target.value)}
          disabled={!editable}
          rows={2}
          className="mt-1 w-full rounded-xl border border-store-border px-3 py-2 text-sm disabled:bg-slate-50"
        />
        <label className="mt-3 block text-xs font-semibold" htmlFor="edit-desc">
          설명
        </label>
        <textarea
          id="edit-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={!editable}
          rows={4}
          className="mt-1 w-full rounded-xl border border-store-border px-3 py-2 text-sm disabled:bg-slate-50"
        />
        <label className="mt-3 block text-xs font-semibold" htmlFor="edit-overview">
          버전 개요 ({latestVersion?.version ?? "—"})
        </label>
        <textarea
          id="edit-overview"
          value={versionOverview}
          onChange={(e) => setVersionOverview(e.target.value)}
          disabled={!editable}
          rows={3}
          className="mt-1 w-full rounded-xl border border-store-border px-3 py-2 text-sm disabled:bg-slate-50"
        />
        {editable ? (
          <button
            type="submit"
            disabled={saving}
            className="mt-4 min-h-[44px] w-full rounded-xl bg-store-accent text-sm font-bold text-white disabled:opacity-50"
          >
            {saving ? "저장 중…" : "변경 저장"}
          </button>
        ) : null}
      </form>

      <section className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <h2 className="text-sm font-bold text-slate-900">원천 문서</h2>
        {allDocs.length === 0 ? (
          <p className="mt-2 text-sm text-store-muted">등록된 문서가 없습니다.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {allDocs.map((doc) => (
              <li key={doc.id} className="rounded-xl border border-store-border px-3 py-2 text-sm">
                <p className="font-semibold text-slate-900">{doc.title}</p>
                <p className="text-xs text-store-muted">
                  {doc.sourceType}
                  {doc.sourceUrl ? ` · ${doc.sourceUrl}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4">
          <ProviderSourceDocumentForm packId={packId} disabled={!editable} onAdded={load} />
        </div>
      </section>

      {editable ? (
        <button
          type="button"
          onClick={() => void onSubmitReview()}
          disabled={submitting}
          className="min-h-[44px] w-full rounded-xl border-2 border-store-accent bg-white text-sm font-bold text-store-accent disabled:opacity-50"
        >
          {submitting ? "제출 중…" : "검수 요청 제출"}
        </button>
      ) : null}
    </div>
  );
}
