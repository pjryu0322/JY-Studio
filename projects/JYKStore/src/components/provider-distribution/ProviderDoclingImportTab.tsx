"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { NormalizedDocumentPreview } from "@/components/docling/NormalizedDocumentPreview";
import type { DoclingImportBundlePublicDto } from "@/lib/docling-import/docling-import-dto";
import {
  DOCLING_FILE_ROLE_LABELS,
  extractOriginMatchSummary,
  formatBytes,
  formatDoclingBundleStatusWithCode,
  formatDoclingStorageStatus,
} from "@/lib/docling-import/docling-import-ui";
import {
  deleteProviderDoclingImportApi,
  deleteProviderDoclingImportBundleApi,
  fetchProviderDoclingImportApi,
  fetchProviderNormalizedDocumentApi,
  providerDoclingImportFileDownloadUrl,
  retryProviderDoclingImportApi,
  retryProviderDoclingImportBundleApi,
  uploadProviderDoclingImportApi,
} from "@/lib/provider-center-api";

function SelectedFileHint({ file }: { readonly file: File | null }) {
  if (!file) {
    return <p className="mt-1 text-xs text-store-muted">아직 선택되지 않았습니다.</p>;
  }
  return (
    <p className="mt-1 break-all text-xs font-semibold text-slate-800">
      선택됨: {file.name}
      <span className="font-normal text-store-muted"> · {formatBytes(file.size)}</span>
    </p>
  );
}

