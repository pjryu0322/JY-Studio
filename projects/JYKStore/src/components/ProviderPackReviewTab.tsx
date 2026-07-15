"use client";

import {
  ProviderDistributionReadiness,
  type DistributionReadiness,
} from "@/components/provider-distribution/ProviderDistributionReadiness";
import { ProviderPackReadinessCard } from "@/components/ProviderPackReadinessCard";
import type { ProviderPackDetailDto } from "@/lib/provider-pack-dto";
import { canProviderWithdrawReview, PackReviewStatus } from "@/lib/pack-review-status";
import {
  PROVIDER_PACK_GO_TO_PAYLOAD_TAB,
  PROVIDER_PACK_REVIEW_READY_BODY,
  PROVIDER_PACK_REVIEW_READY_TITLE,
  PROVIDER_PACK_WIZARD_REVIEW_STEP,
  PROVIDER_REVIEW_ACCEPTED_BODY,
  PROVIDER_REVIEW_ACCEPTED_TITLE,
  PROVIDER_REVIEW_DEV_ADMIN_HINT,
  PROVIDER_REVIEW_REJECTED_GO_FIX,
  PROVIDER_REVIEW_REJECTED_TITLE,
  PROVIDER_REVIEW_WAITING_BODY,
  PROVIDER_REVIEW_WAITING_TITLE,
  PROVIDER_REVIEW_WITHDRAW_CTA,
  PROVIDER_REVIEW_WITHDRAW_HINT,
  PROVIDER_REVIEW_WITHDRAW_LOCKED_HINT,
  PROVIDER_SUBMIT_ADMIN_FOOTER_NOTICE,
  PROVIDER_SUBMIT_CTA,
} from "@/lib/role-based-ux-copy";

