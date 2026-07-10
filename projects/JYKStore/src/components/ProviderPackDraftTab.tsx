"use client";

import { useState } from "react";
import { ProviderKnowledgeUnitDraftPanel } from "@/components/ProviderKnowledgeUnitDraftPanel";
import { generateGitHubKnowledgeUnitDraftsApi } from "@/lib/provider-center-api";
import {
  PROVIDER_PACK_DRAFT_EMPTY_SOURCES,
  PROVIDER_PACK_DRAFT_GENERATE_CTA,
  PROVIDER_PACK_DRAFT_STEP_INTRO,
  PROVIDER_PACK_GO_TO_SOURCE_TAB,
  PROVIDER_PACK_WIZARD_DRAFT_STEP,
} from "@/lib/role-based-ux-copy";

export function ProviderPackDraftTab({
  packId,
  editable,
  sourceDocumentCount,
  knowledgeUnitDraftCount,
  draftRefreshNonce,
  onChanged,
  onGoToSourceTab,
}: {
  readonly packId: string;
  readonly editable: boolean;
  readonly sourceDocumentCount: number;
  readonly knowledgeUnitDraftCount: number;
  readonly draftRefreshNonce: number;
  readonly onChanged: () => Promise<void>;
  readonly onGoToSourceTab: () => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onGenerate = async () => {
    if (!editable) return;
    setGenerating(true);
    setError(null);
    try {
      await generateGitHubKnowledgeUnitDraftsApi(packId, {
        generationMode: "MINIMAL",
        overwriteExistingDrafts: false,
      });
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Knowledge Unit 초안 생성에 실패했습니다.");
    } finally {
      setGenerating(false);
    }
  };

  if (sourceDocumentCount === 0) {
    return (
      <section className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <h2 className="text-sm font-bold text-slate-900">{PROVIDER_PACK_WIZARD_DRAFT_STEP}</h2>
        <p className="mt-2 text-sm text-store-muted">{PROVIDER_PACK_DRAFT_EMPTY_SOURCES}</p>
        <button
          type="button"
          onClick={onGoToSourceTab}
          className="mt-4 min-h-[44px] w-full rounded-xl bg-store-accent text-sm font-bold text-white"
        >
          {PROVIDER_PACK_GO_TO_SOURCE_TAB}
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <h2 className="text-sm font-bold text-slate-900">{PROVIDER_PACK_WIZARD_DRAFT_STEP}</h2>
      <p className="mt-1 text-xs text-store-muted">{PROVIDER_PACK_DRAFT_STEP_INTRO}</p>
      <p className="mt-2 text-xs text-slate-700">원천 문서 {sourceDocumentCount}개</p>

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      {knowledgeUnitDraftCount === 0 ? (
        <button
          type="button"
          disabled={!editable || generating}
          onClick={() => void onGenerate()}
          className="mt-4 min-h-[44px] w-full rounded-xl bg-store-accent text-sm font-bold text-white disabled:opacity-50"
        >
          {generating ? "초안 생성 중…" : PROVIDER_PACK_DRAFT_GENERATE_CTA}
        </button>
      ) : (
        <ProviderKnowledgeUnitDraftPanel packId={packId} refreshNonce={draftRefreshNonce} />
      )}
    </section>
  );
}
