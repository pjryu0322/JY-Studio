"use client";

import { FormEvent, useState } from "react";
import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import { approveAdminReview, rejectAdminReview } from "@/lib/admin-review-api";

export function AdminReviewDecisionPanel({
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
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isReviewing = detail.pack.status === "REVIEWING";
  const canApprove = isReviewing && detail.readiness.canApprove;
  const canReject = isReviewing && rejectionReason.trim().length > 0;

  const onApprove = async (e: FormEvent) => {
    e.preventDefault();
    if (!canApprove) return;
    setBusy("approve");
    setError(null);
    setMessage(null);
    try {
      const res = await approveAdminReview(packId, { memo: memo.trim() || undefined, publishAsVerified });
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
      <h3 className="text-sm font-bold text-slate-900">검수 처리</h3>

      <div className="rounded-xl bg-slate-50 p-3 text-sm">
        <p className="font-semibold text-slate-900">준비 상태</p>
        <ul className="mt-2 space-y-1 text-xs text-store-muted">
          <li>버전: {detail.readiness.versionCount}개</li>
          <li>원천 문서: {detail.readiness.sourceDocumentCount}개</li>
          <li>설명: {detail.readiness.hasRequiredDescription ? "충족" : "부족"}</li>
          <li>승인 가능: {detail.readiness.canApprove ? "예" : "아니오"}</li>
        </ul>
      </div>

      {detail.latestReview?.rejectionReason ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
          최근 반려 사유: {detail.latestReview.rejectionReason}
        </div>
      ) : null}

      <label className="block text-xs font-semibold text-slate-700" htmlFor="review-memo">
        검수 메모 (선택)
      </label>
      <textarea
        id="review-memo"
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        rows={3}
        disabled={!isReviewing}
        className="w-full rounded-xl border border-store-border px-3 py-2 text-sm disabled:bg-slate-50"
      />

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={publishAsVerified}
          onChange={(e) => setPublishAsVerified(e.target.checked)}
          disabled={!isReviewing}
          className="h-4 w-4"
        />
        VERIFIED로 승인 (기본은 PUBLISHED)
      </label>

      <form onSubmit={onApprove}>
        <button
          type="submit"
          disabled={!canApprove || busy !== null}
          className="min-h-[44px] w-full rounded-xl bg-store-accent text-sm font-bold text-white disabled:opacity-50"
        >
          {busy === "approve" ? "승인 중…" : "승인"}
        </button>
      </form>

      <label className="block text-xs font-semibold text-slate-700" htmlFor="rejection-reason">
        반려 사유 (반려 시 필수)
      </label>
      <textarea
        id="rejection-reason"
        value={rejectionReason}
        onChange={(e) => setRejectionReason(e.target.value)}
        rows={2}
        disabled={!isReviewing}
        className="w-full rounded-xl border border-store-border px-3 py-2 text-sm disabled:bg-slate-50"
      />

      <form onSubmit={onReject}>
        <button
          type="submit"
          disabled={!canReject || busy !== null}
          className="min-h-[44px] w-full rounded-xl border-2 border-red-200 bg-white text-sm font-bold text-red-800 disabled:opacity-50"
        >
          {busy === "reject" ? "반려 중…" : "반려"}
        </button>
      </form>

      {message ? <p className="text-sm font-semibold text-emerald-800">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