export function ProviderDoclingImportTab({
  packId,
  editable,
  cachedBundle = null,
  onDoclingChanged,
}: {
  readonly packId: string;
  readonly editable: boolean;
  readonly cachedBundle?: DoclingImportBundlePublicDto | null;
  readonly onDoclingChanged?: (bundle: DoclingImportBundlePublicDto | null) => void;
}) {
  const [bundle, setBundle] = useState<DoclingImportBundlePublicDto | null>(cachedBundle);
  const [stagingBundle, setStagingBundle] = useState<DoclingImportBundlePublicDto | null>(null);
  const [structure, setStructure] = useState<unknown>(null);
  const [markdownText, setMarkdownText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [markdownFile, setMarkdownFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const onDoclingChangedRef = useRef(onDoclingChanged);
  onDoclingChangedRef.current = onDoclingChanged;

  const canUpload = Boolean(sourceFile && jsonFile && markdownFile) && editable && !uploading;
  const selectedCount = [sourceFile, jsonFile, markdownFile].filter(Boolean).length;

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

  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      // Avoid unmounting the upload form on refresh — native file inputs lose the
      // selected filename display even when React File state is still held.
      if (!options?.silent) setLoading(true);
      setError(null);
      try {
        const data = await fetchProviderDoclingImportApi(packId);
        setBundle(data.bundle);
        setStagingBundle(data.stagingBundle ?? null);
        onDoclingChangedRef.current?.(data.bundle);
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
        setHasLoadedOnce(true);
      }
    },
    [packId, loadMarkdownPreview],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const onUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!canUpload || !sourceFile || !jsonFile || !markdownFile) return;
    setUploading(true);
    setError(null);
    setSuccessMessage(null);
    const wasReplacing = replacing;
    try {
      const data = await uploadProviderDoclingImportApi(packId, {
        sourceFile,
        doclingJsonFile: jsonFile,
        doclingMarkdownFile: markdownFile,
      });
      setBundle(data.bundle);
      setStagingBundle(null);
      onDoclingChanged?.(data.bundle);
      setSourceFile(null);
      setJsonFile(null);
      setMarkdownFile(null);
      setFileInputKey((key) => key + 1);
      setReplacing(false);
      setSuccessMessage(
        wasReplacing ? "새 Bundle로 교체되었습니다." : "Docling Bundle이 등록되었습니다.",
      );
      if (data.bundle.normalizedDocument) {
        const nd = await fetchProviderNormalizedDocumentApi(packId).catch(() => null);
        setStructure(nd?.structure ?? null);
      }
      await loadMarkdownPreview(data.bundle);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Docling 3파일 업로드에 실패했습니다.";
      const replaceHint = wasReplacing
        ? " 새 파일 검증에 실패했습니다. 현재 Bundle은 계속 유지됩니다. 실패한 Staging을 재시도하거나 삭제하세요."
        : "";
      const storageHint = /Object Storage|스토리지|storage|MinIO|연결/i.test(message)
        ? " 파일이 서버에 저장되지 않았습니다. 새로고침하면 선택 목록도 사라집니다."
        : replaceHint ||
          " 서버 저장에 실패했습니다. 새로고침하면 선택 목록이 사라집니다.";
      setError(`${message}${storageHint}`);
      await load({ silent: true });
      // Preserve replace mode so Active stays labeled and form returns after Staging delete.
      if (wasReplacing) setReplacing(true);
      else setReplacing(false);
    } finally {
      setUploading(false);
    }
  };

  const onRetry = async (target?: DoclingImportBundlePublicDto | null) => {
    const targetBundle = target ?? stagingBundle ?? bundle;
    if (!editable || !targetBundle?.canRetry || retrying) return;
    setRetrying(true);
    setError(null);
    try {
      const data = targetBundle.isActive
        ? await retryProviderDoclingImportApi(packId)
        : await retryProviderDoclingImportBundleApi(packId, targetBundle.id);
      await load({ silent: true });
      if (data.bundle.isActive) {
        setBundle(data.bundle);
        onDoclingChanged?.(data.bundle);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "재처리에 실패했습니다.");
    } finally {
      setRetrying(false);
    }
  };

  const onDeleteStaging = async () => {
    if (!editable || !stagingBundle?.canDelete) return;
    const ok = window.confirm("실패한 Staging Bundle을 삭제할까요?");
    if (!ok) return;
    setError(null);
    try {
      await deleteProviderDoclingImportBundleApi(packId, stagingBundle.id);
      setStagingBundle(null);
      await load({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Staging 삭제에 실패했습니다.");
    }
  };

  /** Staging-first replace: keep Active Bundle until new upload promotes. */
  const onStartReplace = () => {
    if (!editable || !bundle?.canDelete || stagingBundle) return;
    setError(null);
    setSuccessMessage(null);
    setReplacing(true);
  };

  /** Destructive delete of the registered Active Bundle (separate from replace). */
  const onDeleteRegistered = async () => {
    if (!editable || !bundle?.canDelete) return;
    const ok = window.confirm(
      "등록된 Docling 자료를 삭제할까요? 이 작업은 되돌릴 수 없습니다.",
    );
    if (!ok) return;
    setError(null);
    setSuccessMessage(null);
    try {
      await deleteProviderDoclingImportApi(packId);
      setBundle(null);
      setStructure(null);
      setMarkdownText(null);
      onDoclingChanged?.(null);
      setReplacing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제에 실패했습니다.");
    }
  };

  if (loading && !hasLoadedOnce && !bundle) {
    return <p className="text-sm text-store-muted">Docling import 불러오는 중…</p>;
  }

  const showUploadForm =
    editable && ((!bundle && !stagingBundle) || replacing) && !stagingBundle;

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
      {successMessage ? (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {successMessage}
        </div>
      ) : null}

      {showUploadForm && selectedCount > 0 && !uploading ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          아래 파일은 아직 이 브라우저에만 선택되어 있습니다.{" "}
          <span className="font-semibold">「3파일 업로드」가 성공</span>해야 새로고침 후에도
          남습니다. 성공 시 「등록된 Docling Bundle」 목록으로 바뀝니다.
        </div>
      ) : null}

      {bundle ? (
        <div className="space-y-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-xs text-slate-800">
          <p className="font-semibold text-emerald-950">
            {replacing ? "현재 사용 중인 Bundle" : "등록된 Docling Bundle"}
          </p>
          {replacing ? (
            <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-blue-950">
              새 파일 검증이 완료되기 전까지 현재 Bundle은 유지됩니다.
            </p>
          ) : null}
          {bundle.immutableAfterSubmission ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950">
              검수 제출 이력이 있어 교체할 수 없습니다. 새 버전을 생성하세요.
            </p>
          ) : null}
          <p>
            상태:{" "}
            <span className="font-bold">{formatDoclingBundleStatusWithCode(bundle.status)}</span>
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
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead>
                <tr className="border-b border-emerald-100 text-store-muted">
                  <th className="py-1 pr-3 font-semibold">유형</th>
                  <th className="py-1 pr-3 font-semibold">파일명</th>
                  <th className="py-1 pr-3 font-semibold">크기</th>
                  <th className="py-1 font-semibold">작업</th>
                </tr>
              </thead>
              <tbody>
                {bundle.files.map((file) => (
                  <tr key={file.id} className="border-b border-emerald-50 align-top">
                    <td className="py-2 pr-3 font-semibold">
                      {DOCLING_FILE_ROLE_LABELS[file.role]}
                    </td>
                    <td className="max-w-[14rem] break-all py-2 pr-3">{file.originalFileName}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{formatBytes(file.fileSize)}</td>
                    <td className="py-2">
                      <a
                        href={providerDoclingImportFileDownloadUrl(packId, file.id)}
                        className="inline-flex min-h-[44px] items-center font-semibold text-store-accent"
                      >
                        다운로드
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!replacing ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {editable && bundle.canDelete ? (
                <button
                  type="button"
                  onClick={onStartReplace}
                  disabled={Boolean(stagingBundle)}
                  className="min-h-[44px] rounded-xl border border-store-border bg-white px-3 text-xs font-semibold text-slate-800 disabled:opacity-60"
                >
                  새 파일로 교체
                </button>
              ) : null}
              {editable && bundle.canRetry ? (
                <button
                  type="button"
                  onClick={() => void onRetry(bundle)}
                  disabled={retrying}
                  className="min-h-[44px] rounded-xl border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-950 disabled:opacity-60"
                >
                  {retrying ? "재처리 중…" : "재시도"}
                </button>
              ) : null}
              {editable && bundle.canDelete ? (
                <button
                  type="button"
                  onClick={() => void onDeleteRegistered()}
                  className="min-h-[44px] rounded-xl border border-red-200 bg-white px-3 text-xs font-semibold text-red-700"
                >
                  등록 자료 삭제
                </button>
              ) : null}
            </div>
          ) : null}
          {!replacing ? (
            <NormalizedDocumentPreview
              document={bundle.normalizedDocument}
              structure={structure}
              markdownText={markdownText}
              processingLogs={bundle.processingLogs}
            />
          ) : null}
        </div>
      ) : null}

      {stagingBundle ? (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-slate-800">
          <p className="font-semibold text-amber-950">실패한 Staging Bundle</p>
          {bundle ? (
            <p className="text-amber-950">
              새 파일 검증에 실패했습니다. 현재 Bundle은 계속 유지됩니다. 실패한 Staging을
              재시도하거나 삭제하세요.
            </p>
          ) : null}
          <p>
            상태:{" "}
            <span className="font-bold">
              {formatDoclingBundleStatusWithCode(stagingBundle.status)}
            </span>
            {stagingBundle.stagingReason ? ` · ${stagingBundle.stagingReason}` : ""}
            {` · ${formatDoclingStorageStatus(stagingBundle.storageStatus)}`}
          </p>
          <p>
            오류 {stagingBundle.errorCount}
            {stagingBundle.lastErrorMessage ? ` · ${stagingBundle.lastErrorMessage}` : ""}
          </p>
          {!stagingBundle.canRetry && stagingBundle.lastErrorCode ? (
            <p className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-amber-950">
              같은 파일로는 재시도할 수 없습니다. Staging을 삭제한 후 올바른 파일을 다시
              등록하세요.
            </p>
          ) : null}
          <ul className="space-y-2">
            {stagingBundle.files.map((file) => (
              <li
                key={file.id}
                className="rounded-lg border border-amber-100 bg-white px-3 py-2"
              >
                <p className="font-semibold">
                  {DOCLING_FILE_ROLE_LABELS[file.role]} · {file.originalFileName}
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
            {editable && stagingBundle.canRetry ? (
              <button
                type="button"
                onClick={() => void onRetry(stagingBundle)}
                disabled={retrying}
                className="min-h-[44px] rounded-xl border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-950 disabled:opacity-60"
              >
                {retrying ? "재처리 중…" : "Staging 재시도"}
              </button>
            ) : null}
            {editable && stagingBundle.canDelete ? (
              <button
                type="button"
                onClick={() => void onDeleteStaging()}
                className="min-h-[44px] rounded-xl border border-red-200 bg-white px-3 text-xs font-semibold text-red-700"
              >
                Staging 삭제
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {showUploadForm ? (
        <form onSubmit={(e) => void onUpload(e)} className="space-y-3">
          {selectedCount > 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800">
              <p className="font-semibold">선택한 파일 {selectedCount}/3</p>
              <ul className="mt-1 space-y-0.5 text-store-muted">
                <li>원본문서: {sourceFile?.name ?? "—"}</li>
                <li>Docling JSON: {jsonFile?.name ?? "—"}</li>
                <li>Docling Markdown: {markdownFile?.name ?? "—"}</li>
              </ul>
            </div>
          ) : null}
          <div>
            <label className="text-xs font-semibold text-slate-700" htmlFor="docling-source">
              원본문서
            </label>
            <input
              key={`docling-source-${fileInputKey}`}
              id="docling-source"
              type="file"
              className="mt-2 block min-h-[44px] w-full text-sm"
              onChange={(e) => setSourceFile(e.target.files?.[0] ?? null)}
              required={!sourceFile}
            />
            <SelectedFileHint file={sourceFile} />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700" htmlFor="docling-json">
              Docling JSON
            </label>
            <input
              key={`docling-json-${fileInputKey}`}
              id="docling-json"
              type="file"
              accept=".json,application/json"
              className="mt-2 block min-h-[44px] w-full text-sm"
              onChange={(e) => setJsonFile(e.target.files?.[0] ?? null)}
              required={!jsonFile}
            />
            <SelectedFileHint file={jsonFile} />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700" htmlFor="docling-md">
              Docling Markdown
            </label>
            <input
              key={`docling-md-${fileInputKey}`}
              id="docling-md"
              type="file"
              accept=".md,.markdown,text/markdown,text/plain"
              className="mt-2 block min-h-[44px] w-full text-sm"
              onChange={(e) => setMarkdownFile(e.target.files?.[0] ?? null)}
              required={!markdownFile}
            />
            <SelectedFileHint file={markdownFile} />
          </div>
          <button
            type="submit"
            disabled={!canUpload}
            className="min-h-[44px] w-full rounded-xl bg-store-accent text-sm font-bold text-white disabled:opacity-60"
          >
            {uploading
              ? "업로드·검증 중…"
              : selectedCount === 3
                ? "3파일 업로드"
                : `3파일 업로드 (${selectedCount}/3)`}
          </button>
          {replacing ? (
            <button
              type="button"
              onClick={() => {
                setReplacing(false);
                void load({ silent: true });
              }}
              className="min-h-[44px] w-full rounded-xl border border-store-border text-sm font-semibold text-slate-700"
            >
              취소
            </button>
          ) : null}
        </form>
      ) : null}

      {!bundle && !stagingBundle && !editable ? (
        <p className="text-sm text-store-muted">등록된 Docling import가 없습니다.</p>
      ) : null}
    </section>
  );
}
