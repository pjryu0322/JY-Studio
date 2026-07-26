"use client";

import { useCallback, useEffect, useState } from "react";
import {
  acceptAdminWorkerZipRequest,
  cancelAdminWorkerZipRejection,
  fetchAdminWorkerZipRequestState,
  rejectAdminWorkerZipRequest,
  type AdminWorkerZipRequestState,
} from "@/lib/admin-review-api";
import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import { adminReviewDetailPath } from "@/lib/routes";

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("ko-KR");
}

function acceptanceStatusBadge(
  status: AdminWorkerZipRequestState["requestStatus"],
): { label: string; className: string } {
  switch (status) {
    case "REQUESTED":
      return { label: "접수 대기", className: "bg-indigo-100 text-indigo-900" };
    case "ACCEPTED":
      return { label: "접수 완료", className: "bg-emerald-100 text-emerald-900" };
    case "REJECTED":
      return { label: "반려됨", className: "bg-red-100 text-red-900" };
    case "PROCESSING":
      return { label: "생성 진행 중", className: "bg-sky-100 text-sky-900" };
    case "COMPLETED":
      return { label: "생성 완료", className: "bg-slate-900 text-white" };
    case "FAILED":
      return { label: "생성 실패", className: "bg-amber-100 text-amber-950" };
    default:
      return { label: "요청 없음", className: "bg-slate-100 text-slate-700" };
  }
}

/**
 * Workbench step1 — 자료 접수 only (accept / reject). No generation/quality actions.
 */
