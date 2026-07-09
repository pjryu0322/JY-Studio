"use client";

import { ProviderPackChunkSummaryCard } from "@/components/ProviderPackChunkSummaryCard";
import { ProviderPackReadinessCard } from "@/components/ProviderPackReadinessCard";
import { StructureQualityPanel } from "@/components/StructureQualityPanel";
import { ChunkQualityPanel } from "@/components/ChunkQualityPanel";
import { RetrievalEvaluationPanel } from "@/components/RetrievalEvaluationPanel";
import type { ProviderPackDetailDto } from "@/lib/provider-pack-dto";
import {
  evaluateProviderChunkQualityApi,
  evaluateProviderStructureQualityApi,
  generateProviderRetrievalEvaluationCasesApi,
  runProviderRetrievalEvaluationApi,
} from "@/lib/provider-center-api";
import {
  PROVIDER_PACK_GO_TO_SOURCE_TAB,
  PROVIDER_PACK_REVIEW_PREREQ_TITLE,
  PROVIDER_PACK_REVIEW_SUBMIT_CTA,
  PROVIDER_PACK_WIZARD_REVIEW_STEP,
  PROVIDER_REVIEW_READONLY_HINT,
} from "@/lib/role-based-ux-copy";

export function ProviderPackReviewTab({
  packId,
  pack,
  editable,
  submitting,
  sourceDocumentCount,
  knowledgeUnitDraftCount,
  onSubmitReview,
  onGoToSourceTab,
  onPackUpdated,
}: {
  readonly packId: string;
  readonly pack: ProviderPackDetailDto;
  readonly editable: boolean;
  readonly submitting: boolean;
  readonly sourceDocumentCount: number;
  readonly knowledgeUnitDraftCount: number;
  readonly onSubmitReview: () => void;
  readonly onGoToSourceTab: () => void;
  readonly onPackUpdated: (pack: ProviderPackDetailDto) => void;
}) {
  const isReviewing = pack.status === "REVIEWING";
  const isPublished = pack.status === "PUBLISHED" || pack.status === "VERIFIED";

  const missingSources = sourceDocumentCount === 0;
  const missingDrafts = knowledgeUnitDraftCount === 0;
  const canSubmit = editable && !missingSources && !missingDrafts;

  return (
    <section id="pack-review" className="scroll-mt-24 space-y-4 rounded-2xl border border-store-border bg-white p-4 shadow-card">
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

      {!canSubmit && !isReviewing && !isPublished ? (
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-3 text-xs text-amber-950">
          <p className="font-bold">{PROVIDER_PACK_REVIEW_PREREQ_TITLE}</p>
          <ol className="mt-2 list-decimal space-y-1 pl-4">
            {missingSources ? <li>원천 문서 등록 필요</li> : null}
            {missingDrafts ? <li>Knowledge Unit 초안 생성 필요</li> : null}
            <li>구조/품질 점검 권장</li>
            <li>청킹 품질 점검 권장</li>
            <li>검색 품질 평가 권장</li>
          </ol>
          {missingSources || missingDrafts ? (
            <button
              type="button"
              onClick={onGoToSourceTab}
              className="mt-3 min-h-[44px] w-full rounded-xl border border-store-accent bg-white text-sm font-bold text-store-accent"
            >
              {PROVIDER_PACK_GO_TO_SOURCE_TAB}
            </button>
          ) : null}
        </div>
      ) : null}

      <ProviderPackReadinessCard pack={pack} />
      <StructureQualityPanel
        packId={packId}
        structureQuality={pack.structureQuality}
        editable={editable && !isReviewing}
        onEvaluate={async () => {
          const data = await evaluateProviderStructureQualityApi(packId);
          onPackUpdated(data.pack);
        }}
      />
      <ChunkQualityPanel
        packId={packId}
        chunkQuality={pack.chunkQuality}
        editable={editable && !isReviewing}
        onEvaluate={async () => {
          const data = await evaluateProviderChunkQualityApi(packId);
          onPackUpdated(data.pack);
        }}
      />
      <RetrievalEvaluationPanel
        packId={packId}
        retrievalEvaluation={pack.retrievalEvaluation}
        editable={editable && !isReviewing}
        onGenerate={async (replace) => {
          const data = await generateProviderRetrievalEvaluationCasesApi(packId, replace);
          onPackUpdated(data.pack);
        }}
        onRun={async () => {
          const data = await runProviderRetrievalEvaluationApi(packId);
          onPackUpdated(data.pack);
        }}
      />
      <ProviderPackChunkSummaryCard packId={packId} />

      {editable && !isReviewing ? (
        <button
          type="button"
          onClick={onSubmitReview}
          disabled={submitting || missingSources || missingDrafts}
          className="min-h-[44px] w-full rounded-xl bg-store-accent text-sm font-bold text-white disabled:opacity-50"
        >
          {submitting ? "제출 중…" : PROVIDER_PACK_REVIEW_SUBMIT_CTA}
        </button>
      ) : null}
    </section>
  );
}
