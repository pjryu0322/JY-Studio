"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProviderKnowledgeUnitDraftDto } from "@/lib/provider-knowledge-unit-draft-dto";
import { fetchProviderKnowledgeUnitDraftsApi } from "@/lib/provider-center-api";
import { getSourceFormatLabel, getSourceTypeLabel } from "@/lib/source-type-dto";

const inputClass =
  "min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm disabled:opacity-60";

type StatusFilter = "pending_review" | "superseded" | "all";

function ReviewStatusBadge({ status }: { readonly status: string }) {
  const tone =
    status === "pending_review"
      ? "bg-amber-100 text-amber-900"
      : status === "superseded"
        ? "bg-slate-200 text-slate-700"
        : "bg-slate-100 text-slate-700";
  return (
    <span className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold ${tone}`}>{status}</span>
  );
}

function DraftCard({ draft }: { readonly draft: ProviderKnowledgeUnitDraftDto }) {
  const [showContent, setShowContent] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);

  const sourceTypeLabel = draft.sourceType ? getSourceTypeLabel(draft.sourceType) : "—";
  const sourceFormatLabel = draft.sourceFormat ? getSourceFormatLabel(draft.sourceFormat) : "—";

  return (
    <li className="rounded-xl border border-store-border bg-white px-3 py-3 text-xs">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-bold text-slate-900">{draft.title}</p>
        <ReviewStatusBadge status={draft.reviewStatus} />
      </div>
      {draft.sourcePath ? (
        <p className="mt-1 break-all text-store-muted">경로: {draft.sourcePath}</p>
      ) : null}
      {draft.sourceDocument ? (
        <p className="mt-1 break-all text-store-muted">
          출처 문서: {draft.sourceDocument.title} · 검증 {draft.sourceDocument.validationStatus}
        </p>
      ) : null}
      <p className="mt-1 text-store-muted">
        {sourceTypeLabel} · {sourceFormatLabel}
        {draft.tags.length > 0 ? ` · ${draft.tags.join(", ")}` : ""}
      </p>
      <p className="mt-1 text-[11px] text-store-muted">
        생성 {new Date(draft.createdAt).toLocaleString("ko-KR")}
        {draft.generatedBy ? ` · ${draft.generatedBy}` : ""}
      </p>

      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => setShowContent((v) => !v)}
          className="min-h-[44px] rounded-lg border border-store-border px-3 text-xs font-semibold"
        >
          {showContent ? "내용 접기" : "내용 보기"}
        </button>
        <button
          type="button"
          onClick={() => setShowEvidence((v) => !v)}
          className="min-h-[44px] rounded-lg border border-store-border px-3 text-xs font-semibold"
        >
          {showEvidence ? "근거 접기" : "근거 보기"}
        </button>
      </div>

      {showContent ? (
        <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-800">
          {draft.content}
        </pre>
      ) : null}

      {showEvidence ? (
        <div className="mt-2 rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-800">
          {draft.sourceUrl ? (
            <p className="break-all">
              sourceUrl: {draft.sourceUrl}
            </p>
          ) : null}
          {draft.productProfileType ? <p className="mt-1">productProfileType: {draft.productProfileType}</p> : null}
          {draft.evidence?.headings && draft.evidence.headings.length > 0 ? (
            <p className="mt-1">headings: {draft.evidence.headings.join(" · ")}</p>
          ) : null}
          {draft.evidence?.keywords && draft.evidence.keywords.length > 0 ? (
            <p className="mt-1 break-all">keywords: {draft.evidence.keywords.join(" · ")}</p>
          ) : null}
          {draft.sourceDocument?.validationSummary ? (
            <p className="mt-1 text-amber-900">{draft.sourceDocument.validationSummary}</p>
          ) : null}
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
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchProviderKnowledgeUnitDraftsApi>> | null>(
    null,
  );

  const loadDrafts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchProviderKnowledgeUnitDraftsApi(packId, {
        status: statusFilter,
        limit: 50,
      });
      setData(result);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : "Knowledge Unit 초안을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [packId, statusFilter]);

  useEffect(() => {
    void loadDrafts();
  }, [loadDrafts, refreshNonce]);

  return (
    <div className={compact ? "mt-3" : "mt-4 rounded-2xl border border-store-border bg-slate-50 p-4"}>
      {!compact ? (
        <>
          <h3 className="text-sm font-bold text-slate-900">Knowledge Unit 초안</h3>
          <p className="mt-1 text-xs text-store-muted">
            생성된 초안은 아직 공개되지 않습니다. 검토/승인 단계에서 활성화됩니다.
          </p>
          <p className="mt-1 text-[11px] text-store-muted">
            승인/반려는 Admin 검토 단계(P26.9)에서 처리됩니다.
          </p>
        </>
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
              <option value="pending_review">pending_review</option>
              <option value="superseded">superseded</option>
              <option value="all">all</option>
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
        <div
          className={`${compact ? "mt-0" : "mt-3"} rounded-xl border border-store-border bg-white p-3 text-xs text-slate-800`}
        >
          {!compact ? (
            <p>
              전체 {data.summary.totalCount}개 · 검토 대기 {data.summary.pendingReviewCount}개 · 대체됨{" "}
              {data.summary.supersededCount}개 · 활성 draft {data.summary.activeDraftCount}개
            </p>
          ) : (
            <p className="font-semibold">생성된 초안 {data.summary.totalCount}개</p>
          )}
          {data.summary.activeDraftCount > 0 ? (
            <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-amber-900">
              비활성 draft가 아닌 항목이 포함되어 있습니다. 활성화 상태를 확인하세요.
            </p>
          ) : null}
        </div>
      ) : null}

      {!loading && data && data.items.length === 0 ? (
        <p className="mt-3 text-sm text-store-muted">표시할 Knowledge Unit 초안이 없습니다.</p>
      ) : null}

      {data && data.items.length > 0 ? (
        <ul className="mt-3 space-y-3">
          {data.items.map((draft) => (
            <DraftCard key={draft.id} draft={draft} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