export function ProviderPackReviewTab({
  pack,
  editable,
  submitting,
  withdrawing,
  sourceDocumentCount,
  distributionMode,
  distributionReadiness,
  onSubmitReview,
  onWithdrawReview,
  onGoToPayloadTab,
  onGoToDistributionTab,
  onGoToKnowledgeTab,
  onGoToBasicTab,
}: {
  readonly pack: ProviderPackDetailDto;
  readonly editable: boolean;
  readonly submitting: boolean;
  readonly withdrawing: boolean;
  readonly sourceDocumentCount: number;
  readonly distributionMode: boolean;
  readonly distributionReadiness: DistributionReadiness | null;
  readonly onSubmitReview: () => void;
  readonly onWithdrawReview: () => void;
  readonly onGoToPayloadTab: () => void;
  readonly onGoToDistributionTab: () => void;
  readonly onGoToKnowledgeTab?: () => void;
  readonly onGoToBasicTab: () => void;
}) {
  const isReviewing = pack.status === "REVIEWING";
  const isPublished = pack.status === "PUBLISHED" || pack.status === "VERIFIED";
  const canWithdraw = canProviderWithdrawReview(pack.latestReviewStatus);
  const isAccepted = pack.latestReviewStatus === PackReviewStatus.IN_REVIEW;

  const legacyMissingSources = !distributionMode && sourceDocumentCount === 0;
  const distributionReady = distributionMode
    ? Boolean(distributionReadiness?.ready)
    : sourceDocumentCount > 0;
  const canAttemptSubmit =
    editable && !isReviewing && !isPublished && distributionReady && !legacyMissingSources;

  return (
    <section
      id="pack-review"
      className="scroll-mt-24 space-y-4 rounded-2xl border border-store-border bg-white p-4 shadow-card"
    >
      <h2 className="text-sm font-bold text-slate-900">{PROVIDER_PACK_WIZARD_REVIEW_STEP}</h2>

      {isReviewing ? (
        <div
          className={`rounded-xl border px-3 py-3 text-sm ${
            isAccepted
              ? "border-blue-200 bg-blue-50 text-blue-950"
              : "border-amber-200 bg-amber-50 text-amber-950"
          }`}
        >
          <p className="font-bold">
            {isAccepted ? PROVIDER_REVIEW_ACCEPTED_TITLE : PROVIDER_REVIEW_WAITING_TITLE}
          </p>
          <p className="mt-1 text-xs">
            {isAccepted ? PROVIDER_REVIEW_ACCEPTED_BODY : PROVIDER_REVIEW_WAITING_BODY}
          </p>
          {canWithdraw ? (
            <>
              <p className="mt-2 text-xs text-amber-900">{PROVIDER_REVIEW_WITHDRAW_HINT}</p>
              {process.env.NODE_ENV !== "production" ? (
                <p className="mt-2 text-[10px] text-amber-800/80">{PROVIDER_REVIEW_DEV_ADMIN_HINT}</p>
              ) : null}
              <button
                type="button"
                disabled={withdrawing}
                onClick={onWithdrawReview}
                className="mt-3 min-h-[48px] w-full rounded-xl border-2 border-amber-300 bg-white text-sm font-bold text-amber-950 disabled:opacity-50"
              >
                {withdrawing ? "회수 중…" : PROVIDER_REVIEW_WITHDRAW_CTA}
              </button>
            </>
          ) : (
            <p className="mt-2 text-xs opacity-90">{PROVIDER_REVIEW_WITHDRAW_LOCKED_HINT}</p>
          )}
        </div>
      ) : null}

      {!isReviewing && !isPublished && pack.latestRejectionReason ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-900">
          <p className="font-bold">{PROVIDER_REVIEW_REJECTED_TITLE}</p>
          <p className="mt-1 text-xs">사유: {pack.latestRejectionReason}</p>
          <button
            type="button"
            onClick={onGoToPayloadTab}
            className="mt-3 min-h-[44px] w-full rounded-xl bg-store-accent text-sm font-bold text-white"
          >
            {PROVIDER_REVIEW_REJECTED_GO_FIX}
          </button>
        </div>
      ) : null}

      {isPublished ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
          운영자 승인이 완료된 지식팩입니다. 스토어에서 검색·연동할 수 있습니다.
        </div>
      ) : null}

      {distributionMode && distributionReadiness && !isReviewing && !isPublished ? (
        <ProviderDistributionReadiness
          readiness={distributionReadiness}
          onGoToTab={(tab) => {
            if (tab === "basic") onGoToBasicTab();
            else if (tab === "payload") onGoToPayloadTab();
            else if (tab === "knowledge") onGoToKnowledgeTab?.();
            else onGoToDistributionTab();
          }}
        />
      ) : null}

      {legacyMissingSources && !isReviewing && !isPublished ? (
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-3 text-xs text-amber-950">
          <p>등록된 Payload 또는 원천 자료가 없습니다. Payload를 등록한 뒤 검수 요청을 진행하세요.</p>
          <button
            type="button"
            onClick={onGoToPayloadTab}
            className="mt-3 min-h-[44px] w-full rounded-xl border border-store-accent bg-white text-sm font-bold text-store-accent"
          >
            {PROVIDER_PACK_GO_TO_PAYLOAD_TAB}
          </button>
        </div>
      ) : null}

      {!isReviewing && !isPublished && !legacyMissingSources ? (
        <>
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
            <p className="text-sm font-bold text-slate-900">{PROVIDER_PACK_REVIEW_READY_TITLE}</p>
            <p className="mt-1 text-xs text-store-muted">
              {distributionMode
                ? "기본정보·Payload·유통정보가 준비되면 검수 요청을 제출할 수 있습니다."
                : PROVIDER_PACK_REVIEW_READY_BODY}
            </p>
          </div>
          {!distributionMode ? <ProviderPackReadinessCard pack={pack} /> : null}
          <button
            type="button"
            disabled={!canAttemptSubmit || submitting}
            onClick={onSubmitReview}
            className="min-h-[48px] w-full rounded-xl bg-store-accent text-sm font-bold text-white disabled:opacity-50"
          >
            {submitting ? "제출 중…" : PROVIDER_SUBMIT_CTA}
          </button>
          <p className="text-[11px] text-store-muted">{PROVIDER_SUBMIT_ADMIN_FOOTER_NOTICE}</p>
        </>
      ) : null}
    </section>
  );
}
