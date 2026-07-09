"use client";

import { useState } from "react";
import { ProviderKnowledgeUnitDraftPanel } from "@/components/ProviderKnowledgeUnitDraftPanel";
import { generateGitHubKnowledgeUnitDraftsApi } from "@/lib/provider-center-api";
import {
  PROVIDER_PACK_DRAFT_GENERATE_CTA,
  PROVIDER_PACK_DRAFT_STEP_INTRO,
  PROVIDER_PACK_DRAFT_VIEW_LIST,
  PROVIDER_PACK_WIZARD_DRAFT_STEP,
} from "@/lib/role-based-ux-copy";

export function ProviderPackDraftStep({
  packId,
  editable,
  sourceDocumentCount,
  draftRefreshNonce,
  onChanged,
}: {
  readonly packId: string;
  readonly editable: boolean;
  readonly sourceDocumentCount: number;
  readonly draftRefreshNonce: number;
  readonly onChanged: () => Promise<void>;
}) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedCount, setGeneratedCount] = useState<number | null>(null);
  const [showDraftList, setShowDraftList] = useState(false);

  const onGenerate = async () => {
    if (!editable) return;
    setGenerating(true);
    setError(null);
    try {
      const result = await generateGitHubKnowledgeUnitDraftsApi(packId, {
        generationMode: "MINIMAL",
        overwriteExistingDrafts: false,
      });
      setGeneratedCount(result.summary.generatedDraftCount);
      setShowDraftList(true);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Knowledge Unit 초안 생성에 실패했습니다.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <p className="text-xs font-bold uppercase tracking-wide text-store-accent">3단계</p>
      <h2 className="text-sm font-bold text-slate-900">{PROVIDER_PACK_WIZARD_DRAFT_STEP}</h2>
      <p className="mt-1 text-xs text-store-muted">{PROVIDER_PACK_DRAFT_STEP_INTRO}</p>
      <p className="mt-2 text-xs text-slate-700">원천 문서 {sourceDocumentCount}개 등록 완료</p>

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      {generatedCount != null ? (
        <p className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-950">
          Knowledge Unit 초안 {generatedCount}개 생성 완료
        </p>
      ) : null}

      <button
        type="button"
        disabled={!editable || generating || sourceDocumentCount === 0}
        onClick={() => void onGenerate()}
        className="mt-4 min-h-[44px] w-full rounded-xl bg-store-accent text-sm font-bold text-white disabled:opacity-50"
      >
        {generating ? "초안 생성 중…" : PROVIDER_PACK_DRAFT_GENERATE_CTA}
      </button>

      <button
        type="button"
        onClick={() => setShowDraftList((v) => !v)}
        className="mt-2 min-h-[44px] w-full rounded-xl border border-store-border bg-white text-sm font-semibold text-slate-800"
      >
        {showDraftList ? "초안 목록 접기" : PROVIDER_PACK_DRAFT_VIEW_LIST}
      </button>

      {showDraftList ? (
        <ProviderKnowledgeUnitDraftPanel packId={packId} refreshNonce={draftRefreshNonce} compact />
      ) : null}
    </section>
  );
}
