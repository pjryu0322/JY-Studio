"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminChunkManager } from "@/components/AdminChunkManager";
import { AdminReviewDecisionPanel } from "@/components/AdminReviewDecisionPanel";
import { AdminReviewPackSummary } from "@/components/AdminReviewPackSummary";
import { AdminReviewSourceDocuments } from "@/components/AdminReviewSourceDocuments";
import { ExportPanel } from "@/components/ExportPanel";
import { KnowledgeGraphPanel } from "@/components/KnowledgeGraphPanel";
import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import { fetchAdminReviewDetail } from "@/lib/admin-review-api";

export function AdminReviewDetailPageClient({ packId }: { readonly packId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminReviewDetailDto | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminReviewDetail(packId);
      setDetail(data.detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "검수 상세를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [packId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading) {
    return <p className="text-sm text-store-muted">불러오는 중…</p>;
  }

  if (!detail) {
    return <p className="text-sm text-red-700">{error ?? "지식팩을 찾을 수 없습니다."}</p>;
  }

  return (
    <div className="space-y-4 pb-6">
      {error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}
      <AdminReviewPackSummary detail={detail} />
      <AdminReviewSourceDocuments versions={detail.versions} />
      <AdminChunkManager packId={packId} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <KnowledgeGraphPanel packId={packId} />
        <ExportPanel packId={packId} />
      </div>
      <AdminReviewDecisionPanel packId={packId} detail={detail} onUpdated={setDetail} />
    </div>
  );
}
