"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { KnowledgePayloadPublicDto } from "@/lib/distribution/payload-service";
import {
  deleteProviderPackPayloadApi,
  fetchProviderPackPayloadApi,
  uploadProviderPackPayloadApi,
} from "@/lib/provider-center-api";
import {
  PROVIDER_PACK_GO_TO_DISTRIBUTION_TAB,
  PROVIDER_PACK_GO_TO_REVIEW_TAB,
} from "@/lib/role-based-ux-copy";

export function ProviderPayloadTab({
  packId,
  editable,
  onGoToDistributionTab,
  onGoToReviewTab,
  onPayloadChanged,
}: {
  readonly packId: string;
  readonly editable: boolean;
  readonly onGoToDistributionTab: () => void;
  readonly onGoToReviewTab: () => void;
  readonly onPayloadChanged?: (payload: KnowledgePayloadPublicDto | null) => void;
}) {
  const [payload, setPayload] = useState<KnowledgePayloadPublicDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [generatorType, setGeneratorType] = useState<"DOCLING" | "UNSTRUCTURED">("DOCLING");
  const [generatorVersion, setGeneratorVersion] = useState("");
  const profile =
    generatorType === "DOCLING" ? "docling-chunks-v1" : "unstructured-elements-v1";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProviderPackPayloadApi(packId);
      setPayload(data.payload);
      onPayloadChanged?.(data.payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payload를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [packId, onPayloadChanged]);

  useEffect(() => {
    void load();
  }, [load]);

  const onUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!editable || !file || uploading) return;
    setUploading(true);
    setError(null);
    try {
      const data = await uploadProviderPackPayloadApi(packId, {
        file,
        profile,
        generatorType,
        generatorVersion: generatorVersion.trim() || undefined,
      });
      setPayload(data.payload);
      onPayloadChanged?.(data.payload);
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "업로드에 실패했습니다.");
    } finally {
      setUploading(false);
    }
  };

  const onDelete = async () => {
    if (!editable || !payload || deleting) return;
    const ok = window.confirm("등록된 Payload를 삭제하고 다시 업로드할 수 있습니다. 계속할까요?");
    if (!ok) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteProviderPackPayloadApi(packId);
      setPayload(null);
      onPayloadChanged?.(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제에 실패했습니다.");
    } finally {
      setDeleting(false);
    }
  };

  const report =
    payload?.validationReport && typeof payload.validationReport === "object"
      ? (payload.validationReport as Record<string, unknown>)
      : null;

  if (loading) {
    return <p className="text-sm text-store-muted">Payload 불러오는 중…</p>;
  }

  return (
    <section id="pack-payload" className="space-y-4 rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <div>
        <h2 className="text-sm font-bold text-slate-900">Payload 등록</h2>
        <p className="mt-1 text-xs text-store-muted">
          외부 도구에서 생성한 ZIP을 원본 그대로 등록합니다. 업로드 후 내용은 수정할 수 없습니다.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      ) : null}

      {payload ? (
        <div className="space-y-2 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-xs text-slate-800">
          <p className="font-semibold text-emerald-950">등록된 불변 Payload</p>
          <p>파일명: {payload.originalFileName}</p>
          <p>크기: {payload.fileSize.toLocaleString()} bytes</p>
          <p className="break-all">SHA-256: {payload.checksumSha256}</p>
          <p>
            Profile: {payload.profile} · 생성기: {payload.generatorType}
            {payload.generatorVersion ? ` ${payload.generatorVersion}` : ""}
          </p>
          <p>검증: {payload.validationStatus}</p>
          {typeof report?.entrypoint === "string" ? <p>entrypoint: {report.entrypoint}</p> : null}
          {typeof report?.recordCount === "number" ? <p>recordCount: {report.recordCount}</p> : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <a
              href={`/api/v1/provider/packs/${encodeURIComponent(packId)}/payload/download`}
              className="inline-flex min-h-[40px] items-center rounded-xl border border-store-border bg-white px-3 text-xs font-semibold text-store-accent"
            >
              원본 다운로드
            </a>
            {editable ? (
              <button
                type="button"
                onClick={() => void onDelete()}
                disabled={deleting}
                className="min-h-[40px] rounded-xl border border-red-200 px-3 text-xs font-semibold text-red-700 disabled:opacity-60"
              >
                {deleting ? "삭제 중…" : "삭제 후 재등록"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onGoToDistributionTab}
              className="min-h-[40px] rounded-xl bg-store-accent px-3 text-xs font-bold text-white"
            >
              {PROVIDER_PACK_GO_TO_DISTRIBUTION_TAB}
            </button>
            {payload.validationStatus === "VALID" ? (
              <button
                type="button"
                onClick={onGoToReviewTab}
                className="min-h-[40px] rounded-xl border border-store-border px-3 text-xs font-semibold text-slate-800"
              >
                {PROVIDER_PACK_GO_TO_REVIEW_TAB}
              </button>
            ) : null}
          </div>
        </div>
      ) : editable ? (
        <form onSubmit={(e) => void onUpload(e)} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-700" htmlFor="payload-file">
              ZIP 파일
            </label>
            <input
              id="payload-file"
              type="file"
              accept=".zip,application/zip"
              className="mt-2 block w-full text-sm"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700" htmlFor="payload-generator">
              생성기
            </label>
            <select
              id="payload-generator"
              value={generatorType}
              onChange={(e) => setGeneratorType(e.target.value as "DOCLING" | "UNSTRUCTURED")}
              className="mt-2 min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm"
            >
              <option value="DOCLING">Docling</option>
              <option value="UNSTRUCTURED">Unstructured</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700" htmlFor="payload-gen-version">
              생성기 버전 (선택)
            </label>
            <input
              id="payload-gen-version"
              value={generatorVersion}
              onChange={(e) => setGeneratorVersion(e.target.value)}
              className="mt-2 min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm"
              placeholder="예: 2.x"
            />
          </div>
          <p className="text-xs text-store-muted">Payload Profile: {profile}</p>
          <button
            type="submit"
            disabled={!file || uploading}
            className="min-h-[44px] w-full rounded-xl bg-store-accent text-sm font-bold text-white disabled:opacity-60"
          >
            {uploading ? "업로드 중…" : "Payload 업로드"}
          </button>
        </form>
      ) : (
        <p className="text-sm text-store-muted">등록된 Payload가 없습니다.</p>
      )}
    </section>
  );
}
