"use client";

import { useCallback, useMemo, useState } from "react";
import { ChunkQualityPanel } from "@/components/ChunkQualityPanel";
import { ProviderPackChunkSummaryCard } from "@/components/ProviderPackChunkSummaryCard";
import { ProviderPackReadinessCard } from "@/components/ProviderPackReadinessCard";
import { RetrievalEvaluationPanel } from "@/components/RetrievalEvaluationPanel";
import { StructureQualityPanel } from "@/components/StructureQualityPanel";
import { SubmitReadinessChecklist } from "@/components/provider-submit/SubmitReadinessChecklist";
import type { ProviderPackDetailDto } from "@/lib/provider-pack-dto";
import {
  buildProviderInspectionReadiness,
  type InspectionNextAction,
} from "@/lib/provider-pack-inspection-readiness";
import {
  evaluateProviderChunkQualityApi,
  evaluateProviderStructureQualityApi,
  generateProviderRetrievalEvaluationCasesApi,
  runProviderRetrievalEvaluationApi,
} from "@/lib/provider-center-api";
import {
  getChunkQualityEvaluateLabel,
  getRetrievalCasesActionLabel,
  getRetrievalRunActionLabel,
  getStructureQualityEvaluateLabel,
  type SubmitReadinessNextAction,
} from "@/lib/provider-submit-readiness-steps";
import {
  PROVIDER_PACK_GO_TO_REVIEW_TAB,
  PROVIDER_PACK_GO_TO_SOURCE_TAB,
  PROVIDER_PACK_INSPECTION_INTRO,
  PROVIDER_PACK_REVIEW_PREREQ_TITLE,
  PROVIDER_PACK_WIZARD_INSPECTION_STEP,
  PROVIDER_SUBMIT_ADMIN_REVIEW_NOTICE,
} from "@/lib/role-based-ux-copy";

