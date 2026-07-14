"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import {
  adminDoclingImportFileDownloadUrl,
  fetchAdminDoclingImportApi,
  fetchAdminNormalizedDocumentApi,
  patchAdminDistributionMetadataApi,
} from "@/lib/admin-review-api";
import type {
  DoclingImportBundlePublicDto,
  PackCapabilitiesDto,
} from "@/lib/docling-import/docling-import-dto";
import { truncateSha256 } from "@/lib/docling-import/docling-import-ui";
import { resolveReviewProcessingEvidence } from "@/lib/review-evidence/review-processing-evidence-service";
import {
  ADMIN_REVIEW_PROCESSING_TAB_HINT,
  ADMIN_REVIEW_PROCESSING_TITLE,
} from "@/lib/role-based-ux-copy";

type DistForm = {
  sourceTitle: string;
  sourceUrl: string;
  sourcePublisherName: string;
  sourcePublisherUrl: string;
  sourceDocumentVersion: string;
  sourcePublishedAt: string;
  sourceRetrievedAt: string;
  licenseName: string;
  licenseUrl: string;
  usageTerms: string;
  readmeText: string;
  visibility: string;
  allowDownload: boolean;
  contentType: string;
};

function formFromDistribution(
  distribution: NonNullable<AdminReviewDetailDto["distribution"]> | null | undefined,
): DistForm {
  return {
    sourceTitle: distribution?.sourceTitle ?? "",
    sourceUrl: distribution?.sourceUrl ?? "",
    sourcePublisherName: distribution?.sourcePublisherName ?? "",
    sourcePublisherUrl: distribution?.sourcePublisherUrl ?? "",
    sourceDocumentVersion: distribution?.sourceDocumentVersion ?? "",
    sourcePublishedAt: distribution?.sourcePublishedAt?.slice(0, 10) ?? "",
    sourceRetrievedAt: distribution?.sourceRetrievedAt?.slice(0, 10) ?? "",
    licenseName: distribution?.licenseName ?? "",
    licenseUrl: distribution?.licenseUrl ?? "",
    usageTerms: distribution?.usageTerms ?? "",
    readmeText: distribution?.readmeText ?? "",
    visibility: distribution?.visibility ?? "PRIVATE",
    allowDownload: distribution?.allowDownload ?? true,
    contentType: distribution?.contentType ?? "",
  };
}

function buildChangedPatch(initial: DistForm, current: DistForm): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const nullableStringKeys = [
    "sourceTitle",
    "sourceUrl",
    "sourcePublisherName",
    "sourcePublisherUrl",
    "sourceDocumentVersion",
    "sourcePublishedAt",
    "sourceRetrievedAt",
    "licenseUrl",
    "usageTerms",
    "readmeText",
  ] as const;
  const enumKeys = ["contentType"] as const;

  for (const key of nullableStringKeys) {
    if (initial[key] !== current[key]) {
      const value = current[key].trim();
      patch[key] = value ? value : null;
    }
  }
  for (const key of enumKeys) {
    if (initial[key] !== current[key]) {
      patch[key] = current[key] ? current[key] : null;
    }
  }
  if (initial.licenseName !== current.licenseName) {
    patch.licenseName = current.licenseName;
  }
  if (initial.visibility !== current.visibility) {
    patch.visibility = current.visibility;
  }
  if (initial.allowDownload !== current.allowDownload) {
    patch.allowDownload = current.allowDownload;
  }
  return patch;
}

function CopyableId({ label, value }: { readonly label: string; readonly value: string }) {
  const short =
    value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
  return (
    <li className="flex flex-wrap items-center gap-2">
      <span>
        {label}: <span className="font-mono">{short}</span>
      </span>
      <button
        type="button"
        className="min-h-[32px] rounded-lg border border-store-border bg-white px-2 text-[11px] font-semibold"
        onClick={() => void navigator.clipboard.writeText(value)}
      >
        복사
      </button>
    </li>
  );
}

