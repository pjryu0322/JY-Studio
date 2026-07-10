"use client";

import { useCallback, useMemo, useState } from "react";
import { ChunkQualityPanel } from "@/components/ChunkQualityPanel";
import { ProviderPackChunkSummaryCard } from "@/components/ProviderPackChunkSummaryCard";
import { ProviderPackReadinessCard } from "@/components/ProviderPackReadinessCard";
import { RetrievalEvaluationPanel } from "@/components/RetrievalEvaluationPanel";
import { StructureQualityPanel } from "@/components/StructureQualityPanel";
import { SubmitReadinessChecklist } from "@/components/provider-submit/SubmitReadinessChecklist";
import type { ProviderPackDetailDto } from "@/lib/provider-pack-dto";
import { buildProviderInspectionReadiness } from "@/lib/provider-pack-inspection-readiness";
import {
  evaluateProviderChunkQualityApi,
  evaluateProviderReleaseGateApi,
  evaluateProviderStructureQualityApi,
  generateProviderRetrievalEvaluationCasesApi,
  runProviderInspectionAutoPrepareApi,
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
  PROVIDER_PACK_INSPECTION_AUTO_TITLE,
  PROVIDER_PACK_INSPECTION_INTRO,
  PROVIDER_PACK_WIZARD_INSPECTION_STEP,
  PROVIDER_SUBMIT_ADMIN_REVIEW_NOTICE,
} from "@/lib/role-based-ux-copy";

type PreparationSummary = {
  generatedChunkCount: number;
  structureQualityStatus: string;
  chunkQualityStatus: string;
  retrievalCaseCount: number;
  retrievalEvaluationStatus: string;
  warnings: string[];
};

