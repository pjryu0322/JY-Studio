"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminKnowledgeUnitDraftDto } from "@/lib/admin-knowledge-unit-draft-dto";
import { canDecideKnowledgeUnitDraft } from "@/lib/admin-knowledge-unit-draft-ui-utils";
import {
  decideAdminKnowledgeUnitDraftApi,
  fetchAdminKnowledgeUnitDraftsApi,
} from "@/lib/admin-center-api";
import { getSourceFormatLabel, getSourceTypeLabel } from "@/lib/source-type-dto";

const inputClass =
  "min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm disabled:opacity-60";

type StatusFilter = "pending_review" | "approved" | "rejected" | "superseded" | "all";

function ReviewStatusBadge({ status }: { readonly status: string }) {
  const tone =
    status === "pending_review"
      ? "bg-amber-100 text-amber-900"
      : status === "approved"
        ? "bg-emerald-100 text-emerald-900"
        : status === "rejected"
          ? "bg-red-100 text-red-900"
          : status === "superseded"
            ? "bg-slate-200 text-slate-700"
            : "bg-slate-100 text-slate-700";
  return (
    <span className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold ${tone}`}>{status}</span>
  );
}

function AdminDraftCard({
  draft,
  onDecided,
}: {
  readonly draft: AdminKnowledgeUnitDraftDto;
  readonly onDecided: () => void;
}) {
  const [showContent, setShowContent] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const [memo, setMemo] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [submitting, setSubmitting] = useState<"approve" | "reject" | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const canDecide = canDecideKnowledgeUnitDraft({ reviewStatus: draft.reviewStatus, isActive: false });
  const sourceTypeLabel = draft.sourceType ? getSourceTypeLabel(draft.sourceType) : "—";
  const sourceFormatLabel = draft.sourceFormat ? getSourceFormatLabel(draft.sourceFormat) : "—";

  const runDecision = async (decision: "approve" | "reject") => {
    if (decision === "reject" && !rejectionReason.trim()) {
      setFormError("반려 사유를 입력해 주세요.");
      return;
    }
    setFormError(null);
    setSubmitting(decision);
    try {
      await decideAdminKnowledgeUnitDraftApi(draft.id, {
        decision,
        memo: memo.trim() || undefined,
        rejectionReason: decision === "reject" ? rejectionReason.trim() : undefined,
      });
      onDecided();
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setFormError(
        decision === "approve"
          ? message || "승인 처리에 실패했습니다."
          : message || "반려 처리에 실패했습니다.",
      );
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <li className="rounded-xl border border-store-border bg-white px-3 py-3 text-xs">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-slate-900">{draft.title}</p>
          <p className="mt-0.5 break-all text-store-muted">
            {draft.packName} · {draft.packId}
          </p>
          <p className="text-store-muted">Provider: {draft.providerName}</p>
        </div>
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
      </p>
      <p className="mt-1 text-[11px] text-store-muted">
        생성 {new Date(draft.createdAt).toLocaleString("ko-KR")}
      </p>
      {draft.reviewedAt ? (
        <p className="mt-1 text-[11px] text-store-muted">
          검토 {new Date(draft.reviewedAt).toLocaleString("ko-KR")}
          {draft.reviewedBy ? ` · ${draft.reviewedBy}` : ""}
        </p>
      ) : null}

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
          {draft.sourceUrl ? <p className="break-all">sourceUrl: {draft.sourceUrl}</p> : null}
          {draft.productProfileType ? (
            <p className="mt-1">productProfileType: {draft.productProfileType}</p>
          ) : null}
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

      {canDecide ? (
        <div className="mt-3 space-y-2 border-t border-store-border pt-3">
          <label className="block text-xs font-semibold">
            검토 메모 (선택)
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="mt-1 min-h-[88px] w-full rounded-xl border border-store-border px-3 py-2 text-sm"
              disabled={submitting !== null}
            />
          </label>
          <label className="block text-xs font-semibold">
            반려 사유 (반려 시 필수)
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="mt-1 min-h-[88px] w-full rounded-xl border border-store-border px-3 py-2 text-sm"
              disabled={submitting !== null}
            />
          </label>
          {formError ? <p className="text-sm text-red-700">{formError}</p> : null}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={submitting !== null}
              onClick={() => void runDecision("approve")}
              className="min-h-[44px] rounded-xl bg-store-accent px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {submitting === "approve" ? "승인 중…" : "승인"}
            </button>
            <button
              type="button"
              disabled={submitting !== null}
              onClick={() => void runDecision("reject")}
              className="min-h-[44px] rounded-xl border border-red-300 bg-white px-4 text-sm font-semibold text-red-800 disabled:opacity-50"
            >
              {submitting === "reject" ? "반려 중…" : "반려"}
            </button>
          </div>
        </div>
      ) : draft.reviewStatus === "approved" ? (
        <p className="mt-3 rounded-lg bg-slate-50 px-2 py-2 text-[11px] text-store-muted">
          승인된 초안은 아직 Context API에 노출되지 않습니다. 활성화는 P26.10에서 처리됩니다.
        </p>
      ) : null}
    </li>
  );
}

export function AdminKnowledgeUnitDraftReviewPanel() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending_review");
  const [packIdFilter, setPackIdFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchAdminKnowledgeUnitDraftsApi>> | null>(
    null,
  );

  const loadDrafts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAdminKnowledgeUnitDraftsApi({
        status: statusFilter,
        packId: packIdFilter.trim() || undefined,
        limit: 50,
      });
      setData(result);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : "Knowledge Unit draft를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, packIdFilter]);

  useEffect(() => {
    void loadDrafts();
  }, [loadDrafts]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-store-border bg-slate-50 p-4">
        <p className="text-xs text-store-muted">
          Knowledge Unit 초안 단위 승인/반려입니다. Pack 승인과 별도이며, 활성화(Context 노출)는 P26.10입니다.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label className="block text-xs font-semibold">
          상태 필터
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className={`mt-1 ${inputClass}`}
          >
            <option value="pending_review">pending_review</option>
            <option value="approved">approved</option>
            <option value="rejected">rejected</option>
            <option value="superseded">superseded</option>
            <option value="all">all</option>
          </select>
        </label>
        <label className="block text-xs font-semibold">
          packId 필터
          <input
            type="text"
            value={packIdFilter}
            onChange={(e) => setPackIdFilter(e.target.value)}
            placeholder="packId (선택)"
            className={`mt-1 ${inputClass}`}
          />
        </label>
        <button
          type="button"
          onClick={() => void loadDrafts()}
          disabled={loading}
          className="min-h-[44px] rounded-xl border border-store-border bg-white px-4 text-sm font-semibold disabled:opacity-50"
        >
          {loading ? "불러오는 중…" : "새로고침"}
        </button>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {data ? (
        <div className="rounded-xl border border-store-border bg-white p-3 text-xs text-slate-800">
          <p>
            전체 {data.summary.totalCount}개 · 검토 대기 {data.summary.pendingReviewCount}개 · 승인{" "}
            {data.summary.approvedCount}개 · 반려 {data.summary.rejectedCount}개 · 대체됨{" "}
            {data.summary.supersededCount}개 · 활성 draft {data.summary.activeDraftCount}개
          </p>
        </div>
      ) : null}

      {!loading && data && data.items.length === 0 ? (
        <p className="text-sm text-store-muted">표시할 Knowledge Unit draft가 없습니다.</p>
      ) : null}

      {data && data.items.length > 0 ? (
        <ul className="space-y-3">
          {data.items.map((draft) => (
            <AdminDraftCard key={draft.id} draft={draft} onDecided={loadDrafts} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
