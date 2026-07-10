"use client";

import { FormEvent, useState } from "react";
import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import {
  canApproveAdminReview,
  collectReviewBlockers,
  collectReviewWarnings,
  resolveReviewDecisionState,
  type ReviewDecisionState,
} from "@/lib/admin-review-decision";
import { approveAdminReview, evaluateAdminReleaseGateApi, rejectAdminReview } from "@/lib/admin-review-api";
import {
  ADMIN_REVIEW_CTA_APPROVE,
  ADMIN_REVIEW_CTA_REJECT,
  ADMIN_REVIEW_CTA_RELEASE_GATE,
  ADMIN_REVIEW_DECISION_TITLE,
  ADMIN_REVIEW_STATE_BLOCKED_BODY,
  ADMIN_REVIEW_STATE_BLOCKED_TITLE,
  ADMIN_REVIEW_STATE_GATE_REQUIRED_BODY,
  ADMIN_REVIEW_STATE_GATE_REQUIRED_TITLE,
  ADMIN_REVIEW_STATE_NOT_REVIEWING_BODY,
  ADMIN_REVIEW_STATE_NOT_REVIEWING_TITLE,
  ADMIN_REVIEW_STATE_PUBLISHED_BODY,
  ADMIN_REVIEW_STATE_PUBLISHED_TITLE,
  ADMIN_REVIEW_STATE_READY_BODY,
  ADMIN_REVIEW_STATE_READY_TITLE,
  ADMIN_REVIEW_STATE_WARNING_BODY,
  ADMIN_REVIEW_STATE_WARNING_TITLE,
} from "@/lib/role-based-ux-copy";

function decisionCopy(state: ReviewDecisionState): { title: string; body: string; tone: string } {
  switch (state) {
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
  const [busy, setBusy] = useState<"approve" | "reject" | "gate" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const state = resolveReviewDecisionState(detail);
  const copy = decisionCopy(state);
  const canApprove = canApproveAdminReview(detail);
  const isReviewing = detail.pack.status === "REVIEWING";
  const canReject = isReviewing && rejectionReason.trim().length > 0;
  const blockers = collectReviewBlockers(detail);
  const warnings = collectReviewWarnings(detail);

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

  return (
    <section className="space-y-4 rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <h2 className="text-sm font-bold text-slate-900">{ADMIN_REVIEW_DECISION_TITLE}</h2>

      <div className={`rounded-xl border p-3 ${copy.tone}`}>
        <p className="text-sm font-bold">현재 상태: {copy.title}</p>
        <p className="mt-1 text-xs leading-relaxed">{copy.body}</p>
      </div>

      {blockers.length > 0 ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="text-xs font-bold text-red-900">차단 이슈</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-red-800">
            {blockers.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {warnings.length > 0 && state !== "approval_blocked" ? (
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

      {isReviewing ? (
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

          {canApprove || state === "approval_warning" || state === "approval_ready" ? (
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

          {state !== "release_gate_required" && state !== "approval_blocked" ? (
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
      ) : null}

      {message ? <p className="text-sm font-semibold text-emerald-800">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
