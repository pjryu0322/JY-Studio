"use client";

import { FormEvent, useState } from "react";
import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import {
  canAcceptAdminReview,
  canApproveAdminReview,
  canRejectWithoutAccept,
  collectAcceptBlockers,
  collectReviewRefreshReasons,
  detectSubmitSnapshotDrift,
  resolveDecisionStatusCopy,
  resolveReviewDecisionState,
} from "@/lib/admin-review-decision";
import {
  acceptAdminReview,
  approveAdminReview,
  rejectAdminReview,
} from "@/lib/admin-review-api";
import {
  isAcceptedAdminReview,
  isPendingAdminReview,
} from "@/lib/admin-review-tabs";
import {
  ADMIN_REVIEW_ACCEPT_BLOCKED_BODY,
  ADMIN_REVIEW_ACCEPT_BLOCKED_TITLE,
  ADMIN_REVIEW_ACCEPT_TITLE,
  ADMIN_REVIEW_BLOCKER_ISSUES_TITLE,
  ADMIN_REVIEW_CTA_ACCEPT,
  ADMIN_REVIEW_CTA_APPROVE,
  ADMIN_REVIEW_CTA_REJECT,
  ADMIN_REVIEW_DECISION_TITLE,
  ADMIN_REVIEW_REFRESH_REASONS_TITLE,
  ADMIN_REVIEW_REJECT_COLLAPSED_HINT,
  ADMIN_REVIEW_REJECT_OPEN,
  ADMIN_REVIEW_SUBMIT_INFO_TITLE,
} from "@/lib/role-based-ux-copy";

