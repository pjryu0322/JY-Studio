"use client";

import { useCallback, useEffect, useState } from "react";
import {
  acceptAdminWorkerZipRequest,
  fetchAdminWorkerZipRequestState,
  runAdminWorkerZipGeneration,
  type AdminWorkerZipGenerationResult,
  type AdminWorkerZipRequestState,
} from "@/lib/admin-review-api";

/**
 * P7.3: Admin "지식데이터 생성 실행" area — the execution authority for the ZIP path.
 *
 * The Provider only submits a ZIP request; the Admin 접수(확인) → 실행 here. The pack
 * stays DRAFT during execution; promotion to review is a separate admin step after
 * verification. Raw internal detail is collapsed under a debug section.
 */
export function AdminWorkerZipGenerationCard({ packId }: { readonly packId: string }) {
  const [state, setState] = useState<AdminWorkerZipRequestState | null>(null);
  const [running, setRunning] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AdminWorkerZipGenerationResult | null>(null);
  const [showDebug, setShowDebug] = useState(false);

  const loadState = useCallback(async () => {
    try {
      setState(await fetchAdminWorkerZipRequestState(packId));
    } catch {
      // Non-fatal: the pack may not have a request yet.
      setState(null);
    }
  }, [packId]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const onAccept = async () => {
    if (accepting || running) return;
    setAccepting(true);
    setError(null);
    try {
      await acceptAdminWorkerZipRequest(packId);
      await loadState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "접수에 실패했습니다.");
    } finally {
      setAccepting(false);
    }
  };

  const onExecute = async () => {
    if (running) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await runAdminWorkerZipGeneration(packId);
      setResult(res);
      await loadState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "지식데이터 생성 실행에 실패했습니다.");
    } finally {
      setRunning(false);
    }
  };

  const request = state?.request ?? null;
  const hasRequest = Boolean(request);
  const status = state?.requestStatus ?? "NONE";
  const inProgress = status === "PROCESSING";
  const isAccepted = status === "ACCEPTED";
  const canAccept = status === "REQUESTED";
  const completed = result?.ok === true && result.generationReady === true;
  const failed = result != null && result.ok === false;

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="space-y-1">
        <h2 className="text-sm font-bold text-slate-900">지식데이터 생성 실행</h2>
        <p className="text-xs text-slate-600">
          제공자가 등록한 자료(ZIP)를 확인한 뒤 지식데이터 생성을 실행합니다. 생성·검증이 끝나면
          검수 단계로 승격하세요.
        </p>
      </div>

      {hasRequest ? (
        <dl className="space-y-1 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">첨부 자료</dt>
            <dd className="font-medium text-slate-900">{request!.originalFileName}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">파일 크기</dt>
            <dd>{formatBytes(request!.fileSize)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">요청 일시</dt>
            <dd>{formatDateTime(request!.uploadedAt)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">요청 상태</dt>
            <dd className="font-semibold text-slate-900">{statusLabel(state!.requestStatus)}</dd>
          </div>
        </dl>
      ) : (
        <p className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          아직 접수된 생성 요청(ZIP 자료)이 없습니다. 제공자에게 자료 등록을 요청하세요.
        </p>
      )}

      {canAccept ? (
        <button
          type="button"
          onClick={() => void onAccept()}
          disabled={accepting || running}
          className="min-h-[44px] w-full rounded-xl bg-indigo-600 px-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {accepting ? "접수 중…" : "생성 요청 접수"}
        </button>
      ) : null}

      <button
        type="button"
        onClick={() => void onExecute()}
        disabled={running || !hasRequest || inProgress || canAccept}
        className="min-h-[44px] w-full rounded-xl bg-slate-900 px-3 text-sm font-bold text-white disabled:opacity-60"
      >
        {running ? "생성 실행 중…" : "지식데이터 생성 실행"}
      </button>

      {canAccept ? (
        <p className="text-[11px] text-slate-500">
          먼저 “생성 요청 접수”를 하면 제공자가 자료를 회수할 수 없으며, 이후 생성을 실행할 수 있습니다.
        </p>
      ) : null}
      {isAccepted ? (
        <p className="text-[11px] text-indigo-700">접수완료 — 제공자는 더 이상 요청을 회수할 수 없습니다.</p>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {completed ? (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <p className="font-semibold">지식데이터 생성이 완료되었습니다.</p>
          <p className="text-xs">
            지식 청크 {result!.importedChunkCount}개 · 검색데이터 {result!.importedEmbeddingCount}개
          </p>
        </div>
      ) : null}

      {failed ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">
          <p>{result!.error?.message ?? "지식데이터 생성에 실패했습니다."}</p>
        </div>
      ) : null}

      {result?.exclusionSummary && result.exclusionSummary.total > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          <p className="font-semibold text-slate-900">
            자동 제외된 파일 {result.exclusionSummary.total}개
          </p>
          <p className="mt-0.5 text-slate-500">
            보안 차단 및 기본 제외 정책으로 구조화 대상에서 제외되었습니다. 원본 자료는 그대로 보존됩니다.
          </p>
          <ul className="mt-1 space-y-0.5">
            {topExclusionReasons(result.exclusionSummary.byReason).map(([reason, count]) => (
              <li key={reason} className="flex justify-between gap-2">
                <span className="text-slate-600">{exclusionReasonLabel(reason)}</span>
                <span className="font-medium text-slate-900">{count}개</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result ? (
        <div className="text-xs">
          <button
            type="button"
            onClick={() => setShowDebug((v) => !v)}
            className="text-slate-500 underline"
          >
            {showDebug ? "디버그 정보 숨기기" : "디버그 정보 보기"}
          </button>
          {showDebug ? (
            <pre className="mt-1 overflow-x-auto rounded-lg bg-slate-900 p-2 text-[11px] text-slate-100">
{JSON.stringify(
  {
    pipelineRunId: result.pipelineRunId,
    generationReady: result.generationReady,
    nextStep: result.nextStep,
    pgvectorReflected: result.pgvectorReflected,
    warnings: result.warnings,
    error: result.error,
  },
  null,
  2,
)}
            </pre>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function statusLabel(status: AdminWorkerZipRequestState["requestStatus"]): string {
  switch (status) {
    case "REQUESTED":
      return "접수 대기";
    case "ACCEPTED":
      return "접수완료";
    case "PROCESSING":
      return "처리 중";
    case "COMPLETED":
      return "생성 완료";
    case "FAILED":
      return "처리 실패";
    default:
      return "대기";
  }
}

/** Top exclusion reasons by count (descending), capped for a compact read-only view. */
function topExclusionReasons(
  byReason: Record<string, number>,
  limit = 5,
): [string, number][] {
  return Object.entries(byReason)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function exclusionReasonLabel(reason: string): string {
  switch (reason) {
    case "blocked_path_traversal":
      return "보안 차단: 잘못된 경로";
    case "blocked_absolute_path":
      return "보안 차단: 절대경로";
    case "blocked_symlink":
      return "보안 차단: 심볼릭 링크";
    case "excluded_directory":
      return "제외 폴더 (빌드/캐시 등)";
    case "excluded_file_name":
      return "제외 파일명 (시스템 파일 등)";
    case "excluded_extension":
      return "제외 확장자 (실행/압축 파일 등)";
    case "file_size_exceeded":
      return "용량 초과 파일";
    case "unsupported_entry_type":
      return "처리할 수 없는 항목";
    default:
      return reason;
  }
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** idx;
  return `${value.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
}