export function ProviderPackInspectionTab({
  packId,
  pack,
  editable,
  sourceDocumentCount,
  knowledgeUnitDraftCount,
  onGoToSourceTab,
  onGoToDraftTab,
  onGoToReviewTab,
  onPackUpdated,
}: {
  readonly packId: string;
  readonly pack: ProviderPackDetailDto;
  readonly editable: boolean;
  readonly sourceDocumentCount: number;
  readonly knowledgeUnitDraftCount: number;
  readonly onGoToSourceTab: () => void;
  readonly onGoToDraftTab: () => void;
  readonly onGoToReviewTab: () => void;
  readonly onPackUpdated: (pack: ProviderPackDetailDto) => void;
}) {
  const [actionBusy, setActionBusy] = useState(false);
  const [lastPreparation, setLastPreparation] = useState<PreparationSummary | null>(null);
  const [inspectionError, setInspectionError] = useState<string | null>(null);

  const isReviewing = pack.status === "REVIEWING";

  const readiness = useMemo(
    () =>
      buildProviderInspectionReadiness({
        pack,
        sourceDocumentCount,
        knowledgeUnitDraftCount,
      }),
    [pack, sourceDocumentCount, knowledgeUnitDraftCount],
  );

  const runAutoPrepare = useCallback(
    async (repairRetrievalData: boolean) => {
      if (!editable || isReviewing) return;
      setActionBusy(true);
      setInspectionError(null);
      try {
        const data = await runProviderInspectionAutoPrepareApi(packId, {
          runRetrievalEvaluation: true,
          repairRetrievalData,
        });
        onPackUpdated(data.pack);
        if (data.preparation) {
          setLastPreparation(data.preparation);
        }
      } catch (err) {
        setInspectionError(
          err instanceof Error
            ? err.message
            : "자동 보완을 완료하지 못했습니다. 원천 문서 또는 초안이 부족할 수 있습니다.",
        );
      } finally {
        setActionBusy(false);
      }
    },
    [editable, isReviewing, onPackUpdated, packId],
  );

  const runPrimaryAction = useCallback(async () => {
    if (readiness.primaryActionKind === "GO_TO_SOURCE") {
      onGoToSourceTab();
      return;
    }
    if (readiness.primaryActionKind === "GO_TO_DRAFT") {
      onGoToDraftTab();
      return;
    }
    if (readiness.primaryActionKind === "GO_TO_REVIEW") {
      onGoToReviewTab();
      return;
    }
    if (
      readiness.primaryActionKind === "RUN_AUTO_PREPARE" ||
      readiness.primaryActionKind === "REGENERATE_AND_CHECK"
    ) {
      await runAutoPrepare(false);
      return;
    }
    if (readiness.primaryActionKind === "REPAIR_RETRIEVAL_DATA") {
      await runAutoPrepare(true);
      return;
    }
    if (readiness.primaryActionKind === "RUN_RELEASE_GATE") {
      if (!editable || isReviewing) return;
      setActionBusy(true);
      setInspectionError(null);
      try {
        const data = await evaluateProviderReleaseGateApi(packId);
        onPackUpdated(data.pack);
      } catch (err) {
        setInspectionError(
          err instanceof Error ? err.message : "릴리스 게이트 점검에 실패했습니다.",
        );
      } finally {
        setActionBusy(false);
      }
    }
  }, [
    editable,
    isReviewing,
    onGoToDraftTab,
    onGoToReviewTab,
    onGoToSourceTab,
    onPackUpdated,
    packId,
    readiness.primaryActionKind,
    runAutoPrepare,
  ]);

  const runDetailAction = useCallback(
    async (action: SubmitReadinessNextAction) => {
      if (!editable || isReviewing) return;
      setActionBusy(true);
      setInspectionError(null);
      try {
        if (action === "RUN_STRUCTURE_QUALITY") {
          const data = await evaluateProviderStructureQualityApi(packId);
          onPackUpdated(data.pack);
        } else if (action === "RUN_CHUNK_QUALITY") {
          const data = await evaluateProviderChunkQualityApi(packId, { regenerate: true });
          onPackUpdated(data.pack);
        } else if (action === "GENERATE_RETRIEVAL_CASES") {
          const data = await generateProviderRetrievalEvaluationCasesApi(packId, true);
          onPackUpdated(data.pack);
        } else if (action === "RUN_RETRIEVAL_EVALUATION") {
          const data = await runProviderRetrievalEvaluationApi(packId);
          onPackUpdated(data.pack);
        } else if (action === "RUN_RELEASE_GATE") {
          const data = await evaluateProviderReleaseGateApi(packId);
          onPackUpdated(data.pack);
        }
      } finally {
        setActionBusy(false);
      }
    },
    [editable, isReviewing, onPackUpdated, packId],
  );

  const structureLabel = getStructureQualityEvaluateLabel(pack);
  const chunkLabel = getChunkQualityEvaluateLabel(pack);
  const casesLabel = getRetrievalCasesActionLabel(pack);
  const runEvalLabel = getRetrievalRunActionLabel(pack);
  const checklistSteps = readiness.plan.steps.filter((step) => step.key !== "submit_review");
  const pipelineBusyKinds =
    readiness.primaryActionKind === "RUN_AUTO_PREPARE" ||
    readiness.primaryActionKind === "REGENERATE_AND_CHECK" ||
    readiness.primaryActionKind === "REPAIR_RETRIEVAL_DATA" ||
    readiness.primaryActionKind === "RUN_RELEASE_GATE";

  return (
    <section
      id="pack-inspection"
      className="scroll-mt-24 space-y-4 rounded-2xl border border-store-border bg-white p-4 shadow-card"
    >
      <h2 className="text-sm font-bold text-slate-900">{PROVIDER_PACK_WIZARD_INSPECTION_STEP}</h2>
      <p className="text-xs text-store-muted">{PROVIDER_PACK_INSPECTION_INTRO}</p>

      <section className="rounded-2xl border border-store-border bg-slate-50 p-4">
        <h3 className="text-sm font-bold text-slate-900">{PROVIDER_PACK_INSPECTION_AUTO_TITLE}</h3>
        <p className="mt-2 text-sm font-semibold text-slate-900">{readiness.userTitle}</p>
        <p className="mt-1 text-xs text-store-muted">{readiness.userMessage}</p>

        {readiness.passedTitles.length > 0 ? (
          <div className="mt-3 text-xs text-emerald-900">
            <p className="font-semibold">통과</p>
            <ul className="mt-1 space-y-0.5">
              {readiness.passedTitles.map((title) => (
                <li key={title}>✓ {title}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {readiness.fixNeededTitles.length > 0 ? (
          <div className="mt-3 text-xs text-amber-950">
            <p className="font-semibold">원인</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {readiness.fixNeededTitles.map((title) => (
                <li key={title}>{title}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {lastPreparation ? (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-950">
            <p className="font-semibold">자동 보완 결과</p>
            <ul className="mt-1 space-y-0.5">
              <li>Chunk {lastPreparation.generatedChunkCount}개 생성</li>
              <li>검색 평가 케이스 {lastPreparation.retrievalCaseCount}개 생성</li>
              <li>검색 품질 평가: {lastPreparation.retrievalEvaluationStatus}</li>
            </ul>
            {lastPreparation.warnings.length > 0 ? (
              <ul className="mt-2 list-disc space-y-0.5 pl-4 text-amber-950">
                {lastPreparation.warnings.slice(0, 4).map((warning, index) => (
                    <li key={`prep-warning-${index}`}>{warning}</li>
                  ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {inspectionError ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            <p className="font-semibold">자동 보완을 완료하지 못했습니다.</p>
            <p className="mt-1">{inspectionError}</p>
            <button
              type="button"
              onClick={onGoToDraftTab}
              className="mt-2 min-h-[40px] rounded-xl border border-red-300 bg-white px-3 font-semibold text-red-900"
            >
              참조지식 생성으로 이동
            </button>
          </div>
        ) : null}

        <p className="mt-3 text-xs text-slate-700">
          진행률: <strong>{readiness.completedCount}</strong> / {readiness.totalCount} 완료
        </p>

        {readiness.primaryActionKind !== "NONE" && readiness.primaryActionLabel ? (
          <button
            type="button"
            disabled={actionBusy || (pipelineBusyKinds && (!editable || isReviewing))}
            onClick={() => void runPrimaryAction()}
            className="mt-3 min-h-[44px] w-full rounded-xl bg-store-accent px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            {actionBusy ? "자동 보완 중…" : readiness.primaryActionLabel}
          </button>
        ) : null}
      </section>

      <details className="rounded-2xl border border-store-border bg-white">
        <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-slate-900">
          상세 점검 결과 펼치기
        </summary>
        <div className="space-y-4 border-t border-store-border p-4">
          <SubmitReadinessChecklist
            steps={checklistSteps}
            busy={actionBusy}
            onStepAction={(action) => void runDetailAction(action)}
          />
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
              const data = await evaluateProviderChunkQualityApi(packId, { regenerate: true });
              onPackUpdated(data.pack);
            }}
          />
          <RetrievalEvaluationPanel
            packId={packId}
            retrievalEvaluation={pack.retrievalEvaluation}
            editable={editable && !isReviewing}
            generateButtonLabel={casesLabel}
            runButtonLabel={runEvalLabel}
            repairButtonLabel="검색용 데이터 자동 보완"
            onGenerate={async (replace) => {
              const data = await generateProviderRetrievalEvaluationCasesApi(packId, replace);
              onPackUpdated(data.pack);
            }}
            onRun={async () => {
              const data = await runProviderRetrievalEvaluationApi(packId);
              onPackUpdated(data.pack);
            }}
            onRepair={async () => {
              await runAutoPrepare(true);
            }}
          />
          <p className="rounded-xl border border-store-border bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-700">
            {PROVIDER_SUBMIT_ADMIN_REVIEW_NOTICE}
          </p>
          <ProviderPackChunkSummaryCard packId={packId} />
        </div>
      </details>
    </section>
  );
}