export function AdminMaterialAcceptancePanel({
  packId,
  detail,
  onPhaseChange,
  onChanged,
  onGoGeneration,
}: {
  readonly packId: string;
  readonly detail: AdminReviewDetailDto;
  readonly onPhaseChange?: (phase: AdminWorkerZipRequestState["requestStatus"]) => void;
  readonly onChanged?: () => Promise<void> | void;
  readonly onGoGeneration?: () => void;
}) {
  const [state, setState] = useState<AdminWorkerZipRequestState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [cancellingRejection, setCancellingRejection] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const loadState = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchAdminWorkerZipRequestState(packId);
      setState(next);
      onPhaseChange?.(next.requestStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : "자료 요청 상태를 불러오지 못했습니다.");
      setState(null);
    } finally {
      setLoading(false);
    }
  }, [packId, onPhaseChange]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const status = state?.requestStatus ?? "NONE";
  const request = state?.request ?? null;
  const badge = acceptanceStatusBadge(status);
  const canAccept = status === "REQUESTED";
  const canReject = status === "REQUESTED";
  const rejection = request?.rejection ?? null;
  const canCancelRejection =
    status === "REJECTED" && Boolean(rejection) && !rejection?.acknowledgedAt;
  const showGoGeneration =
    status === "ACCEPTED" ||
    status === "PROCESSING" ||
    status === "COMPLETED" ||
    status === "FAILED";

  const versionLabel = detail.versions[0]?.version?.trim() || null;
  const submittedAt = request?.uploadedAt ?? detail.pack.updatedAt;

  const onAccept = async () => {
    setAccepting(true);
    setError(null);
    try {
      await acceptAdminWorkerZipRequest(packId);
      await loadState();
      await onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "자료 접수에 실패했습니다.");
    } finally {
      setAccepting(false);
    }
  };

  const onReject = async () => {
    const reason = rejectReason.trim();
    if (!reason) {
      setError("반려 사유를 입력해 주세요.");
      return;
    }
    setRejecting(true);
    setError(null);
    try {
      await rejectAdminWorkerZipRequest(packId, reason);
      setShowRejectForm(false);
      setRejectReason("");
      await loadState();
      await onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "자료 반려에 실패했습니다.");
    } finally {
      setRejecting(false);
    }
  };

  const onCancelRejection = async () => {
    if (cancellingRejection) return;
    setCancellingRejection(true);
    setError(null);
    try {
      await cancelAdminWorkerZipRejection(packId);
      await loadState();
      await onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "반려 취소에 실패했습니다.");
    } finally {
      setCancellingRejection(false);
    }
  };

  if (loading && !state) {
    return <p className="text-sm text-store-muted">자료 접수 정보를 불러오는 중…</p>;
  }

  return (
    <section className="space-y-4 rounded-2xl border border-store-border bg-white px-4 py-4 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-bold text-slate-900">자료 접수</h2>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badge.className}`}
        >
          {badge.label}
        </span>
      </div>
      <p className="text-xs text-store-muted">
        제출된 원본/ZIP 자료를 확인한 뒤 접수하거나 반려합니다. 생성 실행은 다음 단계에서
        진행합니다.
      </p>

      <div>
        <h3 className="text-xs font-bold text-slate-800">제출 정보</h3>
        <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <dt className="text-store-muted">지식팩명</dt>
            <dd className="mt-0.5 font-semibold text-slate-900">{detail.pack.name}</dd>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <dt className="text-store-muted">Pack ID</dt>
            <dd className="mt-0.5 font-mono text-[11px] text-slate-800">{packId}</dd>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <dt className="text-store-muted">제공자</dt>
            <dd className="mt-0.5 font-semibold text-slate-900">{detail.pack.providerName}</dd>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <dt className="text-store-muted">카테고리</dt>
            <dd className="mt-0.5 font-semibold text-slate-900">
              {detail.pack.categoryId || "-"}
            </dd>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <dt className="text-store-muted">버전</dt>
            <dd className="mt-0.5 font-semibold text-slate-900">{versionLabel || "-"}</dd>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <dt className="text-store-muted">제출일시</dt>
            <dd className="mt-0.5 font-semibold text-slate-900">
              {formatDateTime(submittedAt)}
            </dd>
          </div>
        </dl>
      </div>

      <div>
        <h3 className="text-xs font-bold text-slate-800">첨부 자료</h3>
        {request ? (
          <dl className="mt-2 space-y-1 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">파일명</dt>
              <dd className="font-medium text-slate-900">{request.originalFileName}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">파일 크기</dt>
              <dd>{formatBytes(request.fileSize)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">요청일시</dt>
              <dd>{formatDateTime(request.uploadedAt)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">요청 상태</dt>
              <dd className="font-semibold text-slate-900">{badge.label}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            아직 제출된 ZIP/원본 요청이 없습니다. 제공자에게 자료 등록을 요청하세요.
          </p>
        )}
      </div>

      <div>
        <h3 className="text-xs font-bold text-slate-800">접수 판단</h3>
        <p className="mt-1 text-xs text-slate-700">
          {canAccept
            ? "접수 가능합니다. 자료에 문제가 없으면 접수하고, 원본 자체가 잘못되었으면 반려하세요."
            : status === "REJECTED"
              ? "이 요청은 반려되었습니다."
              : status === "NONE"
                ? "접수할 ZIP 요청이 없어 접수할 수 없습니다."
                : "이미 접수되었거나 생성 단계로 넘어간 요청입니다."}
        </p>
        {request?.rejection?.reason ? (
          <p className="mt-2 whitespace-pre-wrap rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-900">
            반려 사유: {request.rejection.reason}
          </p>
        ) : null}
        {status === "REJECTED" && rejection?.acknowledgedAt ? (
          <p className="mt-1 text-[11px] text-red-700">
            제공자가 반려 사유를 확인했습니다. ({formatDateTime(rejection.acknowledgedAt)})
          </p>
        ) : status === "REJECTED" && canCancelRejection ? (
          <p className="mt-1 text-[11px] text-red-700">
            제공자가 반려 사유를 확인하기 전에는 반려를 취소할 수 있습니다.
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {error}
        </p>
      ) : null}

      <div className="space-y-2 border-t border-slate-100 pt-3">
        {canAccept ? (
          <button
            type="button"
            onClick={() => void onAccept()}
            disabled={accepting || rejecting || cancellingRejection}
            className="min-h-[44px] w-full rounded-xl bg-store-accent px-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {accepting ? "접수 중…" : "자료 접수"}
          </button>
        ) : null}

        {canCancelRejection ? (
          <button
            type="button"
            onClick={() => void onCancelRejection()}
            disabled={cancellingRejection}
            className="min-h-[44px] w-full rounded-xl border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 disabled:opacity-60"
          >
            {cancellingRejection ? "반려 취소 중…" : "반려 취소"}
          </button>
        ) : null}

        {showGoGeneration ? (
          <button
            type="button"
            onClick={() => {
              if (onGoGeneration) onGoGeneration();
              else window.location.assign(`${adminReviewDetailPath(packId)}?step=generation`);
            }}
            className="min-h-[44px] w-full rounded-xl bg-slate-900 px-3 text-sm font-bold text-white"
          >
            {status === "PROCESSING" ? "생성 진행상황 보기" : "생성·품질보정으로 이동"}
          </button>
        ) : null}

        {canReject && status === "REQUESTED" ? (
          <button
            type="button"
            onClick={() => {
              setShowRejectForm((v) => !v);
              setError(null);
            }}
            disabled={accepting || rejecting}
            className="min-h-[44px] w-full rounded-xl border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 disabled:opacity-60"
          >
            자료 반려
          </button>
        ) : null}

        {showRejectForm && canReject && status === "REQUESTED" ? (
          <div className="space-y-2 rounded-xl border border-red-100 bg-red-50/60 px-3 py-2">
            <p className="text-xs font-semibold text-red-900">자료 반려 사유 (필수)</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="예: 구조화 대상 문서가 부족합니다. 매뉴얼/샘플 문서를 포함해 다시 요청해 주세요."
              className="w-full rounded-lg border border-red-200 bg-white px-2 py-1 text-xs text-slate-800"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void onReject()}
                disabled={rejecting || !rejectReason.trim()}
                className="min-h-[36px] flex-1 rounded-xl bg-red-600 px-3 text-xs font-bold text-white disabled:opacity-60"
              >
                {rejecting ? "반려 처리 중…" : "반려 처리"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowRejectForm(false);
                  setRejectReason("");
                }}
                disabled={rejecting}
                className="min-h-[36px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 disabled:opacity-60"
              >
                취소
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
