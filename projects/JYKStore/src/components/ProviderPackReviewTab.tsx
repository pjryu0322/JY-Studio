"use client";

import { useMemo } from "react";
import { ProviderPackChunkSummaryCard } from "@/components/ProviderPackChunkSummaryCard";
import { ProviderPackReadinessCard } from "@/components/ProviderPackReadinessCard";
import { SubmitRequestAction } from "@/components/provider-submit/SubmitRequestAction";
import type { ProviderPackDetailDto } from "@/lib/provider-pack-dto";
import { buildProviderSubmitReadinessPlan } from "@/lib/provider-submit-readiness-steps";
import {
  PROVIDER_PACK_GO_TO_INSPECTION_TAB,
  PROVIDER_PACK_GO_TO_SOURCE_TAB,
  PROVIDER_PACK_REVIEW_PREREQ_TITLE,
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
          <p className="font-bold">검수 요청 불가</p>
          <p className="mt-1 text-xs">
            아직 완료되지 않은 점검이 있습니다. 점검 탭에서 필수 점검을 먼저 완료해 주세요.
          </p>
          {plan.incompleteStepTitles.length > 0 ? (
            <div className="mt-3 text-xs">
              <p className="font-semibold">미완료 항목</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {plan.incompleteStepTitles.map((title) => (
                  <li key={title}>{title}</li>
                ))}
              </ul>
            </div>
          ) : null}
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
          <p className="font-bold">검수 요청 준비 완료</p>
          <p className="mt-1 text-xs">
            모든 필수 점검이 완료되었습니다. 검수 요청을 제출하면 일반 카탈로그와 Context API에는 아직
            공개되지 않고, 관리자 검토 단계로 이동합니다.
          </p>
          <div className="mt-3 text-xs">
            <p className="font-semibold">완료된 점검</p>
            <ul className="mt-1 space-y-0.5">
              {["구조/품질 점검", "청킹 품질 점검", "검색 평가 케이스 생성", "검색 품질 평가"].map(
                (title) => (
                  <li key={title}>✓ {title}</li>
                ),
              )}
            </ul>
          </div>
        </div>
      ) : null}

      {!isPublished ? <ProviderPackReadinessCard pack={pack} compactQualityWarnings /> : null}

      <p className="rounded-xl border border-store-border bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-700">
        {PROVIDER_SUBMIT_ADMIN_FOOTER_NOTICE}
      </p>

      <ProviderPackChunkSummaryCard packId={pack.packId} />

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
