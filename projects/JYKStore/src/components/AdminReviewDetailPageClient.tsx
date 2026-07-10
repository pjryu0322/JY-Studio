"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminReviewAcceptTab } from "@/components/AdminReviewAcceptTab";
import { AdminReviewAdvancedActionsTab } from "@/components/AdminReviewAdvancedActionsTab";
import { AdminReviewEvidenceTabs } from "@/components/AdminReviewEvidenceTabs";
import { AdminReviewPackageSnapshotTab } from "@/components/AdminReviewPackageSnapshotTab";
import { AdminReviewPageHeader } from "@/components/AdminReviewPageHeader";
import { AdminReviewReceiptInfoCard } from "@/components/AdminReviewReceiptInfoCard";
import { AdminReviewSourceDocumentsTab } from "@/components/AdminReviewSourceDocumentsTab";
import { AdminReviewWarningIssuesTab } from "@/components/AdminReviewWarningIssuesTab";
import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import { fetchAdminReviewDetail } from "@/lib/admin-review-api";
import {
  defaultAdminReviewEvidenceTab,
  isReviewAccepted,
  type AdminReviewEvidenceTabId,
} from "@/lib/admin-review-tabs";
import { ADMIN_REVIEW_EVIDENCE_SECTION_TITLE } from "@/lib/role-based-ux-copy";

export function AdminReviewDetailPageClient({ packId }: { readonly packId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminReviewDetailDto | null>(null);
  const [evidenceTab, setEvidenceTab] =
    useState<AdminReviewEvidenceTabId>("package");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminReviewDetail(packId);
      setDetail(data.detail);
      setEvidenceTab(defaultAdminReviewEvidenceTab(data.detail));
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

      <AdminReviewPageHeader detail={detail} />

      <AdminReviewAcceptTab packId={packId} detail={detail} onUpdated={setDetail} />

      {isReviewAccepted(detail) ? (
        <AdminReviewReceiptInfoCard
          detail={detail}
          onGoToPackageTab={() => setEvidenceTab("package")}
        />
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900">
          {ADMIN_REVIEW_EVIDENCE_SECTION_TITLE}
        </h2>
        <AdminReviewEvidenceTabs
          activeTab={evidenceTab}
          onTabChange={setEvidenceTab}
        />
        {evidenceTab === "package" ? (
          <AdminReviewPackageSnapshotTab detail={detail} />
        ) : null}
        {evidenceTab === "warnings" ? (
          <AdminReviewWarningIssuesTab detail={detail} />
        ) : null}
        {evidenceTab === "documents" ? (
          <AdminReviewSourceDocumentsTab
            packId={packId}
            detail={detail}
            onUpdated={setDetail}
          />
        ) : null}
        {evidenceTab === "advanced" ? (
          <AdminReviewAdvancedActionsTab
            packId={packId}
            detail={detail}
            onUpdated={setDetail}
          />
        ) : null}
      </section>
    </div>
  );
}