export function AdminReviewAcceptTab({
  packId,
  detail,
  onUpdated,
}: {
  readonly packId: string;
  readonly detail: AdminReviewDetailDto;
  readonly onUpdated: (detail: AdminReviewDetailDto) => void;
}) {
  const [memo, setMemo] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [publishAsVerified, setPublishAsVerified] = useState(false);
  const [busy, setBusy] = useState<"accept" | "approve" | "reject" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);

  const needsAccept = isPendingAdminReview(detail);
  const isAccepted = isAcceptedAdminReview(detail);
  const canAccept = canAcceptAdminReview(detail);
  const canRejectPending = canRejectWithoutAccept(detail);
  const state = resolveReviewDecisionState(detail);
  const statusCopy = resolveDecisionStatusCopy(detail);
  const canApprove = canApproveAdminReview(detail);
  const canReject = (isAccepted || canRejectPending) && rejectionReason.trim().length > 0;
  const acceptBlockers = collectAcceptBlockers(detail);
  const refreshReasons = collectReviewRefreshReasons(detail);
  const snapshot = detail.latestReview?.submitSnapshot ?? null;
  const drift = detectSubmitSnapshotDrift(detail);
  const submittedVersionLabel = snapshot?.submittedVersionId
    ? detail.versions.find((v) => v.id === snapshot.submittedVersionId)?.version ??
      snapshot.submittedVersionId
    : null;

  const showRejectFormPrimary =
    (isAccepted || canRejectPending) &&
    (state === "approval_blocked" ||
      state === "submit_package_changed" ||
      canRejectPending);
  const showRejectFormSecondary =
    isAccepted &&
    (state === "approval_warning" || state === "approval_ready") &&
    (rejectOpen || state === "approval_warning");
  const showRejectCollapsed =
    isAccepted &&
    (state === "review_refresh_required" || state === "release_gate_required") &&
    !rejectOpen;
  const showDecisionActions = isAccepted;

  const onAccept = async () => {
    setBusy("accept");
    setError(null);
    setMessage(null);
    try {
      const res = await acceptAdminReview(packId);
      onUpdated(res.detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "검수 접수에 실패했습니다.");
    } finally {
      setBusy(null);
    }
  };

  const onApprove = async (e: FormEvent) => {
    e.preventDefault();
    if (!canApprove) return;
    setBusy("approve");
    setError(null);
    setMessage(null);
    try {
      const res = await approveAdminReview(packId, {
        memo: memo.trim() || undefined,
        publishAsVerified,
      });
      onUpdated(res.detail);
      setMessage("승인되었습니다. 일반 카탈로그와 Context API에 노출됩니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "승인에 실패했습니다.");
    } finally {
      setBusy(null);
    }
  };

  const onReject = async (e: FormEvent) => {
    e.preventDefault();
    if (!canReject) return;
    setBusy("reject");
    setError(null);
    setMessage(null);
    try {
      const res = await rejectAdminReview(packId, {
        memo: memo.trim() || undefined,
        rejectionReason: rejectionReason.trim(),
      });
      onUpdated(res.detail);
      setMessage("반려되었습니다. 제공자는 초안(DRAFT)에서 다시 수정할 수 있습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "반려에 실패했습니다.");
    } finally {
      setBusy(null);
    }
  };

  const rejectForm = (
    <>
      <label className="block text-xs font-semibold text-slate-700" htmlFor="rejection-reason">
        반려 사유
      </label>
      <textarea
        id="rejection-reason"
        value={rejectionReason}
        onChange={(e) => setRejectionReason(e.target.value)}
        rows={2}
        placeholder={"예:\n- 검색 품질 평가가 기준에 미달합니다.\n- 원천 문서 출처 확인이 필요합니다."}
        className="w-full rounded-xl border border-store-border px-3 py-2 text-sm"
      />
      <form onSubmit={onReject}>
        <button
          type="submit"
          disabled={!canReject || busy !== null}
          className="min-h-[48px] w-full rounded-xl border-2 border-red-200 bg-white text-sm font-bold text-red-800 disabled:opacity-50"
        >
          {busy === "reject" ? "반려 중…" : ADMIN_REVIEW_CTA_REJECT}
        </button>
      </form>
    </>
  );

  return (
    <section className="space-y-4 rounded-2xl border border-store-border bg-white p-4 shadow-card">
      {needsAccept ? (
        <h2 className="text-sm font-bold text-slate-900">
          {canAccept ? ADMIN_REVIEW_ACCEPT_TITLE : ADMIN_REVIEW_ACCEPT_BLOCKED_TITLE}
        </h2>
      ) : (
        <h2 className="text-sm font-bold text-slate-900">{ADMIN_REVIEW_DECISION_TITLE}</h2>
      )}

      {!needsAccept ? (
        <div className={`rounded-xl border p-3 ${statusCopy.tone}`}>
          <p className="text-sm font-bold">현재 상태: {statusCopy.title}</p>
          {statusCopy.body ? (
            <p className="mt-1 text-xs leading-relaxed">{statusCopy.body}</p>
          ) : null}
        </div>
      ) : null}

      {needsAccept && !canAccept ? (
        <p className="text-xs leading-relaxed text-slate-700">{ADMIN_REVIEW_ACCEPT_BLOCKED_BODY}</p>
      ) : null}

      {needsAccept && snapshot ? (
        <div className="rounded-xl border border-store-border bg-slate-50 p-3">
          <p className="text-xs font-bold text-slate-900">{ADMIN_REVIEW_SUBMIT_INFO_TITLE}</p>
          <ul className="mt-2 space-y-1 text-xs text-slate-700">
            <li>지식팩: {detail.pack.name}</li>
            <li>제공자: {detail.pack.providerName}</li>
            <li>제출일시: {snapshot.submittedAt.replace("T", " ").slice(0, 16)}</li>
            {submittedVersionLabel ? <li>제출 버전: {submittedVersionLabel}</li> : null}
            {"mode" in snapshot && snapshot.mode === "DISTRIBUTION" ? (
              <li>모드: Distribution · Profile {snapshot.payloadProfile}</li>
            ) : "mode" in snapshot && snapshot.mode === "DOCLING_BUNDLE" ? (
              <li>
                모드: Docling Bundle · Schema {snapshot.doclingSchemaVersion ?? "—"}
              </li>
            ) : "releaseGateStatus" in snapshot ? (
              <li>릴리스 게이트: {snapshot.releaseGateStatus}</li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {needsAccept && acceptBlockers.length > 0 ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="text-xs font-bold text-red-900">{ADMIN_REVIEW_BLOCKER_ISSUES_TITLE}</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-red-800">
            {acceptBlockers.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {isAccepted &&
      (state === "review_refresh_required" || state === "submit_package_changed") &&
      refreshReasons.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-bold text-amber-950">
            {state === "submit_package_changed"
              ? "제출 후 변경 감지"
              : ADMIN_REVIEW_REFRESH_REASONS_TITLE}
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-amber-900">
            {refreshReasons.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {state === "submit_package_changed" && drift.changed ? (
            <p className="mt-2 text-xs text-amber-900">
              관리자는 기존 제출 패키지 기준으로 판단하거나 제공자에게 재제출을 요청할 수 있습니다.
              제출 패키지와 주의 항목을 확인하거나 제공자에게 재제출을 요청하세요.
            </p>
          ) : null}
        </div>
      ) : null}

      {detail.latestReview?.rejectionReason ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
          최근 반려 사유: {detail.latestReview.rejectionReason}
        </div>
      ) : null}

      {needsAccept && canAccept ? (
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void onAccept()}
          className="min-h-[48px] w-full rounded-xl bg-store-accent text-sm font-bold text-white disabled:opacity-50"
        >
          {busy === "accept" ? "접수 중…" : ADMIN_REVIEW_CTA_ACCEPT}
        </button>
      ) : null}

      {showDecisionActions &&
      (state === "approval_ready" ||
        state === "approval_warning" ||
        state === "submit_package_changed" ||
        showRejectFormPrimary) ? (
        <>
          <label className="block text-xs font-semibold text-slate-700" htmlFor="review-memo">
            검수 메모 (선택)
          </label>
          <textarea
            id="review-memo"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-store-border px-3 py-2 text-sm"
          />
        </>
      ) : null}

      {showDecisionActions &&
      (canApprove ||
        state === "approval_warning" ||
        state === "approval_ready" ||
        state === "submit_package_changed") ? (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={publishAsVerified}
            onChange={(e) => setPublishAsVerified(e.target.checked)}
            className="h-4 w-4"
          />
          VERIFIED로 승인 (기본은 PUBLISHED)
        </label>
      ) : null}

      {showDecisionActions && (state === "approval_ready" || state === "approval_warning") ? (
        <form onSubmit={onApprove} className="space-y-2">
          {detail.distribution ? (
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              Provider 공개범위 <strong>{detail.distribution.visibility}</strong>
              {detail.distribution.allowDownload ? " · 다운로드 허용" : " · 다운로드 비허용"} —
              승인 시 이 값이 유지됩니다.
            </p>
          ) : null}
          <button
            type="submit"
            disabled={!canApprove || busy !== null}
            className="min-h-[48px] w-full rounded-xl bg-store-accent text-sm font-bold text-white disabled:opacity-50"
          >
            {busy === "approve" ? "승인 중…" : ADMIN_REVIEW_CTA_APPROVE}
          </button>
        </form>
      ) : null}

      {(showDecisionActions && (showRejectFormPrimary || showRejectFormSecondary)) ||
      (needsAccept && canRejectPending) ? (
        rejectForm
      ) : null}

      {showDecisionActions && showRejectCollapsed ? (
        <div className="rounded-xl border border-dashed border-store-border bg-slate-50 p-3">
          <p className="text-xs text-store-muted">{ADMIN_REVIEW_REJECT_COLLAPSED_HINT}</p>
          <button
            type="button"
            onClick={() => setRejectOpen(true)}
            className="mt-2 text-xs font-semibold text-store-accent underline-offset-2 hover:underline"
          >
            {ADMIN_REVIEW_REJECT_OPEN}
          </button>
        </div>
      ) : null}

      {showDecisionActions &&
      rejectOpen &&
      (state === "review_refresh_required" || state === "release_gate_required") ? (
        <div className="space-y-3 border-t border-store-border pt-3">{rejectForm}</div>
      ) : null}

      {message ? <p className="text-sm font-semibold text-emerald-800">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
