"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { NormalizedDocumentPreview } from "@/components/docling/NormalizedDocumentPreview";
import type { DoclingImportBundlePublicDto } from "@/lib/docling-import/docling-import-dto";
import {
  DOCLING_FILE_ROLE_LABELS,
  extractOriginMatchSummary,
  formatBytes,
  formatDoclingStorageStatus,
  truncateSha256,
} from "@/lib/docling-import/docling-import-ui";
import {
  deleteProviderDoclingImportApi,
  fetchProviderDoclingImportApi,
  fetchProviderNormalizedDocumentApi,
  providerDoclingImportFileDownloadUrl,
  retryProviderDoclingImportApi,
  uploadProviderDoclingImportApi,
} from "@/lib/provider-center-api";
import {
  PROVIDER_PACK_GO_TO_DISTRIBUTION_TAB,
  PROVIDER_PACK_GO_TO_REVIEW_TAB,
} from "@/lib/role-based-ux-copy";

export function ProviderDoclingImportTab({
  packId,
  editable,
  onGoToDistributionTab,
  onGoToReviewTab,
  onDoclingChanged,
}: {
  readonly packId: string;
  readonly editable: boolean;
  readonly onGoToDistributionTab: () => void;
  readonly onGoToReviewTab: () => void;
  readonly onDoclingChanged?: (bundle: DoclingImportBundlePublicDto | null) => void;
}) {
  const [bundle, setBundle] = useState<DoclingImportBundlePublicDto | null>(null);
  const [structure, setStructure] = useState<unknown>(null);
  const [markdownText, setMarkdownText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [markdownFile, setMarkdownFile] = useState<File | null>(null);

  const canUpload = Boolean(sourceFile && jsonFile && markdownFile) && editable && !uploading;

  const loadMarkdownPreview = useCallback(
    async (nextBundle: DoclingImportBundlePublicDto | null) => {
      const md = nextBundle?.files.find((f) => f.role === "DOCLING_MARKDOWN");
      if (!md) {
        setMarkdownText(null);
        return;
      }
      try {
        const response = await fetch(providerDoclingImportFileDownloadUrl(packId, md.id), {
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
      const data = await fetchProviderDoclingImportApi(packId);
      setBundle(data.bundle);
      onDoclingChanged?.(data.bundle);
      if (data.bundle?.normalizedDocument) {
        const nd = await fetchProviderNormalizedDocumentApi(packId).catch(() => null);
        setStructure(nd?.structure ?? null);
      } else {
        setStructure(null);
      }
      await loadMarkdownPreview(data.bundle);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Docling import를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [packId, onDoclingChanged, loadMarkdownPreview]);

  useEffect(() => {
    void load();
  }, [load]);

  const onUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!canUpload || !sourceFile || !jsonFile || !markdownFile) return;
    setUploading(true);
    setError(null);
    try {
      const data = await uploadProviderDoclingImportApi(packId, {
        sourceFile,
        doclingJsonFile: jsonFile,
        doclingMarkdownFile: markdownFile,
      });
      setBundle(data.bundle);
      onDoclingChanged?.(data.bundle);
      setSourceFile(null);
      setJsonFile(null);
      setMarkdownFile(null);
      setReplacing(false);
      if (data.bundle.normalizedDocument) {
        const nd = await fetchProviderNormalizedDocumentApi(packId).catch(() => null);
        setStructure(nd?.structure ?? null);
      }
      await loadMarkdownPreview(data.bundle);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Docling 3파일 업로드에 실패했습니다.");
    } finally {
      setUploading(false);
    }
  };

  const onRetry = async () => {
    if (!editable || !bundle?.canRetry || retrying) return;
    setRetrying(true);
    setError(null);
    try {
      const data = await retryProviderDoclingImportApi(packId);
      setBundle(data.bundle);
      onDoclingChanged?.(data.bundle);
      if (data.bundle.normalizedDocument) {
        const nd = await fetchProviderNormalizedDocumentApi(packId).catch(() => null);
        setStructure(nd?.structure ?? null);
      }
      await loadMarkdownPreview(data.bundle);
    } catch (err) {
      setError(err instanceof Error ? err.message : "재처리에 실패했습니다.");
    } finally {
      setRetrying(false);
    }
  };

  const onReplace = async () => {
    if (!editable || !bundle?.canDelete) return;
    const ok = window.confirm(
      "등록된 Docling 3파일을 삭제하고 다시 업로드할 수 있습니다. 계속할까요?",
    );
    if (!ok) return;
    setError(null);
    try {
      await deleteProviderDoclingImportApi(packId);
      setBundle(null);
      setStructure(null);
      setMarkdownText(null);
      onDoclingChanged?.(null);
      setReplacing(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "교체에 실패했습니다.");
    }
  };

  if (loading) {
    return <p className="text-sm text-store-muted">Docling import 불러오는 중…</p>;
  }

  const showUploadForm = editable && (!bundle || replacing);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-bold text-slate-900">Docling 3파일 Import</h2>
        <p className="mt-1 text-xs text-store-muted">
          외부 Docling에서 만든 원본문서·JSON·Markdown을 등록합니다. JYKStore는 Docling을 실행하지
          않으며, 원본은 불변으로 보관하고 NormalizedDocument만 재생성합니다.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {bundle && !replacing ? (
        <div className="space-y-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-xs text-slate-800">
          <p className="font-semibold text-emerald-950">등록된 Docling Bundle</p>
          {bundle.immutableAfterSubmission ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950">
              검수 제출 이력이 있어 교체할 수 없습니다. 새 버전을 생성하세요.
            </p>
          ) : null}
          <p>
            상태: <span className="font-bold">{bundle.status}</span>
            {bundle.doclingSchemaVersion
              ? ` · Schema ${bundle.doclingSchemaName ?? "DoclingDocument"} v${bundle.doclingSchemaVersion}`
              : null}
            {` · ${formatDoclingStorageStatus(bundle.storageStatus)}`}
          </p>
          <p>
            Adapter: {bundle.adapterType} {bundle.adapterVersion} · Origin match:{" "}
            {extractOriginMatchSummary(bundle.validationReport)}
          </p>
          <p>
            검증/정규화: 경고 {bundle.warningCount} · 오류 {bundle.errorCount}
            {bundle.lastErrorMessage ? ` · ${bundle.lastErrorMessage}` : ""}
          </p>
          <ul className="space-y-2">
            {bundle.files.map((file) => (
              <li
                key={file.id}
                className="rounded-lg border border-emerald-100 bg-white px-3 py-2"
              >
                <p className="font-semibold">
                  {DOCLING_FILE_ROLE_LABELS[file.role]} · {file.originalFileName}
                </p>
                <p className="mt-1 text-store-muted">
                  {formatBytes(file.fileSize)} · {file.mimeType} · SHA-256{" "}
                  {truncateSha256(file.checksumSha256)}
                </p>
                <a
                  href={providerDoclingImportFileDownloadUrl(packId, file.id)}
                  className="mt-2 inline-flex min-h-[44px] items-center text-xs font-semibold text-store-accent"
                >
                  다운로드
                </a>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2 pt-1">
            {editable && bundle.canRetry ? (
              <button
                type="button"
                onClick={() => void onRetry()}
                disabled={retrying}
                className="min-h-[44px] rounded-xl border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-950 disabled:opacity-60"
              >
                {retrying ? "재처리 중…" : "재시도"}
              </button>
            ) : null}
            {editable && bundle.canDelete ? (
              <button
                type="button"
                onClick={() => void onReplace()}
                className="min-h-[44px] rounded-xl border border-red-200 bg-white px-3 text-xs font-semibold text-red-700"
              >
                교체(재업로드)
              </button>
            ) : null}
            <button
              type="button"
              onClick={onGoToDistributionTab}
              className="min-h-[44px] rounded-xl bg-store-accent px-3 text-xs font-bold text-white"
            >
              {PROVIDER_PACK_GO_TO_DISTRIBUTION_TAB}
            </button>
            {bundle.status === "REVIEW_READY" ? (
              <button
                type="button"
                onClick={onGoToReviewTab}
                className="min-h-[44px] rounded-xl border border-store-border bg-white px-3 text-xs font-semibold text-slate-800"
              >
                {PROVIDER_PACK_GO_TO_REVIEW_TAB}
              </button>
            ) : null}
          </div>
          <NormalizedDocumentPreview
            document={bundle.normalizedDocument}
            structure={structure}
            markdownText={markdownText}
            processingLogs={bundle.processingLogs}
          />
        </div>
      ) : null}

      {showUploadForm ? (
        <form onSubmit={(e) => void onUpload(e)} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-700" htmlFor="docling-source">
              원본문서
            </label>
            <input
              id="docling-source"
              type="file"
              className="mt-2 block min-h-[44px] w-full text-sm"
              onChange={(e) => setSourceFile(e.target.files?.[0] ?? null)}
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700" htmlFor="docling-json">
              Docling JSON
            </label>
            <input
              id="docling-json"
              type="file"
              accept=".json,application/json"
              className="mt-2 block min-h-[44px] w-full text-sm"
              onChange={(e) => setJsonFile(e.target.files?.[0] ?? null)}
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700" htmlFor="docling-md">
              Docling Markdown
            </label>
            <input
              id="docling-md"
              type="file"
              accept=".md,.markdown,text/markdown,text/plain"
              className="mt-2 block min-h-[44px] w-full text-sm"
              onChange={(e) => setMarkdownFile(e.target.files?.[0] ?? null)}
              required
            />
          </div>
          <button
            type="submit"
            disabled={!canUpload}
            className="min-h-[44px] w-full rounded-xl bg-store-accent text-sm font-bold text-white disabled:opacity-60"
          >
            {uploading ? "업로드·검증 중…" : "3파일 업로드"}
          </button>
          {replacing ? (
            <button
              type="button"
              onClick={() => {
                setReplacing(false);
                void load();
              }}
              className="min-h-[44px] w-full rounded-xl border border-store-border text-sm font-semibold text-slate-700"
            >
              취소
            </button>
          ) : null}
        </form>
      ) : null}

      {!bundle && !editable ? (
        <p className="text-sm text-store-muted">등록된 Docling import가 없습니다.</p>
      ) : null}
    </section>
  );
}
