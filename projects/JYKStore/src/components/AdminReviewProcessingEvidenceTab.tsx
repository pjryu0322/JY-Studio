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

  const [licenseName, setLicenseName] = useState(detail.distribution?.licenseName ?? "");
  const [sourceTitle, setSourceTitle] = useState(detail.distribution?.sourceTitle ?? "");
  const [sourceUrl, setSourceUrl] = useState(detail.distribution?.sourceUrl ?? "");
  const [visibility, setVisibility] = useState(detail.distribution?.visibility ?? "PRIVATE");

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

  const onSaveMetadata = async (e: FormEvent) => {
    e.preventDefault();
    if (savingMeta || !licenseName.trim()) return;
    setSavingMeta(true);
    setMetaMessage(null);
    setError(null);
    try {
      const result = await patchAdminDistributionMetadataApi(packId, {
        licenseName: licenseName.trim(),
        sourceTitle: sourceTitle.trim() || null,
        sourceUrl: sourceUrl.trim() || null,
        visibility,
        allowDownload: detail.distribution?.allowDownload ?? true,
        licenseUrl: detail.distribution?.licenseUrl ?? null,
        usageTerms: detail.distribution?.usageTerms ?? null,
        readmeText: detail.distribution?.readmeText ?? null,
      });
      setMetaMessage("유통 메타데이터를 저장했습니다.");
      if (onDetailUpdated && result.distribution) {
        onDetailUpdated({
          ...detail,
          distribution: {
            sourceTitle: result.distribution.sourceTitle,
            sourceUrl: result.distribution.sourceUrl,
            licenseName: result.distribution.licenseName,
            licenseUrl: result.distribution.licenseUrl,
            usageTerms: result.distribution.usageTerms,
            readmeText: result.distribution.readmeText,
            visibility: result.distribution.visibility,
            allowDownload: result.distribution.allowDownload,
          },
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
        <p className="font-semibold text-slate-900">파일 검증</p>
        <ul className="mt-2 space-y-1">
          <li>파일 개수: {evidence.files.length}</li>
          <li>
            검증 상태: {evidence.validation.status} · 경고 {evidence.validation.warningCount} ·
            오류 {evidence.validation.errorCount}
          </li>
          {evidence.validation.originMatchSummary ? (
            <li>Origin 일치: {evidence.validation.originMatchSummary}</li>
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
                      className="inline-flex min-h-[32px] items-center text-[11px] font-semibold text-store-accent"
                    >
                      다운로드
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        <button
          type="button"
          className="mt-2 min-h-[32px] text-[11px] font-semibold text-store-accent"
          onClick={() => setShowFullChecksums((v) => !v)}
        >
          {showFullChecksums ? "Checksum 축약 보기" : "Checksum 전체 보기"}
        </button>
      </div>

      <div className="rounded-xl border border-store-border bg-slate-50 p-3 text-xs text-slate-800">
        <p className="font-semibold text-slate-900">정규화</p>
        <ul className="mt-2 space-y-1">
          <li>상태: {evidence.normalization.status}</li>
          <li>언어: {evidence.normalization.language ?? "미확인"}</li>
          <li>
            Fingerprint:{" "}
            {evidence.normalization.fingerprint
              ? truncateSha256(evidence.normalization.fingerprint)
              : "—"}
          </li>
        </ul>
      </div>

      <div
        className={`rounded-xl border p-3 text-xs ${
          evidence.integrity.status === "PASS"
            ? "border-emerald-200 bg-emerald-50 text-emerald-950"
            : evidence.integrity.status === "BLOCKED"
              ? "border-red-200 bg-red-50 text-red-900"
              : "border-slate-200 bg-slate-50 text-slate-800"
        }`}
      >
        <p className="font-semibold">무결성: {evidence.integrity.status}</p>
        {evidence.integrity.messages.length > 0 ? (
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {evidence.integrity.messages.map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
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
        <label className="block text-xs font-semibold text-slate-700">
          출처명
          <input
            value={sourceTitle}
            onChange={(e) => setSourceTitle(e.target.value)}
            className="mt-1 min-h-[44px] w-full rounded-xl border border-store-border bg-white px-3 text-sm font-normal"
          />
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          출처 URL
          <input
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            className="mt-1 min-h-[44px] w-full rounded-xl border border-store-border bg-white px-3 text-sm font-normal"
          />
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          라이선스명
          <input
            value={licenseName}
            onChange={(e) => setLicenseName(e.target.value)}
            required
            className="mt-1 min-h-[44px] w-full rounded-xl border border-store-border bg-white px-3 text-sm font-normal"
          />
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          공개 범위
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
            className="mt-1 min-h-[44px] w-full rounded-xl border border-store-border bg-white px-3 text-sm font-normal"
          >
            <option value="PRIVATE">PRIVATE — 비공개</option>
            <option value="PUBLIC">PUBLIC — 카탈로그 노출</option>
            <option value="UNLISTED">UNLISTED — 직접 링크</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={savingMeta || !licenseName.trim()}
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
