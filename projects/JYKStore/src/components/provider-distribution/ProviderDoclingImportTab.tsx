"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { NormalizedDocumentPreview } from "@/components/docling/NormalizedDocumentPreview";
import type { DoclingImportBundlePublicDto } from "@/lib/docling-import/docling-import-dto";
import {
  cancelDoclingMultipartUpload,
  clearStoredUploadSessionId,
  DOCLING_UPLOAD_STAGE_LABELS,
  formatEtaSeconds,
  formatUploadSpeed,
  readStoredUploadSessionId,
  uploadDoclingMultipart,
  type MultipartUploadProgress,
} from "@/lib/docling-import/docling-multipart-client";
import { logDoclingUploadClientEvent } from "@/lib/docling-import/docling-upload-client-log";
import {
  DOCLING_FILE_ROLE_LABELS,
  extractMarkdownPreviewStatus,
  extractOriginMatchSummary,
  formatBytes,
  formatDoclingBundleStatus,
  formatDoclingBundleStatusWithCode,
  formatDoclingStorageStatus,
  mapDoclingImportUserError,
} from "@/lib/docling-import/docling-import-ui";
import {
  confirmProviderDoclingImportApi,
  deleteProviderDoclingImportApi,
  deleteProviderDoclingImportBundleApi,
  fetchProviderDoclingImportApi,
  fetchProviderNormalizedDocumentApi,
  providerDoclingImportFileDownloadUrl,
  revalidateProviderDoclingImportBundleApi,
  retryProviderDoclingImportApi,
  retryProviderDoclingImportBundleApi,
} from "@/lib/provider-center-api";
import type { DoclingQualityGateResult } from "@/lib/docling-import/docling-quality-gate";

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

