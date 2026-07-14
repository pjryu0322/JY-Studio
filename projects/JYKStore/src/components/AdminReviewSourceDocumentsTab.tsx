"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminReviewSourceDocuments } from "@/components/AdminReviewSourceDocuments";
import { NormalizedDocumentPreview } from "@/components/docling/NormalizedDocumentPreview";
import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import {
  adminDoclingImportFileDownloadUrl,
  fetchAdminDoclingImportApi,
  fetchAdminNormalizedDocumentApi,
} from "@/lib/admin-review-api";
import type { DoclingImportBundlePublicDto } from "@/lib/docling-import/docling-import-dto";
import {
  DOCLING_FILE_ROLE_LABELS,
  formatBytes,
  truncateSha256,
} from "@/lib/docling-import/docling-import-ui";
import { hasDoclingReviewEvidence } from "@/lib/admin-review-tabs";
import {
  ADMIN_REVIEW_DOCUMENTS_EMPTY,
  ADMIN_REVIEW_DOCUMENTS_TAB_HINT,
  ADMIN_REVIEW_SOURCE_DOCS_TITLE,
} from "@/lib/role-based-ux-copy";

export function AdminReviewSourceDocumentsTab({
  packId,
  detail,
}: {
  readonly packId?: string;
  readonly detail: AdminReviewDetailDto;
  readonly onUpdated?: (detail: AdminReviewDetailDto) => void;
}) {
  const isDocling = hasDoclingReviewEvidence(detail);
  const hasLegacySources = detail.versions.some((v) => v.sourceDocuments.length > 0);
  const hasPayload = Boolean(detail.payload);

  const [bundle, setBundle] = useState<DoclingImportBundlePublicDto | null>(null);
  const [structure, setStructure] = useState<unknown>(null);
  const [markdownText, setMarkdownText] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(packId && isDocling));

  const loadImportDocs = useCallback(async () => {
    if (!packId || !isDocling) return;
    setLoading(true);
    try {
      const [importRes, ndRes] = await Promise.all([
        fetchAdminDoclingImportApi(packId),
        fetchAdminNormalizedDocumentApi(packId).catch(() => null),
      ]);
      setBundle(importRes.bundle);
      setStructure(ndRes?.structure ?? null);
      const md = importRes.bundle?.files.find((f) => f.role === "DOCLING_MARKDOWN");
      if (md) {
        const response = await fetch(
          adminDoclingImportFileDownloadUrl(packId, md.id, { preview: true, maxBytes: 100_000 }),
          {
          credentials: "include",
        },
        );
        setMarkdownText(response.ok ? await response.text() : null);
      } else {
        setMarkdownText(null);
      }
    } catch {
      setBundle(null);
    } finally {
      setLoading(false);
    }
  }, [packId, isDocling]);

  useEffect(() => {
    void loadImportDocs();
  }, [loadImportDocs]);

  const empty =
    !hasLegacySources &&
    !hasPayload &&
    !(bundle && bundle.files.length > 0) &&
    !loading;

  return (
    <section className="space-y-3">
      <div className="px-1">
        <h2 className="text-sm font-bold text-slate-900">{ADMIN_REVIEW_SOURCE_DOCS_TITLE}</h2>
        <p className="mt-1 text-xs text-store-muted">{ADMIN_REVIEW_DOCUMENTS_TAB_HINT}</p>
      </div>

      {loading ? <p className="text-sm text-store-muted">문서 불러오는 중…</p> : null}

      {hasLegacySources ? <AdminReviewSourceDocuments versions={detail.versions} /> : null}

      {hasPayload && detail.payload ? (
        <div className="rounded-2xl border border-store-border bg-white p-4 text-xs shadow-card">
          <p className="font-semibold text-slate-900">Payload ZIP</p>
          <ul className="mt-2 space-y-1 text-slate-800">
            <li>파일명: {detail.payload.originalFileName}</li>
            <li>크기: {formatBytes(detail.payload.fileSize)}</li>
            <li>Checksum: {truncateSha256(detail.payload.checksumSha256)}</li>
            <li>검증: {detail.payload.validationStatus}</li>
            <li>Profile: {detail.payload.profile}</li>
          </ul>
        </div>
      ) : null}

      {bundle && bundle.files.length > 0 ? (
        <div className="space-y-3 rounded-2xl border border-store-border bg-white p-4 shadow-card">
          <p className="text-xs font-semibold text-slate-900">제출 파일</p>
          <ul className="space-y-2 text-xs">
            {bundle.files.map((file) => (
              <li key={file.id} className="rounded-xl border border-store-border bg-slate-50 px-3 py-2">
                <p className="font-semibold">
                  {DOCLING_FILE_ROLE_LABELS[file.role]} · {file.originalFileName}
                </p>
                <p className="mt-1 text-store-muted">
                  {formatBytes(file.fileSize)} · {file.mimeType} · SHA-256{" "}
                  {truncateSha256(file.checksumSha256)}
                </p>
                {packId ? (
                  <a
                    href={adminDoclingImportFileDownloadUrl(packId, file.id)}
                    className="mt-2 inline-flex min-h-[44px] items-center font-semibold text-store-accent"
                  >
                    다운로드
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
          <NormalizedDocumentPreview
            document={bundle.normalizedDocument}
            structure={structure}
            markdownText={markdownText}
          />
        </div>
      ) : null}

      {empty ? (
        <p className="rounded-2xl border border-store-border bg-white p-4 text-xs text-store-muted shadow-card">
          {ADMIN_REVIEW_DOCUMENTS_EMPTY}
        </p>
      ) : null}
    </section>
  );
}

/** @deprecated Prefer AdminReviewSourceDocumentsTab */
export { AdminReviewSourceDocumentsTab as AdminReviewDocumentsTab };
