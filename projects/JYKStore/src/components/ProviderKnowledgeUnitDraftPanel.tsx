"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProviderKnowledgeUnitDraftDto } from "@/lib/provider-knowledge-unit-draft-dto";
import { fetchProviderKnowledgeUnitDraftsApi, generateGitHubKnowledgeUnitDraftsApi, resetProviderKnowledgeUnitDraftsApi } from "@/lib/provider-center-api";
import {
  buildKuProcessingNarrative,
  groupKuDraftsByTopic,
  kuDocumentStatusUserHint,
} from "@/lib/knowledge-unit-draft/ku-draft-processing-status";
import { parseUserFacingKuDraftContent } from "@/lib/knowledge-unit-draft/ku-draft-content";
import {
  PROVIDER_KU_CONTENT_VIEW,
  PROVIDER_KU_DRAFT_PANEL_TITLE,
  PROVIDER_KU_CANDIDATE_LABEL,
  PROVIDER_KU_DUPLICATE_CARD_HINT,
  PROVIDER_KU_EMPTY_LIST,
  PROVIDER_KU_EVIDENCE_DRAFT_RESULT,
  PROVIDER_KU_LOAD_FAILED,
  PROVIDER_KU_REGENERATE_FAILED,
  PROVIDER_KU_RESET_BUTTON,
  PROVIDER_KU_RESET_CONFIRM,
  PROVIDER_KU_RESET_SUCCESS,
  PROVIDER_KU_REGENERATE_BUTTON,
  PROVIDER_KU_EVIDENCE_VIEW,
  PROVIDER_KU_PREVIEW_GENERATION_BADGE,
  PROVIDER_KU_PROCESSING_DETAIL_TOGGLE,
  PROVIDER_KU_PROCESSING_TITLE,
  PROVIDER_KU_REVIEW_STATUS_PENDING,
  PROVIDER_KU_STATUS_DUPLICATE,
  PROVIDER_KU_STATUS_EXCLUDED,
  PROVIDER_KU_STATUS_FAILED,
  PROVIDER_KU_STATUS_GENERATED,
  PROVIDER_KU_STATUS_UNSUPPORTED,
} from "@/lib/role-based-ux-copy";

const inputClass =
  "min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm disabled:opacity-60";

type StatusFilter = "pending_review" | "superseded" | "all";

function documentStatusLabel(status: string): string {
  if (status === "generated") return "Unit 생성 완료";
  if (status === "duplicate") return "중복 제외";
  if (status === "excluded") return "생성 제외";
  if (status === "unsupported") return "지원 제외";
  if (status === "failed") return "처리 실패";
  if (status === "deduped") return "중복 제외";
  return status;
}

function documentStatusBadgeClass(status: string): string {
  if (status === "generated") return "bg-emerald-100 text-emerald-900";
  if (status === "duplicate" || status === "deduped") return "bg-slate-100 text-slate-700";
  if (status === "excluded") return "bg-sky-50 text-sky-900";
  if (status === "unsupported") return "bg-slate-100 text-slate-600";
  if (status === "failed") return "bg-red-100 text-red-900";
  return "bg-slate-100 text-slate-700";
}

function reviewStatusLabel(status: string): string {
  if (status === "pending_review") return PROVIDER_KU_REVIEW_STATUS_PENDING;
  if (status === "superseded") return "대체됨";
  return status;
}

function highlightExcerpt(source: string, needle: string | null): string {
  if (!needle?.trim() || !source) return source;
  const idx = source.toLowerCase().indexOf(needle.trim().toLowerCase().slice(0, 40));
  if (idx < 0) return source.slice(0, 800);
  const start = Math.max(0, idx - 120);
  return source.slice(start, start + 800);
}

