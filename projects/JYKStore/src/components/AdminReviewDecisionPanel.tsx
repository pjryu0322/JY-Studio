"use client";

import { FormEvent, useState } from "react";
import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import { approveAdminReview, rejectAdminReview } from "@/lib/admin-review-api";
import { getPipelineStatusLabel } from "@/lib/pipeline-dto";
import { getSourceTypeLabel } from "@/lib/source-type-dto";

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
          <li>공정 상태: {getPipelineStatusLabel(detail.readiness.pipelineStatus)}</li>
          <li>버전: {detail.readiness.versionCount}개</li>
          <li>원천 문서: {detail.readiness.sourceDocumentCount}개</li>
          <li>설명: {detail.readiness.hasRequiredDescription ? "충족" : "부족"}</li>
          <li>
            검증 요약: 통과 {detail.readiness.sourceValidation.passCount} · 주의{" "}
            {detail.readiness.sourceValidation.warningCount} · 실패{" "}
            {detail.readiness.sourceValidation.failCount} · 미검사{" "}
            {detail.readiness.sourceValidation.notCheckedCount}
          </li>
          <li>승인 가능: {detail.readiness.canApprove ? "예" : "아니오"}</li>
        </ul>
        {Object.keys(detail.readiness.sourceTypeCoverage).length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Object.entries(detail.readiness.sourceTypeCoverage).map(([type, count]) => (
              <span
                key={type}
                className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-700"
              >
                {getSourceTypeLabel(type)} {count}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {detail.readiness.sourceValidation.failCount > 0 ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          검증 실패(FAIL) 원천 문서가 있어 승인할 수 없습니다. 제공자에게 반려해 주세요.
        </div>
      ) : null}

      {detail.readiness.sourceValidation.notCheckedCount > 0 ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          검증되지 않은(NOT_CHECKED) 원천 문서가 있어 승인할 수 없습니다. 원천 문서 재검증을 실행해
          주세요.
        </div>
      ) : null}

      {detail.readiness.sourceValidation.warningCount > 0 &&
      detail.readiness.sourceValidation.failCount === 0 &&
      detail.readiness.sourceValidation.notCheckedCount === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
          주의(WARNING) 상태 원천 문서가 있습니다. 승인은 가능하지만 권장 항목을 확인해 주세요.
        </div>
      ) : null}

      {detail.readiness.structureQualityMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          {detail.readiness.structureQualityMessage}
        </div>
      ) : null}

      {detail.readiness.chunkQualityMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          {detail.readiness.chunkQualityMessage}
        </div>
      ) : null}

      {detail.readiness.retrievalEvaluationMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          {detail.readiness.retrievalEvaluationMessage}
        </div>
      ) : null}

      {detail.readiness.releaseGateMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          {detail.readiness.releaseGateMessage}
        </div>
      ) : null}

      {detail.readiness.releaseGateStatus === "WARNING" && detail.readiness.canApprove ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
          릴리스 게이트가 WARNING입니다. 승인은 가능하지만 차단/경고 이슈를 확인해 주세요.
        </div>
      ) : null}

      {(detail.readiness.structureCoverageStatus === "WARNING" ||
        detail.readiness.knowledgeQualityStatus === "WARNING") &&
      detail.readiness.canApprove ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
          구조 커버리지 또는 지식 품질이 WARNING입니다. 승인은 가능하지만 보완을 권장합니다.
        </div>
      ) : null}

      {detail.readiness.chunkQualityStatus === "WARNING" && detail.readiness.canApprove ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
          청킹 품질이 WARNING입니다. 승인은 가능하지만 보완을 권장합니다.
        </div>
      ) : null}

      {detail.readiness.retrievalEvaluationStatus === "WARNING" &&
      detail.readiness.canApprove ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
          검색 품질 평가가 WARNING입니다. 승인은 가능하지만 보완을 권장합니다.
        </div>
      ) : null}

      <p className="text-xs leading-relaxed text-store-muted">
        승인 시 릴리스 게이트가 최신 데이터 기준으로 자동 재평가됩니다.
      </p>

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
