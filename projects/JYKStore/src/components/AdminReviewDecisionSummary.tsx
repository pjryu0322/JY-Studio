"use client";

import { FormEvent, useState } from "react";
import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import {
  canApproveAdminReview,
  collectReviewBlockers,
  collectReviewRefreshReasons,
  collectReviewWarnings,
  detectSubmitSnapshotDrift,
  resolveReviewDecisionState,
  type ReviewDecisionState,
} from "@/lib/admin-review-decision";
import {
  acceptAdminReview,
  approveAdminReview,
  evaluateAdminReleaseGateApi,
  refreshAdminReviewReadinessApi,
  rejectAdminReview,
} from "@/lib/admin-review-api";
import { PackReviewStatus } from "@/lib/pack-review-status";
import {
  ADMIN_REVIEW_ACCEPT_BODY,
  ADMIN_REVIEW_ACCEPT_TITLE,
  ADMIN_REVIEW_ACCEPTED_HINT,
  ADMIN_REVIEW_ACCEPT_REQUIRED_HINT,
  ADMIN_REVIEW_CTA_ACCEPT,
  ADMIN_REVIEW_CTA_APPROVE,
  ADMIN_REVIEW_CTA_REJECT,
  ADMIN_REVIEW_CTA_REFRESH_ALL,
  ADMIN_REVIEW_CTA_RELEASE_GATE,
  ADMIN_REVIEW_DECISION_TITLE,
  ADMIN_REVIEW_ADVANCED_ACTIONS_TITLE,
  ADMIN_REVIEW_REFRESH_REASONS_TITLE,
  ADMIN_REVIEW_REJECT_COLLAPSED_HINT,
  ADMIN_REVIEW_REJECT_OPEN,
  ADMIN_REVIEW_STATE_BLOCKED_BODY,
  ADMIN_REVIEW_STATE_BLOCKED_TITLE,
  ADMIN_REVIEW_STATE_CHANGED_BODY,
  ADMIN_REVIEW_STATE_CHANGED_TITLE,
  ADMIN_REVIEW_STATE_GATE_REQUIRED_BODY,
  ADMIN_REVIEW_STATE_GATE_REQUIRED_TITLE,
  ADMIN_REVIEW_STATE_NOT_REVIEWING_BODY,
  ADMIN_REVIEW_STATE_NOT_REVIEWING_TITLE,
  ADMIN_REVIEW_STATE_PUBLISHED_BODY,
  ADMIN_REVIEW_STATE_PUBLISHED_TITLE,
  ADMIN_REVIEW_STATE_READY_BODY,
  ADMIN_REVIEW_STATE_READY_TITLE,
  ADMIN_REVIEW_STATE_REFRESH_REQUIRED_BODY,
  ADMIN_REVIEW_STATE_REFRESH_REQUIRED_TITLE,
  ADMIN_REVIEW_STATE_WARNING_BODY,
  ADMIN_REVIEW_STATE_WARNING_TITLE,
  ADMIN_REVIEW_SUBMIT_SNAPSHOT_TITLE,
} from "@/lib/role-based-ux-copy";

function decisionCopy(state: ReviewDecisionState): { title: string; body: string; tone: string } {
  switch (state) {
    case "review_refresh_required":
      return {
        title: ADMIN_REVIEW_STATE_REFRESH_REQUIRED_TITLE,
        body: ADMIN_REVIEW_STATE_REFRESH_REQUIRED_BODY,
        tone: "border-amber-200 bg-amber-50 text-amber-950",
      };
    case "submit_package_changed":
      return {
        title: ADMIN_REVIEW_STATE_CHANGED_TITLE,
        body: ADMIN_REVIEW_STATE_CHANGED_BODY,
        tone: "border-amber-200 bg-amber-50 text-amber-950",
      };
    case "release_gate_required":
      return {
        title: ADMIN_REVIEW_STATE_GATE_REQUIRED_TITLE,
        body: ADMIN_REVIEW_STATE_GATE_REQUIRED_BODY,
        tone: "border-amber-200 bg-amber-50 text-amber-950",
      };
    case "approval_ready":
      return {
        title: ADMIN_REVIEW_STATE_READY_TITLE,
        body: ADMIN_REVIEW_STATE_READY_BODY,
        tone: "border-emerald-200 bg-emerald-50 text-emerald-950",
      };
    case "approval_warning":
      return {
        title: ADMIN_REVIEW_STATE_WARNING_TITLE,
        body: ADMIN_REVIEW_STATE_WARNING_BODY,
        tone: "border-amber-200 bg-amber-50 text-amber-950",
      };
    case "approval_blocked":
      return {
        title: ADMIN_REVIEW_STATE_BLOCKED_TITLE,
        body: ADMIN_REVIEW_STATE_BLOCKED_BODY,
        tone: "border-red-200 bg-red-50 text-red-900",
      };
    case "already_published":
      return {
        title: ADMIN_REVIEW_STATE_PUBLISHED_TITLE,
        body: ADMIN_REVIEW_STATE_PUBLISHED_BODY,
        tone: "border-slate-200 bg-slate-50 text-slate-800",
      };
    default:
      return {
        title: ADMIN_REVIEW_STATE_NOT_REVIEWING_TITLE,
        body: ADMIN_REVIEW_STATE_NOT_REVIEWING_BODY,
        tone: "border-slate-200 bg-slate-50 text-slate-800",
      };
  }
}