function UploadProgressPanel({ progress }: { readonly progress: MultipartUploadProgress }) {
  const isFailure = progress.stage === "error" || progress.stage === "cancelled";
  const isServerProcessing =
    progress.stage === "validating_server" ||
    progress.stage === "normalizing" ||
    progress.stage === "integrity" ||
    progress.stage === "completing";
  const showOverallPercent =
    !isFailure && !isServerProcessing && progress.overallPercent > 0;

  return (
    <div
      className={`sticky top-2 z-10 space-y-3 rounded-xl border p-3 text-xs shadow-sm ${
        isFailure
          ? "border-red-200 bg-red-50 text-slate-800"
          : "border-blue-100 bg-blue-50 text-slate-800"
      }`}
    >
      <p className={`font-semibold ${isFailure ? "text-red-950" : "text-blue-950"}`}>
        단계: {progress.stageLabel}
        {showOverallPercent ? ` · 전체 ${progress.overallPercent}%` : ""}
        {isServerProcessing ? " · 서버 처리 중" : ""}
      </p>
      {progress.message ? (
        <p className={isFailure ? "font-medium text-red-800" : "text-store-muted"}>
          {progress.message}
        </p>
      ) : null}
      {progress.stage === "preparing" || progress.stage === "validating" ? (
        <p className="text-blue-900">
          대용량 JSON(수백 MB)은 확인·준비에 수 초가 걸릴 수 있습니다. 이 화면을 닫지 마세요.
        </p>
      ) : null}
      {isFailure ? (
        <p className="font-semibold text-red-800">
          실패 단계에서 멈췄습니다. 위 메시지와 터미널 로그를 확인하세요.
        </p>
      ) : null}
      {!isFailure ? (
        <p className="text-store-muted">
          속도 {formatUploadSpeed(progress.overallSpeedBps)} · 예상 남은 시간{" "}
          {formatEtaSeconds(progress.overallEtaSeconds)}
        </p>
      ) : null}
      <ul className="space-y-2">
        {progress.files.map((file) => (
          <li key={file.role} className="rounded-lg border border-blue-100 bg-white px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">
                {DOCLING_FILE_ROLE_LABELS[file.role]} · {file.fileName}
              </p>
              <p className="text-store-muted">{file.percent}%</p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-[width] ${
                  isFailure ? "bg-red-400" : "bg-store-accent"
                }`}
                style={{ width: `${file.percent}%` }}
              />
            </div>
            <p className="mt-1 text-store-muted">
              {formatBytes(file.bytesUploaded)} / {formatBytes(file.bytesTotal)}
              {!isFailure
                ? ` · ${formatUploadSpeed(file.speedBps)} · ETA ${formatEtaSeconds(file.etaSeconds)}`
                : null}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProviderDoclingImportTab({
  packId,
  editable,
  cachedBundle = null,
  onDoclingChanged,
  onGoToDistribution,
}: {
  readonly packId: string;
  readonly editable: boolean;
  readonly cachedBundle?: DoclingImportBundlePublicDto | null;
  readonly onDoclingChanged?: (bundle: DoclingImportBundlePublicDto | null) => void;
  readonly onGoToDistribution?: () => void;
}) {
  const [bundle, setBundle] = useState<DoclingImportBundlePublicDto | null>(cachedBundle);
  const [stagingBundle, setStagingBundle] = useState<DoclingImportBundlePublicDto | null>(null);
  const [structure, setStructure] = useState<unknown>(null);
  const [markdownText, setMarkdownText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<MultipartUploadProgress | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [markdownFile, setMarkdownFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [confirmAck, setConfirmAck] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [resumeHint, setResumeHint] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const onDoclingChangedRef = useRef(onDoclingChanged);
  onDoclingChangedRef.current = onDoclingChanged;

  const canUpload = Boolean(sourceFile && jsonFile) && editable && !uploading;
  /** Cancel only while bytes are still being transferred — not during server processing. */
  const canCancelUpload =
    uploading &&
    (!uploadProgress ||
      uploadProgress.stage === "idle" ||
      uploadProgress.stage === "validating" ||
      uploadProgress.stage === "preparing" ||
      uploadProgress.stage === "uploading");
  const requiredSelectedCount = [sourceFile, jsonFile].filter(Boolean).length;
  const selectedCount = requiredSelectedCount + (markdownFile ? 1 : 0);
  const totalRoles = markdownFile ? 3 : 2;

  const loadMarkdownPreview = useCallback(
    async (nextBundle: DoclingImportBundlePublicDto | null) => {
      const md = nextBundle?.files.find((f) => f.role === "DOCLING_MARKDOWN");
      if (!md) {
        setMarkdownText(null);
        return;
      }
      try {
        const response = await fetch(
          providerDoclingImportFileDownloadUrl(packId, md.id, { preview: true, maxBytes: 100_000 }),
          {
          credentials: "include",
        },
        );
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
      if (!options?.silent) setLoading(true);
      setError(null);
      try {
        const data = await fetchProviderDoclingImportApi(packId);
        setBundle(data.bundle);
        setStagingBundle(data.stagingBundle ?? null);
        onDoclingChangedRef.current?.(data.bundle);
        const previewBundle =
          data.stagingBundle?.status === "NORMALIZED"
            ? data.stagingBundle
            : data.bundle;
        if (previewBundle?.normalizedDocument) {
          const nd = await fetchProviderNormalizedDocumentApi(packId).catch(() => null);
          setStructure(nd?.structure ?? null);
        } else {
          setStructure(null);
        }
        await loadMarkdownPreview(previewBundle);
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

  useEffect(() => {
    const sessionId = readStoredUploadSessionId(packId);
    if (sessionId) {
      setResumeHint(
        "이전에 중단된 업로드 세션이 있습니다. 같은 파일을 다시 선택하면 이어서 업로드합니다.",
      );
    } else {
      setResumeHint(null);
    }
  }, [packId]);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const onUpload = async () => {
    if (!canUpload || !sourceFile || !jsonFile) return;
    setUploading(true);
    setError(null);
    setSuccessMessage(null);
    void logDoclingUploadClientEvent(packId, "ui_upload_click", {
      sourceBytes: sourceFile.size,
      jsonBytes: jsonFile.size,
      markdownBytes: markdownFile?.size ?? 0,
    });
    // Paint progress shell immediately (before async fingerprint of large JSON).
    setUploadProgress({
      stage: "validating",
      stageLabel: DOCLING_UPLOAD_STAGE_LABELS.validating,
      message:
        jsonFile.size > 32 * 1024 * 1024
          ? "대용량 JSON 확인을 시작합니다. 화면을 유지해 주세요."
          : null,
      files: [
        {
          role: "SOURCE_ORIGINAL",
          fileName: sourceFile.name,
          bytesTotal: sourceFile.size,
          bytesUploaded: 0,
          percent: 0,
          speedBps: 0,
          etaSeconds: null,
          status: "pending",
        },
        {
          role: "DOCLING_JSON",
          fileName: jsonFile.name,
          bytesTotal: jsonFile.size,
          bytesUploaded: 0,
          percent: 0,
          speedBps: 0,
          etaSeconds: null,
          status: "pending",
        },
        ...(markdownFile
          ? [
              {
                role: "DOCLING_MARKDOWN" as const,
                fileName: markdownFile.name,
                bytesTotal: markdownFile.size,
                bytesUploaded: 0,
                percent: 0,
                speedBps: 0,
                etaSeconds: null as number | null,
                status: "pending" as const,
              },
            ]
          : []),
      ],
      overallPercent: 0,
      overallSpeedBps: 0,
      overallEtaSeconds: null,
      sessionId: null,
      bundleId: null,
    });
    const wasReplacing = replacing;
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await uploadDoclingMultipart({
        packId,
        files: {
          sourceFile,
          doclingJsonFile: jsonFile,
          doclingMarkdownFile: markdownFile,
        },
        signal: controller.signal,
        onProgress: setUploadProgress,
      });
      setBundle(result.bundle);
      setStagingBundle(null);
      onDoclingChanged?.(result.bundle);
      setSourceFile(null);
      setJsonFile(null);
      setMarkdownFile(null);
      setFileInputKey((key) => key + 1);
      setReplacing(false);
      setResumeHint(null);
      setConfirmAck(false);
      setSuccessMessage(
        result.bundle.status === "NORMALIZED"
          ? "자료 등록이 완료되었습니다. 정규화 결과를 확인한 뒤 확인 완료해 주세요."
          : wasReplacing
            ? "새 Bundle로 교체되었습니다."
            : "Docling Bundle이 등록되었습니다.",
      );
      if (result.bundle.normalizedDocument) {
        const nd = await fetchProviderNormalizedDocumentApi(packId).catch(() => null);
        setStructure(nd?.structure ?? null);
      }
      await loadMarkdownPreview(result.bundle);
      await load({ silent: true });
      setUploadProgress(null);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("업로드가 취소되었습니다.");
      } else {
        const message =
          err instanceof Error ? err.message : "Docling 업로드에 실패했습니다.";
        const replaceHint = wasReplacing
          ? " 새 파일 검증에 실패했습니다. 현재 Bundle은 계속 유지됩니다. 실패한 Staging을 재시도하거나 삭제하세요."
          : "";
        const storageHint = /Object Storage|스토리지|storage|MinIO|연결|ETag|CORS/i.test(message)
          ? " 파일이 서버에 완전히 저장되지 않았을 수 있습니다. 세션이 남아 있으면 같은 파일로 이어서 업로드하세요."
          : replaceHint ||
            " 업로드에 실패했습니다. 선택한 파일은 유지됩니다. 터미널의 [docling-upload] 로그를 확인하세요.";
        setError(`${message}${storageHint}`);
      }
      // Keep selected files + last progress so the user can read the failure stage.
      requestAnimationFrame(() => {
        errorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
      await load({ silent: true });
      if (wasReplacing) setReplacing(true);
      else setReplacing(false);
    } finally {
      abortRef.current = null;
      setUploading(false);
    }
  };

  const onCancelUpload = async () => {
    abortRef.current?.abort();
    const sessionId = uploadProgress?.sessionId ?? readStoredUploadSessionId(packId);
    try {
      await cancelDoclingMultipartUpload(packId, sessionId);
    } catch {
      clearStoredUploadSessionId(packId);
    }
    setResumeHint(null);
    setUploading(false);
    setUploadProgress(null);
    setError("업로드가 취소되었습니다.");
  };

  const onRetry = async (target?: DoclingImportBundlePublicDto | null) => {
    const targetBundle = target ?? stagingBundle ?? bundle;
    if (!editable || !targetBundle?.canRetry || retrying) return;
    setRetrying(true);
    setError(null);
    try {
      const data =
        targetBundle.retryMode === "REVALIDATE_STORED_OBJECTS"
          ? await revalidateProviderDoclingImportBundleApi(packId, targetBundle.id)
          : targetBundle.isActive
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

  const onRevalidate = async (target: DoclingImportBundlePublicDto) => {
    if (!editable || target.retryMode !== "REVALIDATE_STORED_OBJECTS" || retrying) {
      return;
    }
    setRetrying(true);
    setError(null);
    try {
      const data = await revalidateProviderDoclingImportBundleApi(packId, target.id);
      await load({ silent: true });
      if (data.bundle.isActive) {
        setBundle(data.bundle);
        onDoclingChanged?.(data.bundle);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "재검증에 실패했습니다.");
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

  const onStartReplace = () => {
    if (!editable || !bundle?.canDelete || stagingBundle) return;
    setError(null);
    setSuccessMessage(null);
    setReplacing(true);
  };

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

  const confirmTarget: DoclingImportBundlePublicDto | null =
    stagingBundle?.status === "NORMALIZED"
      ? stagingBundle
      : bundle?.status === "NORMALIZED"
        ? bundle
        : null;

  const qualityGateFromStructure =
    structure && typeof structure === "object"
      ? ((structure as { qualityGate?: DoclingQualityGateResult }).qualityGate ?? null)
      : null;
  const qualityFromReport =
    confirmTarget?.normalizationReport &&
    typeof confirmTarget.normalizationReport === "object"
      ? ((confirmTarget.normalizationReport as { qualityGate?: DoclingQualityGateResult })
          .qualityGate ?? null)
      : null;
  const qualityGate = qualityFromReport ?? qualityGateFromStructure;
  const hasBlockers = Boolean(qualityGate && qualityGate.blockers.length > 0);

  const onConfirmNormalized = async () => {
    if (!editable || !confirmTarget || hasBlockers || !confirmAck) return;
    setConfirming(true);
    setError(null);
    try {
      const result = await confirmProviderDoclingImportApi(packId, confirmTarget.id);
      setSuccessMessage("확인이 완료되었습니다. 유통정보를 입력해 주세요.");
      setConfirmAck(false);
      onDoclingChanged?.(result.bundle);
      await load({ silent: true });
      onGoToDistribution?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "확인 완료에 실패했습니다.");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <section className="space-y-4">
      {uploadProgress ? <UploadProgressPanel progress={uploadProgress} /> : null}

      {error ? (
        <div
          ref={errorRef}
          className="sticky top-2 z-20 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {error}
        </div>
      ) : null}
      {successMessage ? (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {successMessage}
        </div>
      ) : null}
      {resumeHint && showUploadForm && !uploading ? (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-950">
          {resumeHint}
        </div>
      ) : null}

      {showUploadForm && selectedCount > 0 && !uploading ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          아래 파일은 아직 이 브라우저에만 선택되어 있습니다.{" "}
          <span className="font-semibold">「업로드」가 성공</span>해야 새로고침 후에도 남습니다.
          성공 시 「등록된 Docling Bundle」 목록으로 바뀝니다.
        </div>
      ) : null}

      {bundle || confirmTarget ? (
        <div className="space-y-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-xs text-slate-800">
          <p className="font-semibold text-emerald-950">
            {confirmTarget && confirmTarget.status === "NORMALIZED"
              ? "자료 등록 완료"
              : replacing
                ? "현재 사용 중인 Bundle"
                : "등록된 Docling Bundle"}
          </p>
          {replacing ? (
            <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-blue-950">
              새 파일 검증이 완료되기 전까지 현재 Bundle은 유지됩니다.
            </p>
          ) : null}
          {(confirmTarget ?? bundle)?.immutableAfterSubmission ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950">
              검수 제출 이력이 있어 교체할 수 없습니다. 새 버전을 생성하세요.
            </p>
          ) : null}

          <ul className="space-y-1 rounded-lg border border-emerald-100 bg-white/80 px-3 py-2">
            <li>
              등록 파일{" "}
              <span className="font-semibold">{(confirmTarget ?? bundle)?.files.length ?? 0}개</span>
            </li>
            <li>
              파일 무결성 <span className="font-semibold">정상</span>
            </li>
            <li>
              문서 일치 여부{" "}
              <span className="font-semibold">
                {extractOriginMatchSummary((confirmTarget ?? bundle)?.validationReport)}
              </span>
            </li>
            <li>
              정규화 상태{" "}
              <span className="font-semibold">
                {formatDoclingBundleStatus((confirmTarget ?? bundle)?.status)}
              </span>
            </li>
            {qualityGate ? (
              <li>
                확인 필요 항목{" "}
                <span className="font-semibold">
                  {qualityGate.blockers.length + qualityGate.warnings.length}개
                </span>
              </li>
            ) : null}
          </ul>

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
                {(confirmTarget ?? bundle)?.files.map((file) => (
                  <tr key={file.id} className="border-b border-emerald-50 align-top">
                    <td className="py-2 pr-3 font-semibold">
                      {DOCLING_FILE_ROLE_LABELS[file.role]}
                    </td>
                    <td className="max-w-[14rem] truncate py-2 pr-3" title={file.originalFileName}>
                      {file.originalFileName}
                    </td>
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
            <NormalizedDocumentPreview
              document={(confirmTarget ?? bundle)?.normalizedDocument ?? null}
              structure={structure}
              markdownText={markdownText}
              processingLogs={(confirmTarget ?? bundle)?.processingLogs}
              qualityGate={qualityGate}
            />
          ) : null}

          {!replacing && editable ? (
            <div className="space-y-3 border-t border-emerald-100 pt-3">
              {confirmTarget?.status === "NORMALIZED" ? (
                <>
                  {hasBlockers ? (
                    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-900">
                      본문 또는 읽기 순서가 생성되지 않아 확인 완료할 수 없습니다. 자료를 다시
                      처리하거나 새 파일로 교체해 주세요.
                    </p>
                  ) : (
                    <label className="flex min-h-[44px] items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={confirmAck}
                        onChange={(e) => setConfirmAck(e.target.checked)}
                      />
                      <span>등록 파일과 정규화 결과의 대표 샘플을 확인했습니다.</span>
                    </label>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {(confirmTarget ?? bundle)?.canDelete ? (
                      <button
                        type="button"
                        onClick={onStartReplace}
                        className="min-h-[44px] rounded-xl border border-store-border bg-white px-3 text-xs font-semibold text-slate-800"
                      >
                        새 파일로 교체
                      </button>
                    ) : null}
                    {(confirmTarget ?? bundle)?.canRetry ? (
                      <button
                        type="button"
                        onClick={() => void onRetry(confirmTarget ?? bundle!)}
                        disabled={retrying}
                        className="min-h-[44px] rounded-xl border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-950 disabled:opacity-60"
                      >
                        {retrying ? "재처리 중…" : "다시 처리"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={hasBlockers || !confirmAck || confirming}
                      onClick={() => void onConfirmNormalized()}
                      className="min-h-[44px] rounded-xl bg-store-accent px-3 text-xs font-bold text-white disabled:opacity-60"
                    >
                      {confirming ? "확인 중…" : "확인 완료하고 유통정보 입력"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-wrap gap-2 pt-1">
                  {bundle?.canDelete ? (
                    <button
                      type="button"
                      onClick={onStartReplace}
                      disabled={Boolean(stagingBundle)}
                      className="min-h-[44px] rounded-xl border border-store-border bg-white px-3 text-xs font-semibold text-slate-800 disabled:opacity-60"
                    >
                      새 파일로 교체
                    </button>
                  ) : null}
                  {bundle?.retryMode === "REVALIDATE_STORED_OBJECTS" ? (
                    <button
                      type="button"
                      onClick={() => void onRevalidate(bundle)}
                      disabled={retrying}
                      className="min-h-[44px] rounded-xl border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-950 disabled:opacity-60"
                    >
                      {retrying ? "재검증 중…" : "저장된 파일 재검증"}
                    </button>
                  ) : null}
                  {bundle?.canRetry && bundle.retryMode !== "REVALIDATE_STORED_OBJECTS" ? (
                    <button
                      type="button"
                      onClick={() => void onRetry(bundle)}
                      disabled={retrying}
                      className="min-h-[44px] rounded-xl border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-950 disabled:opacity-60"
                    >
                      {retrying ? "재처리 중…" : "다시 처리"}
                    </button>
                  ) : null}
                  {bundle?.canDelete ? (
                    <button
                      type="button"
                      onClick={() => void onDeleteRegistered()}
                      className="min-h-[44px] rounded-xl border border-red-200 bg-white px-3 text-xs font-semibold text-red-700"
                    >
                      등록 자료 삭제
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {stagingBundle && stagingBundle.status !== "NORMALIZED" ? (
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
            {stagingBundle.lastErrorMessage
              ? ` · ${mapDoclingImportUserError(stagingBundle.lastErrorCode, stagingBundle.lastErrorMessage)}`
              : ""}
          </p>
          {(() => {
            const mdStatus = extractMarkdownPreviewStatus(stagingBundle.validationReport);
            if (!mdStatus) return null;
            return (
              <p className="rounded-lg border border-amber-100 bg-white px-3 py-2 text-amber-950">
                Markdown: {mdStatus.label}
                {mdStatus.detail ? ` · ${mdStatus.detail}` : ""}
              </p>
            );
          })()}
          {stagingBundle.retryMode === "REUPLOAD_REQUIRED" && stagingBundle.lastErrorCode ? (
            <p className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-amber-950">
              원본문서 또는 JSON의 무결성/형식 문제입니다. Staging을 삭제한 후 올바른 파일을 다시
              등록하세요. Markdown만 문제인 경우는 등록을 막지 않습니다.
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
            {editable && stagingBundle.retryMode === "REVALIDATE_STORED_OBJECTS" ? (
              <button
                type="button"
                onClick={() => void onRevalidate(stagingBundle)}
                disabled={retrying}
                className="min-h-[44px] rounded-xl border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-950 disabled:opacity-60"
              >
                {retrying ? "재검증 중…" : "저장된 파일 재검증"}
              </button>
            ) : null}
            {editable &&
            stagingBundle.canRetry &&
            stagingBundle.retryMode !== "REVALIDATE_STORED_OBJECTS" ? (
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
        <div className="space-y-3">
          {selectedCount > 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800">
              <p className="font-semibold">
                선택한 파일 {requiredSelectedCount}/2 필수
                {markdownFile ? " · Markdown 포함" : " · Markdown 선택 안 함"}
              </p>
              <ul className="mt-1 space-y-0.5 text-store-muted">
                <li>원본문서: {sourceFile?.name ?? "—"}</li>
                <li>Docling JSON: {jsonFile?.name ?? "—"}</li>
                <li>Docling Markdown: {markdownFile?.name ?? "선택 안 함"}</li>
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
              disabled={uploading}
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
              disabled={uploading}
            />
            <SelectedFileHint file={jsonFile} />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700" htmlFor="docling-md">
              Docling Markdown (선택)
            </label>
            <input
              key={`docling-md-${fileInputKey}`}
              id="docling-md"
              type="file"
              accept=".md,.markdown,text/markdown,text/plain"
              className="mt-2 block min-h-[44px] w-full text-sm"
              onChange={(e) => setMarkdownFile(e.target.files?.[0] ?? null)}
              disabled={uploading}
            />
            {markdownFile ? (
              <SelectedFileHint file={markdownFile} />
            ) : (
              <p className="mt-1 text-xs text-store-muted">선택 안 함 — 미리보기용 선택 자료</p>
            )}
            {markdownFile && !uploading ? (
              <button
                type="button"
                className="mt-1 text-xs font-semibold text-store-accent"
                onClick={() => setMarkdownFile(null)}
              >
                Markdown 선택 해제
              </button>
            ) : null}
          </div>
          {!uploading ? (
            <button
              type="button"
              disabled={!canUpload}
              onClick={() => void onUpload()}
              className="min-h-[44px] w-full rounded-xl bg-store-accent text-sm font-bold text-white disabled:opacity-60"
            >
              {canUpload
                ? totalRoles === 3
                  ? "업로드 (원본·JSON·Markdown)"
                  : "업로드 (원본·JSON)"
                : `업로드 (${requiredSelectedCount}/2 필수)`}
            </button>
          ) : canCancelUpload ? (
            <button
              type="button"
              onClick={() => void onCancelUpload()}
              className="min-h-[44px] w-full rounded-xl border border-red-200 bg-white text-sm font-semibold text-red-700"
            >
              업로드 취소
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="min-h-[44px] w-full rounded-xl border border-store-border bg-slate-50 text-sm font-semibold text-store-muted disabled:opacity-100"
            >
              서버 처리 중… (취소 불가)
            </button>
          )}
          {replacing && !uploading ? (
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
        </div>
      ) : null}

      {!bundle && !stagingBundle && !editable ? (
        <p className="text-sm text-store-muted">등록된 Docling import가 없습니다.</p>
      ) : null}
    </section>
  );
}
