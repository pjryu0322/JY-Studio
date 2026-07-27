"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminKnowledgeCorrectionPanel } from "@/components/AdminKnowledgeCorrectionPanel";
import { AdminProviderSupplementPanel } from "@/components/AdminProviderSupplementPanel";
import {
  fetchAdminReviewDetail,
  fetchAdminStoreWorkflowMarkers,
  fetchAdminWorkerZipRequestState,
} from "@/lib/admin-review-api";
import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import {
  buildAdminQualityGateSnapshot,
  type AdminWorkerZipPhase,
} from "@/lib/role-workspace/admin-review-rail";
import type { ProviderSupplementRequestState } from "@/lib/provider-supplement-request";
import { isOpenProviderSupplementPhase } from "@/lib/provider-supplement-request";
import { adminQueuePath } from "@/lib/routes";

/**
 * Inbox correction queue workbench — loads pack detail and renders the
 * knowledge correction card (plus open provider-supplement panel when present).
 */
export function AdminCorrectionQueuePanel({
  packId,
  packName,
  onChanged,
}: {
  readonly packId: string;
  readonly packName?: string;
  readonly onChanged?: () => void | Promise<void>;
}) {
  const [detail, setDetail] = useState<AdminReviewDetailDto | null>(null);
  const [workerZipPhase, setWorkerZipPhase] = useState<AdminWorkerZipPhase>("NONE");
  const [supplementState, setSupplementState] =
    useState<ProviderSupplementRequestState | null>(null);
  const [providerReviewPhase, setProviderReviewPhase] = useState("NONE");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [detailRes, zipState, markers] = await Promise.all([
        fetchAdminReviewDetail(packId),
        fetchAdminWorkerZipRequestState(packId).catch(() => null),
        fetchAdminStoreWorkflowMarkers(packId).catch(() => null),
      ]);
      setDetail(detailRes.detail);
      setWorkerZipPhase((zipState?.requestStatus as AdminWorkerZipPhase) ?? "NONE");
      setSupplementState(markers?.providerSupplement ?? null);
      setProviderReviewPhase(markers?.providerReviewPhase ?? "NONE");
    } catch (err) {
      setError(err instanceof Error ? err.message : "보정 대상을 불러오지 못했습니다.");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [packId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const resolvedName = packName ?? detail?.pack.name ?? packId;
  const quality = buildAdminQualityGateSnapshot(detail);
  const hasOpenSupplement = isOpenProviderSupplementPhase(supplementState?.adminPhase);

  if (loading) {
    return (
      <p className="rounded-2xl border border-store-border bg-white px-4 py-3 text-sm text-store-muted">
        보정 작업 카드를 불러오는 중…
      </p>
    );
  }

  if (error) {
    return (
      <div className="space-y-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3">
        <p className="text-sm text-red-800">{error}</p>
        <button
          type="button"
          onClick={() => void reload()}
          className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-900"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {hasOpenSupplement && supplementState ? (
        <AdminProviderSupplementPanel
          packId={packId}
          state={supplementState}
          onChanged={async () => {
            await reload();
            await onChanged?.();
          }}
        />
      ) : null}
      <AdminKnowledgeCorrectionPanel
        packId={packId}
        packName={resolvedName}
        detail={detail}
        workerZipPhase={workerZipPhase}
        quality={quality}
        providerReviewPhase={providerReviewPhase}
        onGoGeneration={() => {
          window.location.assign(adminQueuePath("generation"));
        }}
        onRerunQuality={() => {
          window.location.assign(adminQueuePath("quality"));
        }}
        onGoProviderReview={() => {
          window.location.assign(adminQueuePath("provider-review"));
        }}
        onGoSearchValidation={() => {
          window.location.assign(adminQueuePath("service-validation"));
        }}
      />
    </div>
  );
}
