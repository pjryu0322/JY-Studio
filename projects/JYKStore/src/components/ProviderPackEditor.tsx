"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ProviderPackChunkSummaryCard } from "@/components/ProviderPackChunkSummaryCard";
import { ProviderPackDraftStep } from "@/components/ProviderPackDraftStep";
import { ProviderPackReadinessCard } from "@/components/ProviderPackReadinessCard";
import { ProviderPackSourceStep } from "@/components/ProviderPackSourceStep";
import { ProviderPackStatusBadge } from "@/components/ProviderPackStatusBadge";
import { ProviderPackWizardStepper } from "@/components/ProviderPackWizardStepper";
import { ProviderKnowledgeUnitDraftPanel } from "@/components/ProviderKnowledgeUnitDraftPanel";
import { SourceValidationBadge } from "@/components/SourceValidationBadge";
import { SourceValidationReportPanel } from "@/components/SourceValidationReportPanel";
import type { ProviderPackDetailDto } from "@/lib/provider-pack-dto";
import {
  fetchProviderPack,
  fetchProviderKnowledgeUnitDraftsApi,
  submitProviderPackApi,
  updateProviderPackApi,
  validateSourceDocumentApi,
  evaluateProviderStructureQualityApi,
  evaluateProviderChunkQualityApi,
  generateProviderRetrievalEvaluationCasesApi,
  runProviderRetrievalEvaluationApi,
} from "@/lib/provider-center-api";
import { StructureQualityPanel } from "@/components/StructureQualityPanel";
import { ChunkQualityPanel } from "@/components/ChunkQualityPanel";
import { RetrievalEvaluationPanel } from "@/components/RetrievalEvaluationPanel";
import { getSourceFormatLabel, getSourceTypeLabel } from "@/lib/source-type-dto";
import { resolveProviderPackNextAction } from "@/lib/provider-onboarding-steps";
import { resolveProviderPackWizardStep } from "@/lib/provider-pack-wizard";
import {
  PROVIDER_PACK_BASIC_INFO_SUMMARY,
  PROVIDER_PACK_CREATED_BANNER_TITLE,
  PROVIDER_PACK_CREATED_COLLECT_CTA,
  PROVIDER_PACK_CREATED_ID_PREFIX,
  PROVIDER_PACK_CREATED_NEXT_TASK,
  PROVIDER_PACK_ID_LABEL,
  PROVIDER_PACK_PRE_REVIEW_CHECKS_SUMMARY,
  PROVIDER_PACK_REVIEW_SUBMIT_CTA,
  PROVIDER_REVIEW_READONLY_HINT,
} from "@/lib/role-based-ux-copy";