function DraftCard({ draft }: { readonly draft: ProviderKnowledgeUnitDraftDto }) {
  const [showContent, setShowContent] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const parsed = useMemo(() => parseUserFacingKuDraftContent(draft.content), [draft.content]);
  const excerpt = draft.evidence?.excerpt ?? "";
  const highlightNeedle = draft.evidence?.headings?.[0] ?? draft.title;

  return (
    <li className="rounded-xl border border-store-border bg-white px-3 py-3 text-xs">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-bold text-slate-900">{draft.title}</p>
        <span className="rounded-lg bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
          {reviewStatusLabel(draft.reviewStatus)}
        </span>
      </div>
      {draft.topic ? <p className="mt-1 text-store-muted">주제: {draft.topic}</p> : null}
      {draft.canonicalSourcePath ? (
        <p className="mt-1 text-[11px] text-slate-600">출처: {draft.canonicalSourcePath}</p>
      ) : null}
      {draft.semanticTopicKey ? (
        <p className="mt-0.5 text-[10px] text-slate-500">주제 키: {draft.semanticTopicKey}</p>
      ) : null}
      {draft.duplicateSources && draft.duplicateSources.length > 0 ? (
        <p className="mt-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] text-slate-700">
          {PROVIDER_KU_DUPLICATE_CARD_HINT} (
          {(() => {
            const paths = draft.duplicateSources.map((s) => s.sourcePath ?? s.title);
            const shown = paths.slice(0, 3);
            const rest = paths.length - shown.length;
            return rest > 0 ? `${shown.join(", ")} 외 ${rest}건` : shown.join(", ");
          })()}
          )
        </p>
      ) : null}

      {draft.warnings.length > 0 ? (
        <ul className="mt-2 space-y-1 rounded-lg bg-amber-50 px-2 py-2 text-amber-950">
          {draft.warnings.map((warning) => (
            <li key={warning}>⚠ {warning}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => setShowContent((v) => !v)}
          className="min-h-[44px] rounded-lg border border-store-border px-3 text-xs font-semibold"
        >
          {showContent ? "내용 접기" : PROVIDER_KU_CONTENT_VIEW}
        </button>
        <button
          type="button"
          onClick={() => setShowEvidence((v) => !v)}
          className="min-h-[44px] rounded-lg border border-store-border px-3 text-xs font-semibold"
        >
          {showEvidence ? "근거 접기" : PROVIDER_KU_EVIDENCE_VIEW}
        </button>
      </div>

      {showContent ? (
        <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-800">
          <p className="font-semibold">설명</p>
          <p>{parsed.description}</p>
          {parsed.keyPoints.length > 0 ? (
            <>
              <p className="font-semibold">핵심 내용</p>
              <ul className="list-disc pl-4">
                {parsed.keyPoints.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </>
          ) : null}
          {parsed.exampleCode ? (
            <>
              <p className="font-semibold">예제 코드</p>
              <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-slate-900 p-2 text-slate-100">
                {parsed.exampleCode}
              </pre>
            </>
          ) : null}
          {parsed.relatedUnits.length > 0 ? (
            <>
              <p className="font-semibold">관련 Unit</p>
              <p>{parsed.relatedUnits.join(" · ")}</p>
            </>
          ) : null}
        </div>
      ) : null}

      {showEvidence ? (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-800">
            <p className="font-semibold">원문 발췌</p>
            <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap break-words">
              {highlightExcerpt(excerpt, highlightNeedle)}
            </pre>
          </div>
          <div className="rounded-lg bg-indigo-50 p-3 text-[11px] leading-relaxed text-indigo-950">
            <p className="font-semibold">{PROVIDER_KU_EVIDENCE_DRAFT_RESULT}</p>
            <p className="mt-1">{parsed.description}</p>
            {parsed.keyPoints[0] ? (
              <p className="mt-2 rounded bg-white/70 px-2 py-1">↳ {parsed.keyPoints[0]}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function ProviderKnowledgeUnitDraftPanel({
  packId,
  refreshNonce = 0,
  compact = false,
  editable = true,
  onRegenerated,
}: {
  readonly packId: string;
  readonly refreshNonce?: number;
  readonly compact?: boolean;
  readonly editable?: boolean;
  readonly onRegenerated?: () => Promise<void>;
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending_review");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showProcessingDetail, setShowProcessingDetail] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchProviderKnowledgeUnitDraftsApi>> | null>(
    null,
  );

  const loadDrafts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchProviderKnowledgeUnitDraftsApi(packId, {
        status: statusFilter,
        limit: 80,
      });
      setData(result);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : PROVIDER_KU_LOAD_FAILED);
    } finally {
      setLoading(false);
    }
  }, [packId, statusFilter]);

  useEffect(() => {
    void loadDrafts();
  }, [loadDrafts, refreshNonce]);

  const grouped = useMemo(
    () => (data ? groupKuDraftsByTopic(data.items) : []),
    [data],
  );

  const processingNarrative = useMemo(
    () => (data ? buildKuProcessingNarrative(data.processing) : ""),
    [data],
  );

  const handleReset = useCallback(async () => {
    if (!window.confirm(PROVIDER_KU_RESET_CONFIRM)) return;
    setResetting(true);
    setResetMessage(null);
    setError(null);
    try {
      await resetProviderKnowledgeUnitDraftsApi(packId);
      setResetMessage(PROVIDER_KU_RESET_SUCCESS);
      await loadDrafts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "초기화에 실패했습니다.");
    } finally {
      setResetting(false);
    }
  }, [packId, loadDrafts]);

  const handleRegenerate = useCallback(async () => {
    if (!editable) return;
    setRegenerating(true);
    setError(null);
    setResetMessage(null);
    try {
      await generateGitHubKnowledgeUnitDraftsApi(packId, {
        generationMode: "MINIMAL",
        overwriteExistingDrafts: false,
        autoPrepareForReview: true,
        autoRunRetrievalEvaluation: true,
      });
      await onRegenerated?.();
      await loadDrafts();
    } catch (err) {
      setError(err instanceof Error ? err.message : PROVIDER_KU_REGENERATE_FAILED);
    } finally {
      setRegenerating(false);
    }
  }, [editable, packId, onRegenerated, loadDrafts]);

  return (
    <div className={compact ? "mt-3" : "mt-4 rounded-2xl border border-store-border bg-slate-50 p-4"}>
      {!compact ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-bold text-slate-900">{PROVIDER_KU_DRAFT_PANEL_TITLE}</h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleRegenerate()}
              disabled={!editable || loading || regenerating || resetting}
              className="min-h-[44px] rounded-xl bg-store-accent px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {regenerating ? "재생성 중…" : PROVIDER_KU_REGENERATE_BUTTON}
            </button>
            <button
              type="button"
              onClick={() => void handleReset()}
              disabled={loading || resetting || regenerating}
              className="min-h-[44px] rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-900 disabled:opacity-50"
            >
              {resetting ? "초기화 중…" : PROVIDER_KU_RESET_BUTTON}
            </button>
          </div>
        </div>
      ) : null}

      {data ? (
        <div className="mt-3 rounded-xl border border-store-border bg-white p-3 text-xs text-slate-800">
          <p className="font-bold">{PROVIDER_KU_PROCESSING_TITLE}</p>
          <p className="mt-1">원천 문서 {data.processing.sourceDocumentTotal}개</p>
          {data.processing.isPreviewGeneration ? (
            <p className="mt-1 rounded-lg bg-amber-50 px-2 py-1 text-amber-900">
              {PROVIDER_KU_PREVIEW_GENERATION_BADGE}
            </p>
          ) : null}
          <p className="mt-2 text-[11px] leading-relaxed text-slate-700">{processingNarrative}</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <p>
              {PROVIDER_KU_STATUS_GENERATED} <strong>{data.processing.generated}</strong>개
            </p>
            <p>
              {PROVIDER_KU_STATUS_DUPLICATE} <strong>{data.processing.duplicate}</strong>개
            </p>
            <p>
              {PROVIDER_KU_STATUS_EXCLUDED} <strong>{data.processing.excluded}</strong>개
            </p>
            <p>
              {PROVIDER_KU_STATUS_UNSUPPORTED} <strong>{data.processing.unsupported}</strong>개
            </p>
            {data.processing.failed > 0 ? (
              <p className="text-red-700">
                {PROVIDER_KU_STATUS_FAILED} <strong>{data.processing.failed}</strong>개
              </p>
            ) : (
              <p className="text-slate-600">
                {PROVIDER_KU_STATUS_FAILED} <strong>0</strong>개
              </p>
            )}
          </div>
          <p className="mt-2 text-[11px] text-store-muted">
            처리 완료율 <strong>{data.processing.progressPercent}%</strong>
          </p>
          <button
            type="button"
            onClick={() => setShowProcessingDetail((v) => !v)}
            className="mt-2 text-xs font-bold text-store-accent underline-offset-2 hover:underline"
          >
            {showProcessingDetail ? "상세 접기" : PROVIDER_KU_PROCESSING_DETAIL_TOGGLE}
          </button>
          {showProcessingDetail ? (
            <ul className="mt-2 space-y-2">
              {data.documentProcessing.map((doc) => (
                <li
                  key={doc.sourceDocumentId}
                  className={`rounded-lg border border-store-border px-2 py-2 ${documentStatusBadgeClass(doc.status)}`}
                >
                  <p className="font-semibold break-all">{doc.path}</p>
                  <p>
                    상태: {documentStatusLabel(doc.status)}
                    {doc.reason ? ` · ${doc.reason}` : ""}
                  </p>
                  <p className="mt-0.5 text-[10px] opacity-90">{kuDocumentStatusUserHint(doc.status)}</p>
                  {doc.generatedUnitTitles.length > 0 ? (
                    <p className="mt-1">생성 Unit: {doc.generatedUnitTitles.join(", ")}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {!compact ? (
        <div className="mt-3">
          <label className="block text-xs font-semibold">
            상태 필터
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className={`mt-1 ${inputClass}`}
            >
              <option value="pending_review">{PROVIDER_KU_REVIEW_STATUS_PENDING}</option>
              <option value="superseded">대체됨</option>
              <option value="all">전체</option>
            </select>
          </label>
        </div>
      ) : null}

      {resetMessage ? <p className="mt-2 text-xs font-semibold text-emerald-800">{resetMessage}</p> : null}

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      {data ? (
        <p className="mt-3 text-xs text-slate-700">
          {PROVIDER_KU_CANDIDATE_LABEL} {data.summary.totalCount}개 · {PROVIDER_KU_REVIEW_STATUS_PENDING}{" "}
          {data.summary.pendingReviewCount}개
        </p>
      ) : null}

      {!loading && data && data.items.length === 0 ? (
        <p className="mt-3 text-sm text-store-muted">{PROVIDER_KU_EMPTY_LIST}</p>
      ) : null}

      {grouped.length > 0 ? (
        <div className="mt-3 space-y-4">
          {grouped.map((group) => (
            <section key={group.topic}>
              <h4 className="text-xs font-bold uppercase tracking-wide text-store-accent">{group.topic}</h4>
              <ul className="mt-2 space-y-3">
                {group.items.map((draft) => (
                  <DraftCard key={draft.id} draft={draft} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