export function AdminReviewProcessingEvidenceTab({
  packId,
  detail,
  onDetailUpdated,
}: {
  readonly packId: string;
  readonly detail: AdminReviewDetailDto;
  readonly onDetailUpdated?: (detail: AdminReviewDetailDto) => void;
}) {
  const [bundle, setBundle] = useState<DoclingImportBundlePublicDto | null>(null);
  const [capabilities, setCapabilities] = useState<PackCapabilitiesDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingMeta, setSavingMeta] = useState(false);
  const [metaMessage, setMetaMessage] = useState<string | null>(null);
  const [showFullChecksums, setShowFullChecksums] = useState(false);

  const [initialForm, setInitialForm] = useState<DistForm>(() =>
    formFromDistribution(detail.distribution),
  );
  const [form, setForm] = useState<DistForm>(() => formFromDistribution(detail.distribution));

  useEffect(() => {
    const next = formFromDistribution(detail.distribution);
    setInitialForm(next);
    setForm(next);
  }, [detail.distribution]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [importRes, ndRes] = await Promise.all([
        fetchAdminDoclingImportApi(packId).catch(() => ({ bundle: null })),
        fetchAdminNormalizedDocumentApi(packId).catch(() => null),
      ]);
      setBundle(importRes.bundle);
      setCapabilities(ndRes?.capabilities ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "처리·검증 근거를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [packId]);

  useEffect(() => {
    void load();
  }, [load]);

  const evidence = useMemo(
    () =>
      resolveReviewProcessingEvidence({
        detail,
        bundle,
        capabilities,
      }),
    [detail, bundle, capabilities],
  );

  const artifactOptions = detail.artifactOptions;

  const onSaveMetadata = async (e: FormEvent) => {
    e.preventDefault();
    if (savingMeta || !form.licenseName.trim()) return;
    setSavingMeta(true);
    setMetaMessage(null);
    setError(null);
    try {
      const patch = buildChangedPatch(initialForm, form);
      if (Object.keys(patch).length === 0) {
        setMetaMessage("변경된 항목이 없습니다.");
        return;
      }
      const result = await patchAdminDistributionMetadataApi(packId, patch);
      setMetaMessage("유통 메타데이터를 저장했습니다.");
      if (result.distribution) {
        const nextForm = formFromDistribution(result.distribution);
        setInitialForm(nextForm);
        setForm(nextForm);
      }
      if (onDetailUpdated && result.distribution) {
        onDetailUpdated({
          ...detail,
          distribution: result.distribution,
          artifactOptions: result.artifactOptions ?? detail.artifactOptions,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "메타데이터 저장에 실패했습니다.");
    } finally {
      setSavingMeta(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-store-muted">처리·검증 근거 불러오는 중…</p>;
  }

  return (
    <section className="space-y-4 rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <div>
        <h2 className="text-sm font-bold text-slate-900">{ADMIN_REVIEW_PROCESSING_TITLE}</h2>
        <p className="mt-1 text-xs text-store-muted">{ADMIN_REVIEW_PROCESSING_TAB_HINT}</p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="rounded-xl border border-store-border bg-slate-50 p-3 text-xs text-slate-800">
        <p className="font-semibold text-slate-900">생성 도구</p>
        <ul className="mt-2 space-y-1">
          <li>생성 도구: {evidence.generator?.name ?? "미확인"}</li>
          <li>도구 버전: {evidence.generator?.version ?? "미확인"}</li>
          <li>
            Adapter: {evidence.adapter?.type ?? "—"} {evidence.adapter?.version ?? ""}
          </li>
          <li>
            Schema: {evidence.schema?.name ?? "—"}{" "}
            {evidence.schema?.version ? `v${evidence.schema.version}` : ""}
          </li>
        </ul>
      </div>

      <div className="rounded-xl border border-store-border bg-slate-50 p-3 text-xs text-slate-800">
        <p className="font-semibold text-slate-900">파일 검증·무결성</p>
        <ul className="mt-2 space-y-1">
          <li>파일 개수: {evidence.files.length}</li>
          <li>
            검증 상태: {evidence.validation.status} · 경고 {evidence.validation.warningCount} ·
            오류 {evidence.validation.errorCount}
          </li>
          {evidence.validation.originMatchSummary ? (
            <li>Origin 일치: {evidence.validation.originMatchSummary}</li>
          ) : null}
          {evidence.validation.validatorVersion ||
          evidence.validation.markdownCoverage != null ||
          evidence.validation.jaccard != null ||
          evidence.validation.samplePassCount != null ? (
            <li>
              Markdown 유사도
              {evidence.validation.validatorVersion
                ? ` · validator ${evidence.validation.validatorVersion}`
                : ""}
              {evidence.validation.markdownCoverage != null
                ? ` · coverage ${(evidence.validation.markdownCoverage * 100).toFixed(1)}%`
                : ""}
              {evidence.validation.jaccard != null
                ? ` · jaccard ${evidence.validation.jaccard.toFixed(3)}`
                : ""}
              {evidence.validation.samplePassCount != null
                ? ` · sample pass ${evidence.validation.samplePassCount}`
                : ""}
            </li>
          ) : null}
        </ul>
        {evidence.files.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {evidence.files.map((file) => (
              <li key={file.id} className="rounded-lg bg-white px-2 py-2">
                <p className="font-semibold">
                  {file.roleLabel} · {file.originalFileName}
                </p>
                <p className="mt-1 text-store-muted">
                  SHA-256 {truncateSha256(file.checksumSha256)}
                </p>
                {showFullChecksums ? (
                  <p className="mt-1 break-all font-mono text-[11px]">{file.checksumSha256}</p>
                ) : null}
                <div className="mt-1 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="min-h-[32px] rounded-lg border border-store-border px-2 text-[11px] font-semibold"
                    onClick={() => void navigator.clipboard.writeText(file.checksumSha256)}
                  >
                    복사
                  </button>
                  {file.downloadable && evidence.packageMode === "EXTERNAL_IMPORT" ? (
                    <a
                      href={adminDoclingImportFileDownloadUrl(packId, file.id)}
                      className="inline-flex min-h-[32px] items-center rounded-lg border border-store-border px-2 text-[11px] font-semibold"
                    >
                      다운로드
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        {evidence.files.length > 0 ? (
          <button
            type="button"
            className="mt-2 text-[11px] font-semibold text-store-accent"
            onClick={() => setShowFullChecksums((v) => !v)}
          >
            {showFullChecksums ? "체크섬 짧게 보기" : "전체 체크섬 보기"}
          </button>
        ) : null}
      </div>

      <div className="rounded-xl border border-store-border bg-slate-50 p-3 text-xs text-slate-800">
        <p className="font-semibold text-slate-900">서비스 Capability</p>
        <ul className="mt-2 space-y-1">
          <li>다운로드: {evidence.capabilities.download.status}</li>
          <li>NormalizedDocument: {evidence.capabilities.normalizedDocument.status}</li>
          <li>Retrieval: {evidence.capabilities.retrieval.status}</li>
          <li>Context API: {evidence.capabilities.context.status}</li>
          <li>Export: {evidence.capabilities.export.status}</li>
          <li>MCP: {evidence.capabilities.mcp.status}</li>
        </ul>
      </div>

      {artifactOptions ? (
        <div className="rounded-xl border border-store-border bg-slate-50 p-3 text-xs text-slate-800">
          <p className="font-semibold text-slate-900">공개 Artifact 준비 상태</p>
          <ul className="mt-2 space-y-1">
            <li>
              원본문서(Docling):{" "}
              {artifactOptions.externalImportReady ? "Ready" : "Not ready"}
            </li>
            <li>공개 다운로드: 원본문서만 제공</li>
          </ul>
        </div>
      ) : null}

      {evidence.processingLogs.length > 0 ? (
        <div className="rounded-xl border border-store-border bg-slate-50 p-3 text-xs text-slate-800">
          <p className="font-semibold text-slate-900">처리 로그</p>
          <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto">
            {evidence.processingLogs.map((log) => (
              <li key={log.id} className="rounded-lg bg-white px-2 py-2">
                <p className="font-semibold">
                  {log.stage} · {log.status}
                </p>
                <p className="mt-1 text-store-muted">
                  {log.message ?? "—"} · {log.startedAt.replace("T", " ").slice(0, 19)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <details className="rounded-xl border border-store-border bg-white p-3 text-xs">
        <summary className="cursor-pointer font-semibold text-slate-900">고급 ID</summary>
        <ul className="mt-2 space-y-2">
          {evidence.technicalIds.bundleId ? (
            <CopyableId label="Bundle" value={evidence.technicalIds.bundleId} />
          ) : null}
          {evidence.technicalIds.normalizedDocumentId ? (
            <CopyableId
              label="NormalizedDocument"
              value={evidence.technicalIds.normalizedDocumentId}
            />
          ) : null}
        </ul>
      </details>

      <form
        onSubmit={(e) => void onSaveMetadata(e)}
        className="space-y-3 rounded-xl border border-amber-100 bg-amber-50/50 p-3"
      >
        <p className="text-xs font-semibold text-amber-950">Store 유통 메타데이터 보정</p>
        <p className="text-[11px] text-amber-900">
          변경된 필드만 저장합니다. 누락된 값은 기존 Provider 입력을 보존합니다.
        </p>
        <label className="block text-xs font-semibold text-slate-700">
          원천 문서 제목
          <input
            value={form.sourceTitle}
            onChange={(e) => setForm((f) => ({ ...f, sourceTitle: e.target.value }))}
            className="mt-1 min-h-[44px] w-full rounded-xl border border-store-border bg-white px-3 text-sm font-normal"
          />
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          원문 게시 URL
          <input
            value={form.sourceUrl}
            onChange={(e) => setForm((f) => ({ ...f, sourceUrl: e.target.value }))}
            className="mt-1 min-h-[44px] w-full rounded-xl border border-store-border bg-white px-3 text-sm font-normal"
          />
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          발행기관명
          <input
            value={form.sourcePublisherName}
            onChange={(e) => setForm((f) => ({ ...f, sourcePublisherName: e.target.value }))}
            className="mt-1 min-h-[44px] w-full rounded-xl border border-store-border bg-white px-3 text-sm font-normal"
          />
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          발행기관 URL
          <input
            value={form.sourcePublisherUrl}
            onChange={(e) => setForm((f) => ({ ...f, sourcePublisherUrl: e.target.value }))}
            className="mt-1 min-h-[44px] w-full rounded-xl border border-store-border bg-white px-3 text-sm font-normal"
          />
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          문서 버전
          <input
            value={form.sourceDocumentVersion}
            onChange={(e) => setForm((f) => ({ ...f, sourceDocumentVersion: e.target.value }))}
            className="mt-1 min-h-[44px] w-full rounded-xl border border-store-border bg-white px-3 text-sm font-normal"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-semibold text-slate-700">
            게시일
            <input
              type="date"
              value={form.sourcePublishedAt}
              onChange={(e) => setForm((f) => ({ ...f, sourcePublishedAt: e.target.value }))}
              className="mt-1 min-h-[44px] w-full rounded-xl border border-store-border bg-white px-3 text-sm font-normal"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            수집일
            <input
              type="date"
              value={form.sourceRetrievedAt}
              onChange={(e) => setForm((f) => ({ ...f, sourceRetrievedAt: e.target.value }))}
              className="mt-1 min-h-[44px] w-full rounded-xl border border-store-border bg-white px-3 text-sm font-normal"
            />
          </label>
        </div>
        <label className="block text-xs font-semibold text-slate-700">
          라이선스명
          <input
            value={form.licenseName}
            onChange={(e) => setForm((f) => ({ ...f, licenseName: e.target.value }))}
            required
            className="mt-1 min-h-[44px] w-full rounded-xl border border-store-border bg-white px-3 text-sm font-normal"
          />
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          라이선스 URL
          <input
            value={form.licenseUrl}
            onChange={(e) => setForm((f) => ({ ...f, licenseUrl: e.target.value }))}
            className="mt-1 min-h-[44px] w-full rounded-xl border border-store-border bg-white px-3 text-sm font-normal"
          />
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          이용조건
          <textarea
            value={form.usageTerms}
            onChange={(e) => setForm((f) => ({ ...f, usageTerms: e.target.value }))}
            rows={3}
            className="mt-1 w-full rounded-xl border border-store-border bg-white px-3 py-2 text-sm font-normal"
          />
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          README / 사용방법
          <textarea
            value={form.readmeText}
            onChange={(e) => setForm((f) => ({ ...f, readmeText: e.target.value }))}
            rows={3}
            className="mt-1 w-full rounded-xl border border-store-border bg-white px-3 py-2 text-sm font-normal"
          />
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          공개 범위
          <select
            value={form.visibility}
            onChange={(e) => setForm((f) => ({ ...f, visibility: e.target.value }))}
            className="mt-1 min-h-[44px] w-full rounded-xl border border-store-border bg-white px-3 text-sm font-normal"
          >
            <option value="PRIVATE">PRIVATE — 비공개</option>
            <option value="PUBLIC">PUBLIC — 카탈로그 노출</option>
            <option value="UNLISTED">UNLISTED — 직접 링크</option>
          </select>
        </label>
        <label className="flex min-h-[44px] items-center gap-2 text-sm text-slate-800">
          <input
            type="checkbox"
            checked={form.allowDownload}
            onChange={(e) => setForm((f) => ({ ...f, allowDownload: e.target.checked }))}
          />
          다운로드 허용
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          콘텐츠 유형
          <select
            value={form.contentType}
            onChange={(e) => setForm((f) => ({ ...f, contentType: e.target.value }))}
            className="mt-1 min-h-[44px] w-full rounded-xl border border-store-border bg-white px-3 text-sm font-normal"
          >
            <option value="">자동 추론</option>
            <option value="DOCUMENT">문서형</option>
            <option value="PRODUCT">제품형</option>
            <option value="API">API형</option>
            <option value="FRAMEWORK">프레임워크형</option>
            <option value="DATA">데이터형</option>
            <option value="MIXED">혼합형</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={savingMeta || !form.licenseName.trim()}
          className="min-h-[44px] w-full rounded-xl bg-store-accent text-sm font-bold text-white disabled:opacity-60"
        >
          {savingMeta ? "저장 중…" : "메타데이터 저장"}
        </button>
        {metaMessage ? <p className="text-xs text-emerald-800">{metaMessage}</p> : null}
      </form>
    </section>
  );
}

/** @deprecated Use AdminReviewProcessingEvidenceTab */
export { AdminReviewProcessingEvidenceTab as AdminReviewDoclingImportTab };
