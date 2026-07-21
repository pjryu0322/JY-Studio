"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminReviewAcceptTab } from "@/components/AdminReviewAcceptTab";
import { AdminReviewEvidenceTabs } from "@/components/AdminReviewEvidenceTabs";
import { AdminReviewPackageSnapshotTab } from "@/components/AdminReviewPackageSnapshotTab";
import { AdminReviewPageHeader } from "@/components/AdminReviewPageHeader";
import { AdminReviewProcessingEvidenceTab } from "@/components/AdminReviewProcessingEvidenceTab";
import { AdminReviewReceiptInfoCard } from "@/components/AdminReviewReceiptInfoCard";
import { AdminReviewSourceDocumentsTab } from "@/components/AdminReviewSourceDocumentsTab";
import { AdminReviewWarningIssuesTab } from "@/components/AdminReviewWarningIssuesTab";
import { AdminServiceValidationOpsPanel } from "@/components/AdminServiceValidationOpsPanel";
import { AdminWorkerZipGenerationCard } from "@/components/AdminWorkerZipGenerationCard";
import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import {
  fetchAdminDoclingImportApi,
  fetchAdminReviewDetail,
} from "@/lib/admin-review-api";
import {
  defaultAdminReviewEvidenceTab,
  hasProcessingReviewEvidence,
  isReviewAccepted,
  type AdminReviewEvidenceTabId,
} from "@/lib/admin-review-tabs";
import { ADMIN_REVIEW_EVIDENCE_SECTION_TITLE } from "@/lib/role-based-ux-copy";

export function AdminReviewDetailPageClient({ packId }: { readonly packId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminReviewDetailDto | null>(null);
  const [hasImportBundle, setHasImportBundle] = useState(false);
  const [evidenceTab, setEvidenceTab] =
    useState<AdminReviewEvidenceTabId>("package");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, docling] = await Promise.all([
        fetchAdminReviewDetail(packId),
        fetchAdminDoclingImportApi(packId).catch(() => ({ bundle: null })),
      ]);
      setDetail(data.detail);
      setHasImportBundle(Boolean(docling.bundle));
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

  const showProcessingTab = useMemo(() => {
    if (!detail) return false;
    return hasProcessingReviewEvidence(detail) || hasImportBundle;
  }, [detail, hasImportBundle]);

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

      <AdminWorkerZipGenerationCard packId={packId} />

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
          includeProcessing={showProcessingTab}
        />
        {evidenceTab === "package" ? (
          <AdminReviewPackageSnapshotTab detail={detail} />
        ) : null}
        {evidenceTab === "warnings" ? (
          <AdminReviewWarningIssuesTab detail={detail} />
        ) : null}
        {evidenceTab === "documents" ? (
          <AdminReviewSourceDocumentsTab packId={packId} detail={detail} />
        ) : null}
        {evidenceTab === "processing" && showProcessingTab ? (
          <AdminReviewProcessingEvidenceTab
            packId={packId}
            detail={detail}
            onDetailUpdated={setDetail}
          />
        ) : null}
        {evidenceTab === "serviceValidation" ? (
          <AdminServiceValidationOpsPanel packId={packId} />
        ) : null}
      </section>
    </div>
  );
}