export function ProviderPackEditor({ packId }: { readonly packId: string }) {
  const searchParams = useSearchParams();
  const showCreatedBanner = searchParams.get("created") === "1";
  const [pack, setPack] = useState<ProviderPackDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [validatingDocId, setValidatingDocId] = useState<string | null>(null);
  const [draftRefreshNonce, setDraftRefreshNonce] = useState(0);
  const [knowledgeUnitDraftCount, setKnowledgeUnitDraftCount] = useState(0);

  const [name, setName] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [versionOverview, setVersionOverview] = useState("");

  const editable = pack?.status === "DRAFT";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProviderPack(packId);
      setPack(data.pack);
      setName(data.pack.name);
      setShortDescription(data.pack.shortDescription);
      setDescription(data.pack.description);
      setVersionOverview(data.pack.versions[0]?.overview ?? "");
      setDraftRefreshNonce((n) => n + 1);
      if (data.pack.status === "DRAFT") {
        try {
          const drafts = await fetchProviderKnowledgeUnitDraftsApi(packId);
          setKnowledgeUnitDraftCount(drafts.items.length);
        } catch {
          setKnowledgeUnitDraftCount(0);
        }
      } else {
        setKnowledgeUnitDraftCount(0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "지식팩을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [packId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editable) return;
    setSaving(true);
    setError(null);
    try {
      const data = await updateProviderPackApi(packId, {
        name,
        shortDescription,
        description,
        versionOverview,
      });
      setPack(data.pack);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const onRevalidateDoc = async (sourceDocumentId: string) => {
    if (!editable) return;
    setValidatingDocId(sourceDocumentId);
    setError(null);
    try {
      const data = await validateSourceDocumentApi(packId, sourceDocumentId);
      setPack(data.pack);
    } catch (err) {
      setError(err instanceof Error ? err.message : "재검증에 실패했습니다.");
    } finally {
      setValidatingDocId(null);
    }
  };

  const onSubmitReview = async () => {
    if (!editable) return;
    const ok = window.confirm("검수 요청을 제출할까요? 제출 후에는 초안 수정이 제한됩니다.");
    if (!ok) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = await submitProviderPackApi(packId);
      setPack(data.pack);
    } catch (err) {
      setError(err instanceof Error ? err.message : "검수 요청에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-store-muted">불러오는 중…</p>;
  }

  if (!pack) {
    return <p className="text-sm text-red-700">{error ?? "지식팩을 찾을 수 없습니다."}</p>;
  }

  const latestVersion = pack.versions[0];
  const allDocs = pack.versions.flatMap((v) => v.sourceDocuments);
  const sourceDocumentCount = allDocs.length;
  const nextAction = resolveProviderPackNextAction({
    status: pack.status,
    sourceDocumentCount,
    knowledgeUnitDraftCount,
    justCreated: showCreatedBanner,
  });
  const wizardStep = resolveProviderPackWizardStep({
    status: pack.status,
    sourceDocumentCount,
    knowledgeUnitDraftCount,
    forceSourceStep: showCreatedBanner,
  });
  const showPreReviewChecks =
    pack.status === "DRAFT" && (sourceDocumentCount > 0 || knowledgeUnitDraftCount > 0);
  const isDraftWizard = pack.status === "DRAFT";

  return (
    <div className="space-y-4 pb-6">
      {showCreatedBanner ? (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-slate-900">
          <p className="font-semibold">{PROVIDER_PACK_CREATED_BANNER_TITLE}</p>
          <p className="mt-1 text-xs text-slate-700">
            {PROVIDER_PACK_CREATED_ID_PREFIX}{" "}
            <span className="font-mono font-semibold text-slate-900">{pack.packId}</span>
          </p>
          <p className="mt-1 text-xs text-slate-700">{PROVIDER_PACK_CREATED_NEXT_TASK}</p>
          <a
            href="#pack-wizard-main"
            className="mt-2 inline-block text-xs font-bold text-store-accent underline-offset-2 hover:underline"
          >
            {PROVIDER_PACK_CREATED_COLLECT_CTA}
          </a>
        </div>
      ) : (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-slate-900">
          <p className="font-semibold">{nextAction.title}</p>
          <p className="mt-1 text-xs text-slate-700">{nextAction.body}</p>
          {nextAction.href ? (
            <a
              href={nextAction.href}
              className="mt-2 inline-block text-xs font-bold text-store-accent underline-offset-2 hover:underline"
            >
              바로 이동
            </a>
          ) : null}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-2xl">{pack.icon}</span>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold text-slate-900">{pack.name}</h1>
          <p className="text-xs text-store-muted">
            <span className="font-semibold text-slate-700">{PROVIDER_PACK_ID_LABEL}</span>{" "}
            <span className="font-mono">{pack.packId}</span>
          </p>
        </div>
        <ProviderPackStatusBadge status={pack.status} />
      </div>

      {isDraftWizard ? <ProviderPackWizardStepper wizardStep={wizardStep} /> : null}

      {pack.status === "REVIEWING" ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          검수 요청이 접수되었습니다. {PROVIDER_REVIEW_READONLY_HINT}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      <div id="pack-wizard-main" className="scroll-mt-24 space-y-4">
        {isDraftWizard && wizardStep === "source" ? (
          <ProviderPackSourceStep
            packId={packId}
            editable={editable}
            sourceDocumentCount={sourceDocumentCount}
            onChanged={load}
          />
        ) : null}

        {isDraftWizard && wizardStep === "draft-generation" ? (
          <ProviderPackDraftStep
            packId={packId}
            editable={editable}
            sourceDocumentCount={sourceDocumentCount}
            draftRefreshNonce={draftRefreshNonce}
            onChanged={load}
          />
        ) : null}

        {isDraftWizard && wizardStep === "review" ? (
          <section className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
            <p className="text-xs font-bold uppercase tracking-wide text-store-accent">4단계</p>
            <h2 className="text-sm font-bold text-slate-900">초안 확인 및 검수 요청</h2>
            <p className="mt-1 text-xs text-store-muted">
              Knowledge Unit 초안 {knowledgeUnitDraftCount}개 · 원천 문서 {sourceDocumentCount}개
            </p>
            <ProviderKnowledgeUnitDraftPanel packId={packId} refreshNonce={draftRefreshNonce} />
            <div id="pack-review" className="mt-4 scroll-mt-24">
              <button
                type="button"
                onClick={() => void onSubmitReview()}
                disabled={submitting}
                className="min-h-[44px] w-full rounded-xl bg-store-accent text-sm font-bold text-white disabled:opacity-50"
              >
                {submitting ? "제출 중…" : PROVIDER_PACK_REVIEW_SUBMIT_CTA}
              </button>
            </div>
          </section>
        ) : null}

        {!isDraftWizard && sourceDocumentCount > 0 ? (
          <section className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
            <h2 className="text-sm font-bold text-slate-900">원천 문서</h2>
            <ul className="mt-3 space-y-2">
              {allDocs.map((doc) => (
                <li key={doc.id} className="rounded-xl border border-store-border px-3 py-2 text-sm">
                  <p className="font-semibold text-slate-900">{doc.title}</p>
                  <p className="text-xs text-store-muted">{getSourceTypeLabel(doc.sourceType)}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      {isDraftWizard && sourceDocumentCount > 0 && wizardStep !== "source" ? (
        <details className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
          <summary className="cursor-pointer text-sm font-bold text-slate-900">등록된 원천 문서</summary>
          <ul className="mt-3 space-y-2">
            {allDocs.map((doc) => (
              <li key={doc.id} className="rounded-xl border border-store-border px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">{doc.title}</p>
                  <div className="flex items-center gap-2">
                    <SourceValidationBadge status={doc.validationStatus} />
                    {editable ? (
                      <button
                        type="button"
                        disabled={validatingDocId === doc.id}
                        onClick={() => void onRevalidateDoc(doc.id)}
                        className="min-h-[44px] rounded-lg border border-store-border px-3 text-xs font-semibold disabled:opacity-50 sm:min-h-0 sm:px-2 sm:py-1 sm:text-[11px]"
                      >
                        {validatingDocId === doc.id ? "검증 중…" : "재검증"}
                      </button>
                    ) : null}
                  </div>
                </div>
                <p className="text-xs text-store-muted">
                  {getSourceTypeLabel(doc.sourceType)} · {getSourceFormatLabel(doc.sourceFormat)}
                  {doc.sourceUrl ? ` · ${doc.sourceUrl}` : ""}
                </p>
                <SourceValidationReportPanel
                  score={doc.validationScore}
                  blockingIssueCount={doc.blockingIssueCount}
                  warningIssueCount={doc.warningIssueCount}
                  issues={doc.validationIssues}
                  maxVisibleIssues={5}
                />
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <details className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <summary className="cursor-pointer text-sm font-bold text-slate-900">
          {PROVIDER_PACK_BASIC_INFO_SUMMARY}
        </summary>
        <form onSubmit={onSave} className="mt-3 space-y-3">
          {!editable ? (
            <p className="text-xs text-store-muted">초안(DRAFT)이 아니면 수정할 수 없습니다.</p>
          ) : null}
          <label className="block text-xs font-semibold" htmlFor="edit-name">
            이름
          </label>
          <input
            id="edit-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!editable}
            className="min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm disabled:bg-slate-50"
          />
          <label className="block text-xs font-semibold" htmlFor="edit-short">
            짧은 설명
          </label>
          <textarea
            id="edit-short"
            value={shortDescription}
            onChange={(e) => setShortDescription(e.target.value)}
            disabled={!editable}
            rows={2}
            className="w-full rounded-xl border border-store-border px-3 py-2 text-sm disabled:bg-slate-50"
          />
          <label className="block text-xs font-semibold" htmlFor="edit-desc">
            설명
          </label>
          <textarea
            id="edit-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={!editable}
            rows={4}
            className="w-full rounded-xl border border-store-border px-3 py-2 text-sm disabled:bg-slate-50"
          />
          <label className="block text-xs font-semibold" htmlFor="edit-overview">
            버전 개요 ({latestVersion?.version ?? "—"})
          </label>
          <textarea
            id="edit-overview"
            value={versionOverview}
            onChange={(e) => setVersionOverview(e.target.value)}
            disabled={!editable}
            rows={3}
            className="w-full rounded-xl border border-store-border px-3 py-2 text-sm disabled:bg-slate-50"
          />
          {editable ? (
            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] w-full rounded-xl border border-store-border bg-white text-sm font-bold text-slate-800 disabled:opacity-50"
            >
              {saving ? "저장 중…" : "변경 저장"}
            </button>
          ) : null}
        </form>
      </details>

      {showPreReviewChecks ? (
        <details className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
          <summary className="cursor-pointer text-sm font-bold text-slate-900">
            {PROVIDER_PACK_PRE_REVIEW_CHECKS_SUMMARY}
          </summary>
          <div className="mt-4 space-y-4">
            <ProviderPackReadinessCard pack={pack} />
            <StructureQualityPanel
              packId={packId}
              structureQuality={pack.structureQuality}
              editable={editable}
              onEvaluate={async () => {
                const data = await evaluateProviderStructureQualityApi(packId);
                setPack(data.pack);
              }}
            />
            <ChunkQualityPanel
              packId={packId}
              chunkQuality={pack.chunkQuality}
              editable={editable}
              onEvaluate={async () => {
                const data = await evaluateProviderChunkQualityApi(packId);
                setPack(data.pack);
              }}
            />
            <RetrievalEvaluationPanel
              packId={packId}
              retrievalEvaluation={pack.retrievalEvaluation}
              editable={editable}
              onGenerate={async (replace) => {
                const data = await generateProviderRetrievalEvaluationCasesApi(packId, replace);
                setPack(data.pack);
              }}
              onRun={async () => {
                const data = await runProviderRetrievalEvaluationApi(packId);
                setPack(data.pack);
              }}
            />
            <ProviderPackChunkSummaryCard packId={packId} />
          </div>
        </details>
      ) : null}
    </div>
  );
}
