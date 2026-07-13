"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { NormalizedDocumentPreview } from "@/components/docling/NormalizedDocumentPreview";
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
import {
  DOCLING_FILE_ROLE_LABELS,
  extractOriginMatchSummary,
  formatBytes,
  truncateSha256,
} from "@/lib/docling-import/docling-import-ui";
import { isDoclingBundleReviewSnapshot } from "@/lib/provider-review-submit-snapshot";

export function AdminReviewDoclingImportTab({
  packId,
  detail,
  onDetailUpdated,
}: {
  readonly packId: string;
  readonly detail: AdminReviewDetailDto;
  readonly onDetailUpdated?: (detail: AdminReviewDetailDto) => void;
}) {
  const [bundle, setBundle] = useState<DoclingImportBundlePublicDto | null>(null);
  const [structure, setStructure] = useState<unknown>(null);
  const [capabilities, setCapabilities] = useState<PackCapabilitiesDto | null>(null);
  const [markdownText, setMarkdownText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingMeta, setSavingMeta] = useState(false);
  const [metaMessage, setMetaMessage] = useState<string | null>(null);

  const [licenseName, setLicenseName] = useState(detail.distribution?.licenseName ?? "");
  const [sourceTitle, setSourceTitle] = useState(detail.distribution?.sourceTitle ?? "");
  const [sourceUrl, setSourceUrl] = useState(detail.distribution?.sourceUrl ?? "");
  const [visibility, setVisibility] = useState(detail.distribution?.visibility ?? "PRIVATE");

  const snapshot = detail.latestReview?.submitSnapshot ?? null;
  const isDoclingSnapshot = isDoclingBundleReviewSnapshot(snapshot);

  const loadMarkdown = useCallback(
    async (nextBundle: DoclingImportBundlePublicDto | null) => {
      const md = nextBundle?.files.find((f) => f.role === "DOCLING_MARKDOWN");
      if (!md) {
        setMarkdownText(null);
        return;
      }
      try {
        const response = await fetch(adminDoclingImportFileDownloadUrl(packId, md.id), {
          credentials: "include",
        });
        if (!response.ok) {
          setMarkdownText(null);
          return;
        }
        setMarkdownText(await response.text());
      } catch {
        setMarkdownText(null);
      }
    },
    [packId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [importRes, ndRes] = await Promise.all([
        fetchAdminDoclingImportApi(packId),
        fetchAdminNormalizedDocumentApi(packId).catch(() => null),
      ]);
      setBundle(importRes.bundle);
      setStructure(ndRes?.structure ?? null);
      setCapabilities(ndRes?.capabilities ?? null);
      await loadMarkdown(importRes.bundle);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Docling import를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [packId, loadMarkdown]);

  useEffect(() => {
    void load();
  }, [load]);

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
    return <p className="text-sm text-store-muted">Docling 근거 불러오는 중…</p>;
  }

  if (!bundle && !isDoclingSnapshot) {
    return (
      <section className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <h2 className="text-sm font-bold text-slate-900">Docling Import</h2>
        <p className="mt-2 text-xs text-store-muted">Docling 3파일 import 근거가 없습니다.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <div>
        <h2 className="text-sm font-bold text-slate-900">Docling Import</h2>
        <p className="mt-1 text-xs text-store-muted">
          Provider가 제출한 원본 3파일과 NormalizedDocument입니다. Payload는 읽기 전용입니다.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {isDoclingSnapshot && snapshot && snapshot.mode === "DOCLING_BUNDLE" ? (
        <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-xs text-slate-800">
          <p className="font-semibold text-blue-950">제출 스냅샷 (DOCLING_BUNDLE)</p>
          <ul className="mt-2 space-y-1">
            <li>Bundle: {snapshot.doclingBundleId}</li>
            <li>Schema: {snapshot.doclingSchemaVersion ?? "—"}</li>
            <li>Adapter: {snapshot.adapterVersion}</li>
            <li>NormalizedDocument: {snapshot.normalizedDocumentId}</li>
            <li>경고 수: {snapshot.warningCount}</li>
          </ul>
        </div>
      ) : null}

      {detail.doclingReviewIntegrity ? (
        <div
          className={`rounded-xl border p-3 text-xs ${
            detail.doclingReviewIntegrity.status === "PASS"
              ? "border-emerald-200 bg-emerald-50 text-emerald-950"
              : detail.doclingReviewIntegrity.status === "BLOCKED"
                ? "border-red-200 bg-red-50 text-red-900"
                : "border-slate-200 bg-slate-50 text-slate-800"
          }`}
        >
          <p className="font-semibold">
            검수 무결성: {detail.doclingReviewIntegrity.status}
          </p>
          <ul className="mt-2 space-y-1">
            <li>원본 3파일 무결성</li>
            <li>NormalizedDocument 무결성</li>
            <li>Snapshot 일치</li>
            <li>Adapter Version 일치</li>
            <li>Object Storage 확인</li>
          </ul>
          {detail.doclingReviewIntegrity.errors.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {detail.doclingReviewIntegrity.errors.map((issue) => (
                <li key={issue.code}>{issue.message}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {bundle ? (
        <div className="space-y-3 text-xs text-slate-800">
          <p>
            상태: <span className="font-bold">{bundle.status}</span> · Schema{" "}
            {bundle.doclingSchemaName ?? "—"} {bundle.doclingSchemaVersion ?? ""}
          </p>
          <p>
            Adapter: {bundle.adapterType} {bundle.adapterVersion} · Origin:{" "}
            {extractOriginMatchSummary(bundle.validationReport)}
          </p>
          <p>
            경고 {bundle.warningCount} · 오류 {bundle.errorCount}
            {bundle.lastErrorMessage ? ` · ${bundle.lastErrorMessage}` : ""}
          </p>
          {capabilities ? (
            <div className="rounded-xl border border-store-border bg-slate-50 p-3">
              <p className="font-semibold text-slate-900">Capabilities</p>
              <ul className="mt-1 space-y-1">
                <li>
                  normalizedDocument: {capabilities.normalizedDocument.supported ? "supported" : "no"} /{" "}
                  {capabilities.normalizedDocument.status}
                </li>
                <li>
                  retrieval: {capabilities.retrieval.supported ? "supported" : "no"} /{" "}
                  {capabilities.retrieval.status}
                </li>
                <li>
                  mcp: {capabilities.mcp.supported ? "supported" : "no"} / {capabilities.mcp.status}
                </li>
              </ul>
            </div>
          ) : null}
          <ul className="space-y-2">
            {bundle.files.map((file) => (
              <li key={file.id} className="rounded-xl border border-store-border bg-slate-50 px-3 py-2">
                <p className="font-semibold">
                  {DOCLING_FILE_ROLE_LABELS[file.role]} · {file.originalFileName}
                </p>
                <p className="mt-1 text-store-muted">
                  {formatBytes(file.fileSize)} · {file.mimeType} · SHA-256{" "}
                  {truncateSha256(file.checksumSha256)}
                </p>
                <p className="mt-1 break-all text-[11px] text-store-muted">{file.checksumSha256}</p>
                <a
                  href={adminDoclingImportFileDownloadUrl(packId, file.id)}
                  className="mt-2 inline-flex min-h-[44px] items-center text-xs font-semibold text-store-accent"
                >
                  다운로드
                </a>
              </li>
            ))}
          </ul>
          <NormalizedDocumentPreview
            document={bundle.normalizedDocument}
            structure={structure}
            markdownText={markdownText}
            processingLogs={bundle.processingLogs}
          />
        </div>
      ) : null}

      <form
        onSubmit={(e) => void onSaveMetadata(e)}
        className="space-y-3 rounded-xl border border-amber-100 bg-amber-50/50 p-3"
      >
        <p className="text-xs font-semibold text-amber-950">Store 유통 메타데이터 보정</p>
        <p className="text-[11px] text-amber-900">
          Provider 제출 메타데이터를 확인·보정할 수 있습니다. Payload 원본은 변경되지 않습니다.
        </p>
        <input
          value={sourceTitle}
          onChange={(e) => setSourceTitle(e.target.value)}
          placeholder="출처 제목"
          className="min-h-[44px] w-full rounded-xl border border-store-border bg-white px-3 text-sm"
        />
        <input
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          placeholder="출처 URL"
          className="min-h-[44px] w-full rounded-xl border border-store-border bg-white px-3 text-sm"
        />
        <input
          value={licenseName}
          onChange={(e) => setLicenseName(e.target.value)}
          placeholder="라이선스 (필수)"
          required
          className="min-h-[44px] w-full rounded-xl border border-store-border bg-white px-3 text-sm"
        />
        <select
          value={visibility}
          onChange={(e) => setVisibility(e.target.value)}
          className="min-h-[44px] w-full rounded-xl border border-store-border bg-white px-3 text-sm"
        >
          <option value="PRIVATE">PRIVATE</option>
          <option value="PUBLIC">PUBLIC</option>
          <option value="UNLISTED">UNLISTED</option>
        </select>
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