export function ProviderPackInspectionTab({
  packId,
  pack,
  editable,
  sourceDocumentCount,
  knowledgeUnitDraftCount,
  onGoToSourceTab,
  onGoToReviewTab,
  onPackUpdated,
}: {
  readonly packId: string;
  readonly pack: ProviderPackDetailDto;
  readonly editable: boolean;
  readonly sourceDocumentCount: number;
  readonly knowledgeUnitDraftCount: number;
  readonly onGoToSourceTab: () => void;
  readonly onGoToReviewTab: () => void;
  readonly onPackUpdated: (pack: ProviderPackDetailDto) => void;
}) {
  const [actionBusy, setActionBusy] = useState(false);

  const isReviewing = pack.status === "REVIEWING";
  const isPublished = pack.status === "PUBLISHED" || pack.status === "VERIFIED";
  const missingSources = sourceDocumentCount === 0;
  const missingDrafts = knowledgeUnitDraftCount === 0;

  const readiness = useMemo(
    () =>
      buildProviderInspectionReadiness({
        pack,
        sourceDocumentCount,
        knowledgeUnitDraftCount,
      }),
    [pack, sourceDocumentCount, knowledgeUnitDraftCount],
  );

  const runAction = useCallback(
    async (action: InspectionNextAction | SubmitReadinessNextAction) => {
      if (!editable || isReviewing) return;
      if (action === "GO_TO_SUBMIT_REVIEW" || action === "SUBMIT_REVIEW") {
        onGoToReviewTab();
        return;
      }
      if (action === "WAIT_ADMIN_REVIEW" || action === "BLOCKED") return;

      setActionBusy(true);
      try {
        if (action === "RUN_STRUCTURE_QUALITY") {
          const data = await evaluateProviderStructureQualityApi(packId);
          onPackUpdated(data.pack);
        } else if (action === "RUN_CHUNK_QUALITY") {
          const data = await evaluateProviderChunkQualityApi(packId);
          onPackUpdated(data.pack);
        } else if (action === "GENERATE_RETRIEVAL_CASES") {
          const data = await generateProviderRetrievalEvaluationCasesApi(packId, true);
          onPackUpdated(data.pack);
        } else if (action === "RUN_RETRIEVAL_EVALUATION") {
          const data = await runProviderRetrievalEvaluationApi(packId);
          onPackUpdated(data.pack);
        }
      } finally {
        setActionBusy(false);
      }
    },
    [editable, isReviewing, onGoToReviewTab, onPackUpdated, packId],
  );

  const structureLabel = getStructureQualityEvaluateLabel(pack);
  const chunkLabel = getChunkQualityEvaluateLabel(pack);
  const casesLabel = getRetrievalCasesActionLabel(pack);
  const runEvalLabel = getRetrievalRunActionLabel(pack);

  const checklistSteps = readiness.plan.steps.filter((step) => step.key !== "submit_review");
  const showPrimaryCta =
    readiness.nextAction !== "BLOCKED" && readiness.nextAction !== "WAIT_ADMIN_REVIEW";

  return (
    <section
      id="pack-inspection"
      className="scroll-mt-24 space-y-4 rounded-2xl border border-store-border bg-white p-4 shadow-card"
    >
      <h2 className="text-sm font-bold text-slate-900">{PROVIDER_PACK_WIZARD_INSPECTION_STEP}</h2>
      <p className="text-xs text-store-muted">{PROVIDER_PACK_INSPECTION_INTRO}</p>

      {isReviewing ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          검수 요청이 접수되어 점검은 읽기 전용입니다. 관리자 검토 결과를 기다려 주세요.
        </div>
      ) : null}

      {isPublished ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
          운영자 승인이 완료된 지식팩입니다. 점검 결과는 참고용으로 확인할 수 있습니다.
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

      {!isPublished ? (
        <section className="rounded-2xl border border-store-border bg-slate-50 p-4">
          {readiness.nextAction === "GO_TO_SUBMIT_REVIEW" ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-950">
              <p className="font-bold">점검 완료: 검수요청 가능</p>
              <p className="mt-1">
                모든 필수 점검이 완료되었습니다. 검수요청 탭에서 제출할 수 있습니다.
              </p>
            </div>
          ) : readiness.nextAction === "WAIT_ADMIN_REVIEW" ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              <p className="font-bold">관리자 검토 대기</p>
              <p className="mt-1">{readiness.nextActionDescription}</p>
            </div>
          ) : (
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-slate-800">
              <p className="font-bold">
                현재 단계: <strong>{readiness.currentStepTitle}</strong>
              </p>
              <p className="mt-1 text-store-muted">{readiness.nextActionDescription}</p>
              {readiness.incompleteStepTitles.length > 0 ? (
                <p className="mt-2 font-semibold">
                  미완료 항목 {readiness.incompleteStepTitles.length}개
                </p>
              ) : null}
            </div>
          )}

          <p className="mt-3 text-xs text-slate-700">
            진행률: <strong>{readiness.completedCount}</strong> / {readiness.totalCount} 완료
          </p>

          {showPrimaryCta ? (
            <button
              type="button"
              disabled={actionBusy || (!editable && readiness.nextAction !== "GO_TO_SUBMIT_REVIEW")}
              onClick={() => void runAction(readiness.nextAction)}
              className="mt-3 min-h-[44px] w-full rounded-xl bg-store-accent px-4 text-sm font-bold text-white disabled:opacity-50"
            >
              {actionBusy
                ? "실행 중…"
                : readiness.nextAction === "GO_TO_SUBMIT_REVIEW"
                  ? PROVIDER_PACK_GO_TO_REVIEW_TAB
                  : readiness.nextActionLabel}
            </button>
          ) : null}
        </section>
      ) : null}

      {!isPublished ? (
        <SubmitReadinessChecklist
          steps={checklistSteps}
          busy={actionBusy}
          onStepAction={(action) => void runAction(action)}
        />
      ) : null}

      <details className="rounded-2xl border border-store-border bg-white">
        <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-slate-900">
          상세 점검 결과 펼치기
        </summary>
        <div className="space-y-4 border-t border-store-border p-4">
          <ProviderPackReadinessCard pack={pack} compactQualityWarnings />
          <StructureQualityPanel
            packId={packId}
            structureQuality={pack.structureQuality}
            editable={editable && !isReviewing}
            evaluateButtonLabel={structureLabel}
            onEvaluate={async () => {
              const data = await evaluateProviderStructureQualityApi(packId);
              onPackUpdated(data.pack);
            }}
          />
          <ChunkQualityPanel
            packId={packId}
            chunkQuality={pack.chunkQuality}
            editable={editable && !isReviewing}
            evaluateButtonLabel={chunkLabel}
            onEvaluate={async () => {
              const data = await evaluateProviderChunkQualityApi(packId);
              onPackUpdated(data.pack);
            }}
          />
          <RetrievalEvaluationPanel
            packId={packId}
            retrievalEvaluation={pack.retrievalEvaluation}
            editable={editable && !isReviewing}
            generateButtonLabel={casesLabel}
            runButtonLabel={runEvalLabel}
            onGenerate={async (replace) => {
              const data = await generateProviderRetrievalEvaluationCasesApi(packId, replace);
              onPackUpdated(data.pack);
            }}
            onRun={async () => {
              const data = await runProviderRetrievalEvaluationApi(packId);
              onPackUpdated(data.pack);
            }}
          />
        </div>
      </details>

      <p className="rounded-xl border border-store-border bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-700">
        {PROVIDER_SUBMIT_ADMIN_REVIEW_NOTICE}
      </p>

      <ProviderPackChunkSummaryCard
        packId={packId}
        chunkActionLabel={chunkLabel}
        onChunkAction={
          editable && !isReviewing && readiness.nextAction === "RUN_CHUNK_QUALITY"
            ? () => void runAction("RUN_CHUNK_QUALITY")
            : undefined
        }
      />
    </section>
  );
}
