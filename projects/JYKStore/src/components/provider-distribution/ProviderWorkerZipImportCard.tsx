"use client";

import { useCallback, useEffect, useState } from "react";
import {
  acknowledgeProviderWorkerZipRejectionApi,
  fetchProviderWorkerZipRequestStateApi,
  requestProviderWorkerZipGenerationApi,
  withdrawProviderWorkerZipRequestApi,
  type ProviderWorkerZipRequestState,
} from "@/lib/provider-center-api";

type RequestStatus = ProviderWorkerZipRequestState["requestStatus"];

/**
 * P7.3: 문서 ZIP 등록 + 지식데이터 생성 요청 카드.
 *
 * 역할 분리: 제공자는 자료(.zip)를 첨부하고 "생성 요청"까지만 수행한다. 실제 지식데이터
 * 생성(Worker 실행)은 관리자가 접수 후 실행한다. 이 화면에는 실행 버튼이 없고, 내부
 * 용어(Python Worker / pgvector / 구조화 엔진)는 노출하지 않는다.
 *
 * 완료·진행 상태에서는 업로드 폼보다 처리 요약과 다음 단계 CTA를 우선 표시한다.
 */
export function ProviderWorkerZipImportCard({
  packId,
  editable,
  onGoToKnowledge,
  onStatusChange,
}: {
  readonly packId: string;
  readonly editable: boolean;
  readonly onGoToKnowledge?: () => void;
  readonly onStatusChange?: (status: RequestStatus) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showReplaceUpload, setShowReplaceUpload] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<ProviderWorkerZipRequestState | null>(null);

  const loadState = useCallback(async () => {
    try {
      const next = await fetchProviderWorkerZipRequestStateApi(packId);
      setState(next);
      onStatusChange?.(next.requestStatus);
    } catch {
      // Non-fatal: the card still allows a new request.
    }
  }, [packId, onStatusChange]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const onRequest = async () => {
    if (!editable || submitting || !file) return;
    setSubmitting(true);
    setError(null);
    try {
      await requestProviderWorkerZipGenerationApi(packId, file);
      setFile(null);
      setShowReplaceUpload(false);
      await loadState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "생성 요청에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const onWithdraw = async () => {
    if (!editable || withdrawing || submitting) return;
    if (typeof window !== "undefined" && !window.confirm("생성 요청을 회수할까요? 첨부한 자료가 삭제됩니다.")) {
      return;
    }
    setWithdrawing(true);
    setError(null);
    try {
      await withdrawProviderWorkerZipRequestApi(packId);
      await loadState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "요청 회수에 실패했습니다.");
    } finally {
      setWithdrawing(false);
    }
  };

  const onAcknowledgeRejection = async () => {
    if (!editable || acknowledging || submitting) return;
    setAcknowledging(true);
    setError(null);
    try {
      await acknowledgeProviderWorkerZipRejectionApi(packId);
      await loadState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "반려 확인에 실패했습니다.");
    } finally {
      setAcknowledging(false);
    }
  };

  const onRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setError(null);
    try {
      await loadState();
    } finally {
      setRefreshing(false);
    }
  };

  const request = state?.request ?? null;
  const status: RequestStatus = state?.requestStatus ?? "NONE";
  const canWithdraw = status === "REQUESTED";
  const isRejected = status === "REJECTED";
  const isFailed = status === "FAILED";
  const isCompleted = status === "COMPLETED";
  const isProcessing = status === "PROCESSING";
  const isPendingGeneration = status === "REQUESTED" || status === "ACCEPTED";
  const hasMaterial = Boolean(request);
  const rejectionReason = request?.rejection?.reason?.trim() || state?.reviewMemo?.trim() || null;
  const rejectionAcknowledged = Boolean(request?.rejection?.acknowledgedAt);
  const pill = statusPill(status);
  const needsReplaceUpload =
    !hasMaterial || isRejected || isFailed || showReplaceUpload || status === "NONE";

  return (
    <section className="space-y-3 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-indigo-950">자료등록</h3>
          <p className="text-xs text-indigo-900/80">
            {isCompleted
              ? "지식데이터 생성이 완료되었습니다. 다음 단계에서 구조화 결과를 확인하세요."
              : isProcessing || isPendingGeneration
                ? "자료가 등록되었습니다. 관리자 처리 상태를 확인하세요."
                : "자료 묶음(.zip)을 첨부해 지식데이터 생성을 요청하세요. 생성 작업은 관리자가 접수 후 진행합니다."}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${pill.className}`}
        >
          {pill.label}
        </span>
      </div>

      {hasMaterial ? (
        <dl className="space-y-1.5 rounded-xl border border-indigo-100 bg-white px-3 py-3 text-xs text-slate-700">
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">등록 자료</dt>
            <dd className="text-right font-medium text-slate-900">{request!.originalFileName}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">파일 크기</dt>
            <dd>{formatBytes(request!.fileSize)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">마지막 업로드</dt>
            <dd>{formatDateTime(request!.uploadedAt)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">지식데이터 생성</dt>
            <dd className={`font-semibold ${statusToneClass(status)}`}>{statusLabel(status)}</dd>
          </div>
          {state?.lastRun ? (
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">마지막 처리</dt>
              <dd>
                {lastRunLabel(state.lastRun.status)}
                {state.lastRun.finishedAt ? ` · ${formatDateTime(state.lastRun.finishedAt)}` : ""}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : (
        <p className="rounded-xl border border-dashed border-indigo-200 bg-white/70 px-3 py-3 text-xs text-slate-500">
          아직 등록된 자료가 없습니다. ZIP을 첨부해 요청하세요.
        </p>
      )}

      {isRejected ? (
        <div className="space-y-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-800">
          <p className="font-semibold">생성 요청 반려</p>
          <p className="mt-0.5">
            관리자가 지식데이터 생성 요청을 반려했습니다. 안내된 사유를 확인한 뒤 ZIP 파일을 수정해
            다시 요청해 주세요.
          </p>
          {rejectionReason ? (
            <p className="mt-1 whitespace-pre-wrap rounded-lg bg-white/70 px-2 py-1 text-red-900">
              사유: {rejectionReason}
            </p>
          ) : null}
          {rejectionAcknowledged ? (
            <p className="text-[11px] text-red-700">반려 사유를 확인했습니다. ZIP을 수정해 다시 요청하세요.</p>
          ) : (
            <button
              type="button"
              onClick={() => void onAcknowledgeRejection()}
              disabled={!editable || acknowledging || submitting}
              className="min-h-[36px] w-full rounded-xl border border-red-200 bg-white px-3 text-xs font-semibold text-red-800 disabled:opacity-60"
            >
              {acknowledging ? "확인 중…" : "반려 사유 확인"}
            </button>
          )}
        </div>
      ) : null}

      {isFailed ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-800">
          <p className="font-semibold">처리 실패</p>
          <p className="mt-0.5">
            지식데이터 생성에 실패했습니다. 자료를 교체한 뒤 다시 요청하거나 관리자 안내를 확인하세요.
          </p>
        </div>
      ) : null}

      {state?.reviewMemo && !isRejected ? (
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <p className="font-semibold">관리자 보완요청</p>
          <p className="mt-0.5 whitespace-pre-wrap">{state.reviewMemo}</p>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {/* Primary CTAs by persisted status */}
      {isCompleted ? (
        <button
          type="button"
          onClick={() => onGoToKnowledge?.()}
          className="min-h-[44px] w-full rounded-xl bg-indigo-600 px-3 text-sm font-bold text-white"
        >
          데이터 구조화 결과 확인
        </button>
      ) : null}

      {isProcessing ? (
        <button
          type="button"
          onClick={() => void onRefresh()}
          disabled={refreshing}
          className="min-h-[44px] w-full rounded-xl bg-indigo-600 px-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {refreshing ? "새로고침 중…" : "처리 상태 새로고침"}
        </button>
      ) : null}

      {isPendingGeneration ? (
        <button
          type="button"
          onClick={() => void onRefresh()}
          disabled={refreshing}
          className="min-h-[44px] w-full rounded-xl border border-indigo-200 bg-white px-3 text-sm font-semibold text-indigo-900 disabled:opacity-60"
        >
          {refreshing ? "새로고침 중…" : "처리 상태 새로고침"}
        </button>
      ) : null}

      {canWithdraw ? (
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => void onWithdraw()}
            disabled={!editable || withdrawing || submitting}
            className="min-h-[36px] w-full rounded-xl border border-red-200 bg-white px-3 text-xs font-semibold text-red-700 disabled:opacity-60"
          >
            {withdrawing ? "회수 중…" : "요청 회수"}
          </button>
          <p className="text-[11px] text-slate-500">
            접수 대기 상태에서만 회수할 수 있습니다. 관리자가 생성을 시작하면 회수할 수 없습니다.
          </p>
        </div>
      ) : null}

      {/* Upload / re-request — primary only when no material yet; otherwise secondary replace */}
      {hasMaterial && !needsReplaceUpload ? (
        <button
          type="button"
          onClick={() => setShowReplaceUpload(true)}
          disabled={!editable || submitting || isProcessing || isPendingGeneration}
          className="min-h-[40px] w-full rounded-xl border border-indigo-200 bg-white/80 px-3 text-xs font-semibold text-indigo-900 disabled:opacity-60"
        >
          자료 교체 업로드
        </button>
      ) : null}

      {needsReplaceUpload ? (
        <div className="space-y-3 rounded-xl border border-indigo-100 bg-white/80 p-3">
          {hasMaterial ? (
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-indigo-950">자료 교체 업로드</p>
              {isCompleted || isPendingGeneration || isProcessing ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowReplaceUpload(false);
                    setFile(null);
                    setError(null);
                  }}
                  className="text-[11px] font-semibold text-slate-500"
                >
                  닫기
                </button>
              ) : null}
            </div>
          ) : null}

          <details className="rounded-xl border border-indigo-100 bg-indigo-50/50 px-3 py-2 text-xs text-slate-700">
            <summary className="cursor-pointer font-semibold text-indigo-900">
              업로드 전 확인해 주세요
            </summary>
            <div className="mt-2 space-y-2 leading-relaxed">
              <p className="text-slate-600">
                지식데이터 생성에 필요하지 않거나 보안상 처리할 수 없는 파일은 자동 제외됩니다.
                가능하면 ZIP을 첨부하기 전에 아래 파일은 원본에서 제거해 주세요.
              </p>
              <ul className="list-disc space-y-0.5 pl-4 text-slate-600">
                <li>실행 파일: exe, dll, msi</li>
                <li>스크립트 파일: bat, cmd, ps1, sh</li>
                <li>압축 파일: zip, 7z, rar, tar, gz</li>
                <li>빌드/캐시 폴더: node_modules, dist, build, target, .next, .cache</li>
                <li>시스템 파일: .DS_Store, Thumbs.db</li>
                <li>대용량 또는 구조화 대상이 아닌 바이너리 파일</li>
              </ul>
              <p className="text-slate-500">
                제외된 파일은 지식데이터 생성에 사용되지 않으며, 처리 결과에서 제외 내역을 확인할 수 있습니다.
              </p>
            </div>
          </details>

          <input
            type="file"
            accept=".zip"
            disabled={!editable || submitting}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setError(null);
            }}
            className="block w-full text-xs text-slate-700 file:mr-3 file:min-h-[40px] file:rounded-xl file:border-0 file:bg-indigo-600 file:px-3 file:text-xs file:font-semibold file:text-white disabled:opacity-60"
          />

          <button
            type="button"
            onClick={() => void onRequest()}
            disabled={!editable || submitting || !file}
            className="min-h-[44px] w-full rounded-xl bg-indigo-600 px-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {submitting ? "요청 전송 중…" : "지식데이터 생성 요청"}
          </button>
        </div>
      ) : null}
    </section>
  );
}

function statusPill(status: RequestStatus): { label: string; className: string } {
  switch (status) {
    case "COMPLETED":
      return { label: "자료 완료", className: "bg-emerald-100 text-emerald-800" };
    case "PROCESSING":
      return { label: "처리 중", className: "bg-indigo-100 text-indigo-800" };
    case "REQUESTED":
    case "ACCEPTED":
      return { label: "처리 대기", className: "bg-sky-100 text-sky-800" };
    case "REJECTED":
    case "FAILED":
      return { label: "보완 필요", className: "bg-amber-100 text-amber-900" };
    default:
      return { label: "자료 미등록", className: "bg-slate-100 text-slate-700" };
  }
}

function statusLabel(status: RequestStatus): string {
  switch (status) {
    case "REQUESTED":
      return "생성 요청됨 (접수 대기)";
    case "ACCEPTED":
      return "접수완료 (생성 대기)";
    case "REJECTED":
      return "생성 요청 반려";
    case "PROCESSING":
      return "관리자 처리 중";
    case "COMPLETED":
      return "생성 완료";
    case "FAILED":
      return "처리 실패";
    default:
      return "대기";
  }
}

function statusToneClass(status: RequestStatus): string {
  switch (status) {
    case "COMPLETED":
      return "text-emerald-700";
    case "FAILED":
    case "REJECTED":
      return "text-red-700";
    case "PROCESSING":
      return "text-indigo-700";
    default:
      return "text-slate-700";
  }
}

function lastRunLabel(status: string): string {
  switch (status) {
    case "PASS":
      return "완료";
    case "FAIL":
      return "실패";
    case "RUNNING":
      return "진행 중";
    default:
      return status;
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
