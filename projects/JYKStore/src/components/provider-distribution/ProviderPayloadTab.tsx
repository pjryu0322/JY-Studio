"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ProviderDoclingImportTab } from "@/components/provider-distribution/ProviderDoclingImportTab";
import type { KnowledgePayloadPublicDto } from "@/lib/distribution/payload-service";
import type { DoclingImportBundlePublicDto } from "@/lib/docling-import/docling-import-dto";
import type { ProviderPackDetailDto } from "@/lib/provider-pack-dto";
import {
  createProviderPackVersionApi,
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
  packStatus,
  latestReviewStatus,
  onGoToDistributionTab,
  onGoToReviewTab,
  onPayloadChanged,
  onDoclingChanged,
  onPackUpdated,
}: {
  readonly packId: string;
  readonly editable: boolean;
  readonly packStatus?: string;
  readonly latestReviewStatus?: string | null;
  readonly onGoToDistributionTab: () => void;
  readonly onGoToReviewTab: () => void;
  readonly onPayloadChanged?: (payload: KnowledgePayloadPublicDto | null) => void;
  readonly onDoclingChanged?: (bundle: DoclingImportBundlePublicDto | null) => void;
  readonly onPackUpdated?: (pack: ProviderPackDetailDto) => void;
}) {
  const [payload, setPayload] = useState<KnowledgePayloadPublicDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [creatingVersion, setCreatingVersion] = useState(false);
  const [showVersionForm, setShowVersionForm] = useState(false);
  const [legacyOpen, setLegacyOpen] = useState(false);
  const [newVersion, setNewVersion] = useState("");
  const [versionOverview, setVersionOverview] = useState("");
  const [versionSummary, setVersionSummary] = useState("");
  const [versionHint, setVersionHint] = useState<string | null>(null);
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
      if (data.payload) setLegacyOpen(true);
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
      setVersionHint(null);
      setLegacyOpen(true);
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

  const onCreateVersion = async (e: FormEvent) => {
    e.preventDefault();
    if (!editable || creatingVersion) return;
    const version = newVersion.trim();
    if (!version) {
      setError("새 버전 번호가 필요합니다.");
      return;
    }
    setCreatingVersion(true);
    setError(null);
    try {
      const result = await createProviderPackVersionApi(packId, {
        version,
        overview: versionOverview.trim() || undefined,
        versionSummary: versionSummary.trim() || undefined,
      });
      onPackUpdated?.(result.pack);
      setPayload(null);
      onPayloadChanged?.(null);
      onDoclingChanged?.(null);
      setShowVersionForm(false);
      setNewVersion("");
      setVersionOverview("");
      setVersionSummary("");
      setVersionHint("새 버전에 Payload를 등록하세요.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "버전 생성에 실패했습니다.");
    } finally {
      setCreatingVersion(false);
    }
  };

  const report =
    payload?.validationReport && typeof payload.validationReport === "object"
      ? (payload.validationReport as Record<string, unknown>)
      : null;

  const showNewVersionCta =
    editable &&
    packStatus === "DRAFT" &&
    (payload?.canDelete === false || latestReviewStatus === "REJECTED");

  return (
    <div id="pack-payload" className="space-y-4">
      <section className="space-y-4 rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <ProviderDoclingImportTab
          packId={packId}
          editable={editable}
          onGoToDistributionTab={onGoToDistributionTab}
          onGoToReviewTab={onGoToReviewTab}
          onDoclingChanged={onDoclingChanged}
        />
      </section>

      <section className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <button
          type="button"
          onClick={() => setLegacyOpen((open) => !open)}
          className="flex min-h-[44px] w-full items-center justify-between gap-2 text-left"
          aria-expanded={legacyOpen}
        >
          <div>
            <h2 className="text-sm font-bold text-slate-900">레거시 ZIP Payload</h2>
            <p className="mt-1 text-xs text-store-muted">
              기존 ZIP 업로드 경로입니다. Docling 3파일 Import를 우선 사용하세요.
            </p>
          </div>
          <span className="text-xs font-semibold text-store-accent">
            {legacyOpen ? "접기" : "펼치기"}
          </span>
        </button>

        {legacyOpen ? (
          <div className="mt-4 space-y-4 border-t border-store-border pt-4">
            {loading ? (
              <p className="text-sm text-store-muted">Payload 불러오는 중…</p>
            ) : (
              <>
                {error ? (
                  <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">
                    {error}
                  </div>
                ) : null}
                {versionHint ? (
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                    {versionHint}
                  </div>
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
                    {typeof report?.entrypoint === "string" ? (
                      <p>entrypoint: {report.entrypoint}</p>
                    ) : null}
                    {typeof report?.recordCount === "number" ? (
                      <p>recordCount: {report.recordCount}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <a
                        href={`/api/v1/provider/packs/${encodeURIComponent(packId)}/payload/download`}
                        className="inline-flex min-h-[44px] items-center rounded-xl border border-store-border bg-white px-3 text-xs font-semibold text-store-accent"
                      >
                        원본 다운로드
                      </a>
                      {editable && payload.canDelete ? (
                        <button
                          type="button"
                          onClick={() => void onDelete()}
                          disabled={deleting}
                          className="min-h-[44px] rounded-xl border border-red-200 px-3 text-xs font-semibold text-red-700 disabled:opacity-60"
                        >
                          {deleting ? "삭제 중…" : "삭제 후 재등록"}
                        </button>
                      ) : null}
                      {editable && payload && !payload.canDelete ? (
                        <p className="w-full text-xs text-amber-900">
                          검수 이력 보존을 위해 이 Payload는 삭제할 수 없습니다. 새 버전을 생성해
                          보완하세요.
                        </p>
                      ) : null}
                      <button
                        type="button"
                        onClick={onGoToDistributionTab}
                        className="min-h-[44px] rounded-xl bg-store-accent px-3 text-xs font-bold text-white"
                      >
                        {PROVIDER_PACK_GO_TO_DISTRIBUTION_TAB}
                      </button>
                      {payload.validationStatus === "VALID" ? (
                        <button
                          type="button"
                          onClick={onGoToReviewTab}
                          className="min-h-[44px] rounded-xl border border-store-border px-3 text-xs font-semibold text-slate-800"
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
                        className="mt-2 block min-h-[44px] w-full text-sm"
                        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                        required
                      />
                    </div>
                    <div>
                      <label
                        className="text-xs font-semibold text-slate-700"
                        htmlFor="payload-generator"
                      >
                        생성기
                      </label>
                      <select
                        id="payload-generator"
                        value={generatorType}
                        onChange={(e) =>
                          setGeneratorType(e.target.value as "DOCLING" | "UNSTRUCTURED")
                        }
                        className="mt-2 min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm"
                      >
                        <option value="DOCLING">Docling</option>
                        <option value="UNSTRUCTURED">Unstructured</option>
                      </select>
                    </div>
                    <div>
                      <label
                        className="text-xs font-semibold text-slate-700"
                        htmlFor="payload-gen-version"
                      >
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
                  <p className="text-sm text-store-muted">등록된 ZIP Payload가 없습니다.</p>
                )}

                {showNewVersionCta ? (
                  <div className="space-y-3 rounded-xl border border-amber-100 bg-amber-50/70 p-3">
                    {!showVersionForm ? (
                      <button
                        type="button"
                        onClick={() => setShowVersionForm(true)}
                        className="min-h-[44px] rounded-xl border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-950"
                      >
                        보완용 새 버전 생성
                      </button>
                    ) : (
                      <form onSubmit={(e) => void onCreateVersion(e)} className="space-y-2">
                        <p className="text-xs font-semibold text-amber-950">보완용 새 버전 생성</p>
                        <input
                          value={newVersion}
                          onChange={(e) => setNewVersion(e.target.value)}
                          placeholder="새 버전 번호 (필수)"
                          className="min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm"
                          required
                        />
                        <input
                          value={versionOverview}
                          onChange={(e) => setVersionOverview(e.target.value)}
                          placeholder="버전 개요 (선택)"
                          className="min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm"
                        />
                        <input
                          value={versionSummary}
                          onChange={(e) => setVersionSummary(e.target.value)}
                          placeholder="버전 요약 (선택)"
                          className="min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="submit"
                            disabled={creatingVersion}
                            className="min-h-[44px] rounded-xl bg-store-accent px-3 text-xs font-bold text-white disabled:opacity-60"
                          >
                            {creatingVersion ? "생성 중…" : "버전 생성"}
                          </button>
                          <button
                            type="button"
                            disabled={creatingVersion}
                            onClick={() => setShowVersionForm(false)}
                            className="min-h-[44px] rounded-xl border border-store-border px-3 text-xs font-semibold text-slate-700"
                          >
                            취소
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}
