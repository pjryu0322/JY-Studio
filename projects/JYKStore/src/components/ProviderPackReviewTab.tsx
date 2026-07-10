"use client";

import { useMemo } from "react";
import { ProviderPackReadinessCard } from "@/components/ProviderPackReadinessCard";
import { SubmitRequestAction } from "@/components/provider-submit/SubmitRequestAction";
import type { ProviderPackDetailDto } from "@/lib/provider-pack-dto";
import { buildProviderSubmitReadinessPlan } from "@/lib/provider-submit-readiness-steps";
import {
  PROVIDER_PACK_GO_TO_INSPECTION_TAB,
  PROVIDER_PACK_GO_TO_SOURCE_TAB,
  PROVIDER_PACK_REVIEW_INCOMPLETE_BODY,
  PROVIDER_PACK_REVIEW_INCOMPLETE_TITLE,
  PROVIDER_PACK_REVIEW_PREREQ_TITLE,
  PROVIDER_PACK_REVIEW_READY_BODY,
  PROVIDER_PACK_REVIEW_READY_TITLE,
  PROVIDER_PACK_WIZARD_REVIEW_STEP,
  PROVIDER_REVIEW_READONLY_HINT,
  PROVIDER_SUBMIT_ADMIN_FOOTER_NOTICE,
} from "@/lib/role-based-ux-copy";

export function ProviderPackReviewTab({
  pack,
  editable,
  submitting,
  sourceDocumentCount,
  knowledgeUnitDraftCount,
  onSubmitReview,
  onGoToSourceTab,
  onGoToInspectionTab,
}: {
  readonly pack: ProviderPackDetailDto;
  readonly editable: boolean;
  readonly submitting: boolean;
  readonly sourceDocumentCount: number;
  readonly knowledgeUnitDraftCount: number;
  readonly onSubmitReview: () => void;
  readonly onGoToSourceTab: () => void;
  readonly onGoToInspectionTab: () => void;
}) {
  const isReviewing = pack.status === "REVIEWING";
  const isPublished = pack.status === "PUBLISHED" || pack.status === "VERIFIED";
  const missingSources = sourceDocumentCount === 0;
  const missingDrafts = knowledgeUnitDraftCount === 0;

  const plan = useMemo(
    () =>
      buildProviderSubmitReadinessPlan({
        pack,
        sourceDocumentCount,
        knowledgeUnitDraftCount,
      }),
    [pack, sourceDocumentCount, knowledgeUnitDraftCount],
  );

  const inspectionIncomplete =
    !isReviewing &&
    !isPublished &&
    !plan.canSubmitReview &&
    !missingSources &&
    !missingDrafts;

  return (
    <section
      id="pack-review"
      className="scroll-mt-24 space-y-4 rounded-2xl border border-store-border bg-white p-4 shadow-card"
    >
      <h2 className="text-sm font-bold text-slate-900">{PROVIDER_PACK_WIZARD_REVIEW_STEP}</h2>

      {isReviewing ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          검수 요청이 접수되었습니다. {PROVIDER_REVIEW_READONLY_HINT}
        </div>
      ) : null}

      {isPublished ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
          운영자 승인이 완료된 지식팩입니다. 스토어에서 검색·연동할 수 있습니다.
        </div>
      ) : null}

      {(missingSources || missingDrafts) && !isReviewing && !isPublished ? (
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-3 text-xs text-amber-950">
          <p className="font-bold">{PROVIDER_PACK_REVIEW_PREREQ_TITLE}</p>
          <ol className="mt-2 list-decimal space-y-1 pl-4">
            {missingSources ? <li>원천 문서 등록 필요</li> : null}
            {missingDrafts ? <li>Knowledge Unit 후보 생성 필요</li> : null}
          </ol>
          <button
            type="button"
            onClick={onGoToSourceTab}
            className="mt-3 min-h-[44px] w-full rounded-xl border border-store-accent bg-white text-sm font-bold text-store-accent"
          >
            {PROVIDER_PACK_GO_TO_SOURCE_TAB}
          </button>
        </div>
      ) : null}

      {inspectionIncomplete ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
          <p className="font-bold">{PROVIDER_PACK_REVIEW_INCOMPLETE_TITLE}</p>
          <p className="mt-1 text-xs">{PROVIDER_PACK_REVIEW_INCOMPLETE_BODY}</p>
          <button
            type="button"
            onClick={onGoToInspectionTab}
            className="mt-3 min-h-[44px] w-full rounded-xl bg-store-accent text-sm font-bold text-white"
          >
            {PROVIDER_PACK_GO_TO_INSPECTION_TAB}
          </button>
        </div>
      ) : null}

      {plan.canSubmitReview && !isReviewing && !isPublished ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-950">
          <p className="font-bold">{PROVIDER_PACK_REVIEW_READY_TITLE}</p>
          <p className="mt-1 text-xs">{PROVIDER_PACK_REVIEW_READY_BODY}</p>
        </div>
      ) : null}

      {!isPublished ? <ProviderPackReadinessCard pack={pack} compactQualityWarnings /> : null}

      <p className="rounded-xl border border-store-border bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-700">
        {PROVIDER_SUBMIT_ADMIN_FOOTER_NOTICE}
      </p>

      {editable && !isReviewing ? (
        <SubmitRequestAction
          plan={plan}
          submitting={submitting}
          onSubmitReview={onSubmitReview}
        />
      ) : null}
    </section>
  );
}
