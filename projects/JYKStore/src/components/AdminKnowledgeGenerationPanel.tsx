"use client";

import { AdminWorkerZipGenerationCard } from "@/components/AdminWorkerZipGenerationCard";

/**
 * Workbench step2 — 지식데이터 생성 영역.
 * 상태/폴링은 AdminWorkerZipGenerationCard가 소유하며, 품질 섹션도 동일 카드에 포함된다.
 * (이중 폴링 방지를 위해 생성·품질을 한 인스턴스로 유지)
 */
export function AdminKnowledgeGenerationPanel({
  packId,
  onReviewDetailRefresh,
  onPhaseChange,
  qualityRefreshRequestKey = 0,
  preferQualitySection = false,
}: {
  readonly packId: string;
  readonly onReviewDetailRefresh?: () => void | Promise<void>;
  readonly onPhaseChange?: (
    phase:
      | "NONE"
      | "REQUESTED"
      | "ACCEPTED"
      | "REJECTED"
      | "PROCESSING"
      | "COMPLETED"
      | "FAILED",
  ) => void;
  readonly qualityRefreshRequestKey?: number;
  readonly preferQualitySection?: boolean;
}) {
  return (
    <AdminWorkerZipGenerationCard
      packId={packId}
      onReviewDetailRefresh={onReviewDetailRefresh}
      onPhaseChange={onPhaseChange}
      qualityRefreshRequestKey={qualityRefreshRequestKey}
      preferQualitySection={preferQualitySection}
    />
  );
}
