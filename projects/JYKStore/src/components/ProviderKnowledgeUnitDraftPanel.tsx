"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProviderKnowledgeUnitDraftDto } from "@/lib/provider-knowledge-unit-draft-dto";
import { fetchProviderKnowledgeUnitDraftsApi } from "@/lib/provider-center-api";
import {
  buildKuProcessingNarrative,
  groupKuDraftsByTopic,
} from "@/lib/knowledge-unit-draft/ku-draft-processing-status";
import { parseUserFacingKuDraftContent } from "@/lib/knowledge-unit-draft/ku-draft-content";
import {
  PROVIDER_KU_CONTENT_VIEW,
  PROVIDER_KU_DRAFT_PANEL_TITLE,
  PROVIDER_KU_EVIDENCE_VIEW,
  PROVIDER_KU_EXCLUDED_GUIDANCE,
  PROVIDER_KU_PREVIEW_GENERATION_BADGE,
  PROVIDER_KU_PROCESSING_DETAIL_TOGGLE,
  PROVIDER_KU_PROCESSING_TITLE,
  PROVIDER_KU_REVIEW_GUIDANCE,
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
            <p className="font-semibold">AI 생성 결과</p>
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
}: {
  readonly packId: string;
  readonly refreshNonce?: number;
  readonly compact?: boolean;
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending_review");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showProcessingDetail, setShowProcessingDetail] = useState(false);
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
      setError(err instanceof Error ? err.message : "AI 추출 결과를 불러오지 못했습니다.");
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

  return (
    <div className={compact ? "mt-3" : "mt-4 rounded-2xl border border-store-border bg-slate-50 p-4"}>
      {!compact ? (
        <>
          <h3 className="text-sm font-bold text-slate-900">{PROVIDER_KU_DRAFT_PANEL_TITLE}</h3>
          <p className="mt-1 text-xs text-store-muted">
            {PROVIDER_KU_REVIEW_GUIDANCE} {PROVIDER_KU_EXCLUDED_GUIDANCE}
          </p>
        </>
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
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <label className="block flex-1 text-xs font-semibold">
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
          <button
            type="button"
            onClick={() => void loadDrafts()}
            disabled={loading}
            className="min-h-[44px] rounded-xl border border-store-border bg-white px-4 text-sm font-semibold disabled:opacity-50 sm:self-end"
          >
            {loading ? "불러오는 중…" : "새로고침"}
          </button>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      {data ? (
        <p className="mt-3 text-xs text-slate-700">
          AI 추출 Unit {data.summary.totalCount}개 · {PROVIDER_KU_REVIEW_STATUS_PENDING}{" "}
          {data.summary.pendingReviewCount}개
        </p>
      ) : null}

      {!loading && data && data.items.length === 0 ? (
        <p className="mt-3 text-sm text-store-muted">표시할 AI 추출 결과가 없습니다.</p>
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