export function AdminReviewDecisionSummary({
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
  const [busy, setBusy] = useState<"accept" | "approve" | "reject" | "gate" | "refresh" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);

  const state = resolveReviewDecisionState(detail);
  const copy = decisionCopy(state);
  const canApprove = canApproveAdminReview(detail);
  const isReviewing = detail.pack.status === "REVIEWING";
  const reviewStatus = detail.latestReview?.status ?? null;
  const needsAccept = isReviewing && reviewStatus === PackReviewStatus.PENDING;
  const isAccepted = isReviewing && reviewStatus === PackReviewStatus.IN_REVIEW;
  const canReject = isAccepted && rejectionReason.trim().length > 0;
  const blockers = collectReviewBlockers(detail);
  const warnings = collectReviewWarnings(detail);
  const refreshReasons = collectReviewRefreshReasons(detail);
  const snapshot = detail.latestReview?.submitSnapshot ?? null;
  const drift = detectSubmitSnapshotDrift(detail);
  const submittedVersionLabel = snapshot?.submittedVersionId
    ? detail.versions.find((v) => v.id === snapshot.submittedVersionId)?.version ??
      snapshot.submittedVersionId
    : null;

  const showRejectFormPrimary =
    isAccepted && (state === "approval_blocked" || state === "submit_package_changed");
  const showRejectFormSecondary =
    isAccepted &&
    (state === "approval_warning" || state === "approval_ready") &&
    (rejectOpen || state === "approval_warning");
  const showRejectCollapsed =
    isAccepted &&
    (state === "review_refresh_required" || state === "release_gate_required") &&
    !rejectOpen;
  const showAdvancedRefresh =
    isReviewing &&
    (state === "review_refresh_required" ||
      state === "submit_package_changed" ||
      Boolean(snapshot) ||
      state === "approval_ready" ||
      state === "approval_warning" ||
      state === "approval_blocked");
  const showPrimaryRefresh = state === "review_refresh_required" && !snapshot;
  const showDecisionActions = isAccepted;

  const onRefreshAll = async () => {
    setBusy("refresh");
    setError(null);
    setMessage(null);
    try {
      const res = await refreshAdminReviewReadinessApi(packId);
      onUpdated(res.detail);
      if (res.warnings && res.warnings.length > 0) {
        setMessage(`전체 재점검을 완료했습니다. (${res.warnings.join(" ")})`);
      } else {
        setMessage("최신 상태로 전체 재점검을 완료했습니다.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "전체 재점검에 실패했습니다.");
    } finally {
      setBusy(null);
    }
  };

  const onReleaseGate = async () => {
    setBusy("gate");
    setError(null);
    setMessage(null);
    try {
      const res = await evaluateAdminReleaseGateApi(packId);
      onUpdated(res.detail);
      setMessage("릴리스 게이트 최종 점검을 완료했습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "릴리스 게이트 점검에 실패했습니다.");
    } finally {
      setBusy(null);
    }
  };

  const onAccept = async () => {
    setBusy("accept");
    setError(null);
    setMessage(null);
    try {
      const res = await acceptAdminReview(packId);
      onUpdated(res.detail);
      setMessage("검수 요청을 접수했습니다. 제공자는 더 이상 회수할 수 없습니다.");
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
      <h2 className="text-sm font-bold text-slate-900">{ADMIN_REVIEW_DECISION_TITLE}</h2>

      <div className={`rounded-xl border p-3 ${copy.tone}`}>
        <p className="text-sm font-bold">현재 상태: {copy.title}</p>
        <p className="mt-1 text-xs leading-relaxed">{copy.body}</p>
      </div>

      {needsAccept ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
          <p className="text-sm font-bold text-sky-950">{ADMIN_REVIEW_ACCEPT_TITLE}</p>
          <p className="mt-1 text-xs leading-relaxed text-sky-900">{ADMIN_REVIEW_ACCEPT_BODY}</p>
          <p className="mt-2 text-xs font-semibold text-sky-900">{ADMIN_REVIEW_ACCEPT_REQUIRED_HINT}</p>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void onAccept()}
            className="mt-3 min-h-[48px] w-full rounded-xl bg-store-accent text-sm font-bold text-white disabled:opacity-50"
          >
            {busy === "accept" ? "접수 중…" : ADMIN_REVIEW_CTA_ACCEPT}
          </button>
        </div>
      ) : null}

      {isAccepted ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-950">
          {ADMIN_REVIEW_ACCEPTED_HINT}
        </div>
      ) : null}

      {snapshot ? (
        <div className="rounded-xl border border-store-border bg-slate-50 p-3">
          <p className="text-xs font-bold text-slate-900">{ADMIN_REVIEW_SUBMIT_SNAPSHOT_TITLE}</p>
          <ul className="mt-2 space-y-1 text-xs text-slate-700">
            <li>제출일시: {snapshot.submittedAt.replace("T", " ").slice(0, 16)}</li>
            {submittedVersionLabel ? <li>제출 버전: {submittedVersionLabel}</li> : null}
            <li>원천 문서: {snapshot.sourceDocumentCount}개</li>
            <li>검수용 Chunk: {snapshot.activeChunkCount}개</li>
            {snapshot.retrievalEvaluationRunId ? (
              <li>검색 평가 Run: {snapshot.retrievalEvaluationRunId}</li>
            ) : null}
            <li>릴리스 게이트: {snapshot.releaseGateStatus}</li>
            {snapshot.warnings.length > 0 ? (
              <li>주의 항목: {snapshot.warnings.length}개</li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {(state === "review_refresh_required" || state === "submit_package_changed") &&
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
            </p>
          ) : null}
        </div>
      ) : null}

      {blockers.length > 0 && state === "approval_blocked" ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="text-xs font-bold text-red-900">차단 이슈</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-red-800">
            {blockers.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {warnings.length > 0 && (state === "approval_warning" || state === "approval_ready") ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-bold text-amber-950">주의 이슈</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-amber-900">
            {warnings.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {detail.latestReview?.rejectionReason ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
          최근 반려 사유: {detail.latestReview.rejectionReason}
        </div>
      ) : null}

      {showPrimaryRefresh ? (
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void onRefreshAll()}
          className="min-h-[48px] w-full rounded-xl bg-store-accent text-sm font-bold text-white disabled:opacity-50"
        >
          {busy === "refresh" ? "재점검 중…" : ADMIN_REVIEW_CTA_REFRESH_ALL}
        </button>
      ) : null}

      {state === "release_gate_required" ? (
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void onReleaseGate()}
          className="min-h-[48px] w-full rounded-xl bg-store-accent text-sm font-bold text-white disabled:opacity-50"
        >
          {busy === "gate" ? "점검 중…" : ADMIN_REVIEW_CTA_RELEASE_GATE}
        </button>
      ) : null}

      {isReviewing &&
      showDecisionActions &&
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
        <form onSubmit={onApprove}>
          <button
            type="submit"
            disabled={!canApprove || busy !== null}
            className="min-h-[48px] w-full rounded-xl bg-store-accent text-sm font-bold text-white disabled:opacity-50"
          >
            {busy === "approve" ? "승인 중…" : ADMIN_REVIEW_CTA_APPROVE}
          </button>
        </form>
      ) : null}

      {showDecisionActions && (showRejectFormPrimary || showRejectFormSecondary) ? rejectForm : null}

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

      {showAdvancedRefresh && !showPrimaryRefresh ? (
        <details className="rounded-xl border border-dashed border-store-border bg-slate-50 p-3">
          <summary className="cursor-pointer text-xs font-bold text-slate-700">
            {ADMIN_REVIEW_ADVANCED_ACTIONS_TITLE}
          </summary>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void onRefreshAll()}
            className="mt-3 min-h-[44px] w-full rounded-xl border border-store-border bg-white text-sm font-semibold text-slate-800 disabled:opacity-50"
          >
            {busy === "refresh" ? "재점검 중…" : ADMIN_REVIEW_CTA_REFRESH_ALL}
          </button>
        </details>
      ) : null}

      {message ? <p className="text-sm font-semibold text-emerald-800">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
