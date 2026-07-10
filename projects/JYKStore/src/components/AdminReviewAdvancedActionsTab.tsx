"use client";

import { useState } from "react";
import { AdminReviewDetailSections } from "@/components/AdminReviewDetailSections";
import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import {
  evaluateAdminChunkQualityApi,
  evaluateAdminReleaseGateApi,
  evaluateAdminStructureQualityApi,
  generateAdminRetrievalEvaluationCasesApi,
  refreshAdminReviewReadinessApi,
  runAdminRetrievalEvaluationApi,
} from "@/lib/admin-review-api";
import {
  ADMIN_REVIEW_ADVANCED_ACTIONS_TITLE,
  ADMIN_REVIEW_ADVANCED_TAB_HINT,
  ADMIN_REVIEW_CTA_REFRESH_ALL,
  ADMIN_REVIEW_CTA_RELEASE_GATE,
  ADMIN_REVIEW_CTA_RETRIEVAL_REEVAL,
} from "@/lib/role-based-ux-copy";

export function AdminReviewAdvancedActionsTab({
  packId,
  detail,
  onUpdated,
}: {
  readonly packId: string;
  readonly detail: AdminReviewDetailDto;
  readonly onUpdated: (detail: AdminReviewDetailDto) => void;
}) {
  const [busy, setBusy] = useState<"refresh" | "gate" | "retrieval" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onRefreshAll = async () => {
    setBusy("refresh");
    setError(null);
    setMessage(null);
    try {
      const res = await refreshAdminReviewReadinessApi(packId);
      onUpdated(res.detail);
      if (res.warnings && res.warnings.length > 0) {
        setMessage(`전체 재점검을 완료했습니다. (${res.warnings.join(" ")})`);
      } else {
        setMessage("최신 상태로 전체 재점검을 완료했습니다.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "전체 재점검에 실패했습니다.");
    } finally {
      setBusy(null);
    }
  };

  const onReleaseGate = async () => {
    setBusy("gate");
    setError(null);
    setMessage(null);
    try {
      const res = await evaluateAdminReleaseGateApi(packId);
      onUpdated(res.detail);
      setMessage("릴리스 게이트 재점검을 완료했습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "릴리스 게이트 점검에 실패했습니다.");
    } finally {
      setBusy(null);
    }
  };

  const onRetrievalReeval = async () => {
    setBusy("retrieval");
    setError(null);
    setMessage(null);
    try {
      const res = await runAdminRetrievalEvaluationApi(packId);
      onUpdated(res.detail);
      setMessage("검색 품질 재평가를 완료했습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "검색 품질 재평가에 실패했습니다.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <h2 className="text-sm font-bold text-slate-900">{ADMIN_REVIEW_ADVANCED_ACTIONS_TITLE}</h2>
        <p className="text-xs leading-relaxed text-store-muted">{ADMIN_REVIEW_ADVANCED_TAB_HINT}</p>

        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void onRefreshAll()}
          className="min-h-[48px] w-full rounded-xl border border-store-border bg-white text-sm font-semibold text-slate-800 disabled:opacity-50"
        >
          {busy === "refresh" ? "재점검 중…" : ADMIN_REVIEW_CTA_REFRESH_ALL}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void onReleaseGate()}
          className="min-h-[48px] w-full rounded-xl border border-store-border bg-white text-sm font-semibold text-slate-800 disabled:opacity-50"
        >
          {busy === "gate" ? "점검 중…" : ADMIN_REVIEW_CTA_RELEASE_GATE}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void onRetrievalReeval()}
          className="min-h-[48px] w-full rounded-xl border border-store-border bg-white text-sm font-semibold text-slate-800 disabled:opacity-50"
        >
          {busy === "retrieval" ? "재평가 중…" : ADMIN_REVIEW_CTA_RETRIEVAL_REEVAL}
        </button>

        {message ? <p className="text-sm font-semibold text-emerald-800">{message}</p> : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
      </section>

      <AdminReviewDetailSections
        packId={packId}
        detail={detail}
        onUpdated={onUpdated}
        actions={{
          evaluateStructure: async () => {
            const data = await evaluateAdminStructureQualityApi(packId);
            onUpdated(data.detail);
          },
          evaluateChunk: async () => {
            const data = await evaluateAdminChunkQualityApi(packId);
            onUpdated(data.detail);
          },
          generateRetrievalCases: async (replace) => {
            const data = await generateAdminRetrievalEvaluationCasesApi(packId, replace);
            onUpdated(data.detail);
          },
          runRetrievalEvaluation: async () => {
            const data = await runAdminRetrievalEvaluationApi(packId);
            onUpdated(data.detail);
          },
          evaluateReleaseGate: async () => {
            const data = await evaluateAdminReleaseGateApi(packId);
            onUpdated(data.detail);
          },
        }}
      />
    </div>
  );
}
