"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchProviderWorkerZipRequestStateApi,
  requestProviderWorkerZipGenerationApi,
  withdrawProviderWorkerZipRequestApi,
  type ProviderWorkerZipRequestState,
} from "@/lib/provider-center-api";

/**
 * P7.3: 문서 ZIP 등록 + 지식데이터 생성 요청 카드.
 *
 * 역할 분리: 제공자는 자료(.zip)를 첨부하고 "생성 요청"까지만 수행한다. 실제 지식데이터
 * 생성(Worker 실행)은 관리자가 접수 후 실행한다. 이 화면에는 실행 버튼이 없고, 내부
 * 용어(Python Worker / pgvector / 구조화 엔진)는 노출하지 않는다.
 */
export function ProviderWorkerZipImportCard({
  packId,
  editable,
}: {
  readonly packId: string;
  readonly editable: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<ProviderWorkerZipRequestState | null>(null);

  const loadState = useCallback(async () => {
    try {
      const next = await fetchProviderWorkerZipRequestStateApi(packId);
      setState(next);
    } catch {
      // Non-fatal: the card still allows a new request.
    }
  }, [packId]);

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

  const request = state?.request ?? null;
  const status = state?.requestStatus ?? "NONE";
  const canWithdraw = status === "REQUESTED";

  return (
    <section className="space-y-3 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 shadow-card">
      <div className="space-y-1">
        <h3 className="text-sm font-bold text-indigo-950">문서 ZIP 등록</h3>
        <p className="text-xs text-indigo-900/80">
          자료 묶음(.zip)을 첨부해 지식데이터 생성을 요청하세요. 생성 작업은 관리자가 접수 후
          진행하며, 완료되면 이 화면에서 처리 결과를 확인할 수 있습니다.
        </p>
      </div>

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

      {error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {request ? (
        <dl className="space-y-1 rounded-xl border border-indigo-100 bg-white px-3 py-2 text-xs text-slate-700">
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">첨부 파일</dt>
            <dd className="font-medium text-slate-900">{request.originalFileName}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">파일 크기</dt>
            <dd>{formatBytes(request.fileSize)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">요청 일시</dt>
            <dd>{formatDateTime(request.uploadedAt)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">요청 상태</dt>
            <dd className={`font-semibold ${statusToneClass(status)}`}>{statusLabel(status)}</dd>
          </div>
          {canWithdraw ? (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => void onWithdraw()}
                disabled={!editable || withdrawing || submitting}
                className="min-h-[36px] w-full rounded-xl border border-red-200 bg-white px-3 text-xs font-semibold text-red-700 disabled:opacity-60"
              >
                {withdrawing ? "회수 중…" : "요청 회수"}
              </button>
              <p className="mt-1 text-[11px] text-slate-500">
                접수 대기 상태에서만 회수할 수 있습니다. 관리자가 생성을 시작하면 회수할 수 없습니다.
              </p>
            </div>
          ) : null}
        </dl>
      ) : (
        <p className="text-xs text-slate-500">아직 등록된 자료가 없습니다. ZIP을 첨부해 요청하세요.</p>
      )}

      {state?.lastRun ? (
        <p className="text-xs text-slate-500">
          마지막 처리 결과: {lastRunLabel(state.lastRun.status)}
          {state.lastRun.finishedAt ? ` · ${formatDateTime(state.lastRun.finishedAt)}` : ""}
        </p>
      ) : null}

      {state?.reviewMemo ? (
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <p className="font-semibold">관리자 보완요청</p>
          <p className="mt-0.5 whitespace-pre-wrap">{state.reviewMemo}</p>
        </div>
      ) : null}
    </section>
  );
}

function statusLabel(status: ProviderWorkerZipRequestState["requestStatus"]): string {
  switch (status) {
    case "REQUESTED":
      return "생성 요청됨 (접수 대기)";
    case "ACCEPTED":
      return "접수완료 (생성 대기)";
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

function statusToneClass(status: ProviderWorkerZipRequestState["requestStatus"]): string {
  switch (status) {
    case "COMPLETED":
      return "text-emerald-700";
    case "FAILED":
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
