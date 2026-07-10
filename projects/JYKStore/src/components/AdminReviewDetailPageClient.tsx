"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminReviewAcceptTab } from "@/components/AdminReviewAcceptTab";
import { AdminReviewAdvancedActionsTab } from "@/components/AdminReviewAdvancedActionsTab";
import { AdminReviewPackageSnapshotTab } from "@/components/AdminReviewPackageSnapshotTab";
import { AdminReviewSourceDocumentsTab } from "@/components/AdminReviewSourceDocumentsTab";
import { AdminReviewTabs } from "@/components/AdminReviewTabs";
import { AdminReviewWarningIssuesTab } from "@/components/AdminReviewWarningIssuesTab";
import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import { fetchAdminReviewDetail } from "@/lib/admin-review-api";
import {
  defaultAdminReviewTab,
  type AdminReviewTabId,
} from "@/lib/admin-review-tabs";

export function AdminReviewDetailPageClient({ packId }: { readonly packId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminReviewDetailDto | null>(null);
  const [activeTab, setActiveTab] = useState<AdminReviewTabId>("accept");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminReviewDetail(packId);
      setDetail(data.detail);
      setActiveTab(defaultAdminReviewTab(data.detail));
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
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <AdminReviewTabs detail={detail} activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === "accept" ? (
        <AdminReviewAcceptTab packId={packId} detail={detail} onUpdated={setDetail} />
      ) : null}
      {activeTab === "package" ? <AdminReviewPackageSnapshotTab detail={detail} /> : null}
      {activeTab === "warnings" ? <AdminReviewWarningIssuesTab detail={detail} /> : null}
      {activeTab === "sources" ? (
        <AdminReviewSourceDocumentsTab
          packId={packId}
          detail={detail}
          onUpdated={setDetail}
        />
      ) : null}
      {activeTab === "advanced" ? (
        <AdminReviewAdvancedActionsTab
          packId={packId}
          detail={detail}
          onUpdated={setDetail}
        />
      ) : null}
    </div>
  );
}
